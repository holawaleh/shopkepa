from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db import transaction
from decimal import Decimal

from core.models import JobCard, JobCardPart, Branch, Customer, User
from core.permissions import IsCashierOrAbove, IsManagerOrAbove
from core.utils import generate_job_number, log_audit, get_client_ip
from .serializers import (
    JobCardSerializer, JobCardDetailSerializer,
    CreateJobCardSerializer, UpdateJobCardSerializer,
    AddJobCardPartSerializer, JobCardPaymentSerializer
)


class JobCardListCreateView(APIView):
    permission_classes = [IsCashierOrAbove]

    def get(self, request):
        business = request.user.business
        queryset = JobCard.objects.filter(
            business=business,
            is_deleted=False
        ).select_related(
            'branch', 'customer', 'technician', 'created_by'
        ).order_by('-created_at')

        # Filters
        branch_id      = request.query_params.get('branch_id')
        status_filter  = request.query_params.get('status')
        payment_status = request.query_params.get('payment_status')
        technician_id  = request.query_params.get('technician_id')
        date_from      = request.query_params.get('date_from')
        date_to        = request.query_params.get('date_to')

        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)
        if technician_id:
            queryset = queryset.filter(technician_id=technician_id)
        if date_from:
            queryset = queryset.filter(intake_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(intake_date__lte=date_to)

        serializer = JobCardSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CreateJobCardSerializer(
            data=request.data,
            context={'request': request}
        )
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data     = serializer.validated_data
        business = request.user.business

        customer = None
        if data.get('customer_id'):
            try:
                customer = Customer.objects.get(
                    id=data['customer_id'],
                    business=business,
                    is_deleted=False
                )
            except Customer.DoesNotExist:
                return Response(
                    {'error': 'Customer not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )

        technician = None
        if data.get('technician_id'):
            try:
                technician = User.objects.get(
                    id=data['technician_id'],
                    business=business,
                    is_deleted=False
                )
            except User.DoesNotExist:
                return Response(
                    {'error': 'Technician not found.'},
                    status=status.HTTP_404_NOT_FOUND
                )

        labour_charge = Decimal(str(data.get('labour_charge', 0)))

        job_card = JobCard.objects.create(
            business=business,
            branch_id=data['branch_id'],
            job_number=generate_job_number(business.id),
            customer=customer,
            customer_name=data['customer_name'],
            customer_phone=data.get('customer_phone', ''),
            device_description=data['device_description'],
            customer_complaint=data['customer_complaint'],
            technician=technician,
            technician_notes=data.get('technician_notes', ''),
            labour_charge=labour_charge,
            parts_charge=Decimal('0'),
            total_charge=labour_charge,
            amount_paid=Decimal('0'),
            balance_due=labour_charge,
            payment_status='unpaid',
            status='received',
            created_by=request.user,
        )

        log_audit(
            business_id=business.id,
            user_id=request.user.id,
            action='CREATE',
            table_name='job_cards',
            record_id=job_card.id,
            new_values={
                'job_number': job_card.job_number,
                'device':     job_card.device_description,
            },
            ip_address=get_client_ip(request),
        )

        return Response(
            JobCardDetailSerializer(job_card).data,
            status=status.HTTP_201_CREATED
        )


class JobCardDetailView(APIView):
    permission_classes = [IsCashierOrAbove]

    def get_job_card(self, request, job_id):
        try:
            return JobCard.objects.get(
                id=job_id,
                business=request.user.business,
                is_deleted=False
            )
        except JobCard.DoesNotExist:
            return None

    def get(self, request, job_id):
        job_card = self.get_job_card(request, job_id)
        if not job_card:
            return Response(
                {'error': 'Job card not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(JobCardDetailSerializer(job_card).data)

    def patch(self, request, job_id):
        job_card = self.get_job_card(request, job_id)
        if not job_card:
            return Response(
                {'error': 'Job card not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = UpdateJobCardSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data       = serializer.validated_data
        old_status = job_card.status

        if 'status' in data:
            job_card.status = data['status']
            # Auto-set collected_at when status changes to collected
            if data['status'] == 'collected' and old_status != 'collected':
                job_card.collected_at = timezone.now()

        if 'technician_id' in data:
            if data['technician_id']:
                try:
                    job_card.technician = User.objects.get(
                        id=data['technician_id'],
                        business=request.user.business
                    )
                except User.DoesNotExist:
                    return Response(
                        {'error': 'Technician not found.'},
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                job_card.technician = None

        if 'technician_notes' in data:
            job_card.technician_notes = data['technician_notes']

        if 'labour_charge' in data:
            job_card.labour_charge = data['labour_charge']
            job_card.total_charge  = job_card.labour_charge + job_card.parts_charge
            job_card.balance_due   = job_card.total_charge - job_card.amount_paid

        if 'warranty_days' in data:
            job_card.warranty_days = data['warranty_days']

        job_card.save()

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='UPDATE',
            table_name='job_cards',
            record_id=job_card.id,
            old_values={'status': old_status},
            new_values=data,
            ip_address=get_client_ip(request),
        )

        return Response(JobCardDetailSerializer(job_card).data)

    def delete(self, request, job_id):
        if request.user.role not in ('owner', 'manager'):
            return Response(
                {'error': 'Only managers or owners can delete job cards.'},
                status=status.HTTP_403_FORBIDDEN
            )

        job_card = self.get_job_card(request, job_id)
        if not job_card:
            return Response(
                {'error': 'Job card not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if job_card.status != 'received':
            return Response(
                {'error': 'Only job cards with status "received" can be deleted.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if job_card.amount_paid > 0:
            return Response(
                {'error': 'Cannot delete a job card with payments recorded.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        job_card.is_deleted = True
        job_card.deleted_at = timezone.now()
        job_card.save()

        return Response(status=status.HTTP_204_NO_CONTENT)


class JobCardPartView(APIView):
    permission_classes = [IsCashierOrAbove]

    @transaction.atomic
    def post(self, request, job_id):
        try:
            job_card = JobCard.objects.get(
                id=job_id,
                business=request.user.business,
                is_deleted=False
            )
        except JobCard.DoesNotExist:
            return Response(
                {'error': 'Job card not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AddJobCardPartSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data       = serializer.validated_data
        line_total = Decimal(str(data['unit_cost'])) * data['quantity']

        part = JobCardPart.objects.create(
            job_card=job_card,
            business=request.user.business,
            part_name=data['part_name'],
            quantity=data['quantity'],
            unit_cost=data['unit_cost'],
            line_total=line_total,
            supplier=data.get('supplier', ''),
            created_by=request.user,
        )

        # Update job card totals
        job_card.parts_charge += line_total
        job_card.total_charge  = job_card.labour_charge + job_card.parts_charge
        job_card.balance_due   = job_card.total_charge - job_card.amount_paid
        job_card.save()

        return Response({
            'message': 'Part added successfully.',
            'part': {
                'id':         str(part.id),
                'part_name':  part.part_name,
                'quantity':   part.quantity,
                'unit_cost':  str(part.unit_cost),
                'line_total': str(part.line_total),
            },
            'job_card_totals': {
                'labour_charge': str(job_card.labour_charge),
                'parts_charge':  str(job_card.parts_charge),
                'total_charge':  str(job_card.total_charge),
                'balance_due':   str(job_card.balance_due),
            }
        }, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def delete(self, request, job_id, part_id):
        if request.user.role not in ('owner', 'manager'):
            return Response(
                {'error': 'Only managers or owners can remove parts.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            job_card = JobCard.objects.get(
                id=job_id,
                business=request.user.business,
                is_deleted=False
            )
        except JobCard.DoesNotExist:
            return Response(
                {'error': 'Job card not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        try:
            part = JobCardPart.objects.get(
                id=part_id,
                job_card=job_card
            )
        except JobCardPart.DoesNotExist:
            return Response(
                {'error': 'Part not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Reverse the part charge from job card
        job_card.parts_charge -= part.line_total
        if job_card.parts_charge < 0:
            job_card.parts_charge = Decimal('0')
        job_card.total_charge = job_card.labour_charge + job_card.parts_charge
        job_card.balance_due  = job_card.total_charge - job_card.amount_paid
        job_card.save()

        part.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class JobCardPaymentView(APIView):
    permission_classes = [IsCashierOrAbove]

    @transaction.atomic
    def post(self, request, job_id):
        try:
            job_card = JobCard.objects.get(
                id=job_id,
                business=request.user.business,
                is_deleted=False
            )
        except JobCard.DoesNotExist:
            return Response(
                {'error': 'Job card not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if job_card.payment_status == 'paid':
            return Response(
                {'error': 'This job card is already fully paid.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = JobCardPaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data   = serializer.validated_data
        amount = Decimal(str(data['amount']))

        if amount > job_card.balance_due:
            amount = job_card.balance_due

        job_card.amount_paid    += amount
        job_card.balance_due    -= amount
        job_card.payment_method  = data['payment_method']

        if job_card.balance_due <= 0:
            job_card.balance_due    = Decimal('0')
            job_card.payment_status = 'paid'
        else:
            job_card.payment_status = 'partial'

        job_card.save()

        # Update customer debt if linked
        if job_card.customer:
            job_card.customer.total_outstanding_debt -= amount
            if job_card.customer.total_outstanding_debt < 0:
                job_card.customer.total_outstanding_debt = Decimal('0')
            job_card.customer.save(
                update_fields=['total_outstanding_debt', 'updated_at']
            )

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='UPDATE',
            table_name='job_cards',
            record_id=job_card.id,
            new_values={
                'payment': str(amount),
                'payment_status': job_card.payment_status,
            },
            ip_address=get_client_ip(request),
        )

        return Response({
            'message': 'Payment recorded successfully.',
            'job_number':       job_card.job_number,
            'amount_paid':      str(amount),
            'total_paid':       str(job_card.amount_paid),
            'remaining_balance': str(job_card.balance_due),
            'payment_status':   job_card.payment_status,
        })