from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Q

from core.models import Customer, CustomerNote, Sale
from core.permissions import IsManagerOrAbove, IsCashierOrAbove
from core.utils import log_audit, get_client_ip, update_customer_loyalty
from .serializers import (
    CustomerSerializer, CustomerDetailSerializer,
    CreateCustomerSerializer, UpdateCustomerSerializer,
    CustomerNoteCreateSerializer
)
from api.v1.sales.serializers import SaleDetailSerializer
from rest_framework.exceptions import NotFound


class CustomerListCreateView(APIView):
    permission_classes = [IsCashierOrAbove]

    def get(self, request):
        business = request.user.business
        queryset = Customer.objects.filter(
            business=business,
            is_deleted=False
        )

        # Filters
        search       = request.query_params.get('search')
        loyalty_tag  = request.query_params.get('loyalty_tag')
        customer_type = request.query_params.get('customer_type')

        if search:
            queryset = queryset.filter(
                Q(full_name__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(business_name__icontains=search)
            )
        if loyalty_tag:
            queryset = queryset.filter(loyalty_tag=loyalty_tag)
        if customer_type:
            queryset = queryset.filter(customer_type=customer_type)

        queryset = queryset.order_by('full_name')
        serializer = CustomerSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CreateCustomerSerializer(
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

        customer = Customer.objects.create(
            business=business,
            full_name=data['full_name'],
            phone_number=data.get('phone_number', ''),
            email=data.get('email', ''),
            address=data.get('address', ''),
            business_name=data.get('business_name', ''),
            customer_type=data.get('customer_type', 'retail'),
            created_by=request.user,
        )

        log_audit(
            business_id=business.id,
            user_id=request.user.id,
            action='CREATE',
            table_name='customers',
            record_id=customer.id,
            new_values={'full_name': customer.full_name},
            ip_address=get_client_ip(request),
        )

        return Response(
            CustomerSerializer(customer).data,
            status=status.HTTP_201_CREATED
        )


class CustomerDetailView(APIView):

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsCashierOrAbove()]
        return [IsManagerOrAbove()]

    def get_customer(self, request, customer_id):
        try:
            return Customer.objects.get(
                id=customer_id,
                business=request.user.business,
                is_deleted=False
            )
        except Customer.DoesNotExist:
            return None

    def get(self, request, customer_id):
        customer = self.get_customer(request, customer_id)
        if not customer:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = CustomerDetailSerializer(customer)
        return Response(serializer.data)

    def patch(self, request, customer_id):
        customer = self.get_customer(request, customer_id)
        if not customer:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = UpdateCustomerSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data
        for field in [
            'full_name', 'phone_number', 'email',
            'address', 'business_name', 'customer_type'
        ]:
            if field in data:
                setattr(customer, field, data[field])
        customer.save()

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='UPDATE',
            table_name='customers',
            record_id=customer.id,
            new_values=data,
            ip_address=get_client_ip(request),
        )

        return Response(CustomerSerializer(customer).data)

    def delete(self, request, customer_id):
        customer = self.get_customer(request, customer_id)
        if not customer:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if customer.total_outstanding_debt > 0:
            return Response(
                {'error': f'Cannot delete customer with outstanding debt of ₦{customer.total_outstanding_debt}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        customer.is_deleted = True
        customer.deleted_at = timezone.now()
        customer.save()

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='DELETE',
            table_name='customers',
            record_id=customer.id,
            ip_address=get_client_ip(request),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomerHistoryView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request, customer_id):
        try:
            customer = Customer.objects.get(
                id=customer_id,
                business=request.user.business,
                is_deleted=False,
            )
        except Customer.DoesNotExist:
            raise NotFound('Customer not found.')

        sales = Sale.objects.filter(
            customer=customer,
            business=request.user.business,
            is_deleted=False,
        ).select_related(
            'branch', 'module', 'created_by',
        ).prefetch_related(
            'items', 'payments__created_by',
        ).order_by('sale_date', 'created_at')

        return Response({
            'customer': CustomerDetailSerializer(customer).data,
            'sales': SaleDetailSerializer(sales, many=True).data,
        })


class CustomerNoteView(APIView):
    permission_classes = [IsManagerOrAbove]

    def post(self, request, customer_id):
        try:
            customer = Customer.objects.get(
                id=customer_id,
                business=request.user.business,
                is_deleted=False
            )
        except Customer.DoesNotExist:
            return Response(
                {'error': 'Customer not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = CustomerNoteCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        note = CustomerNote.objects.create(
            customer=customer,
            business=request.user.business,
            note=serializer.validated_data['note'],
            created_by=request.user,
        )

        return Response({
            'id': str(note.id),
            'note': note.note,
            'created_at': note.created_at,
        }, status=status.HTTP_201_CREATED)

    def delete(self, request, customer_id, note_id):
        try:
            note = CustomerNote.objects.get(
                id=note_id,
                customer_id=customer_id,
                business=request.user.business,
            )
        except CustomerNote.DoesNotExist:
            return Response(
                {'error': 'Note not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        note.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TopCustomersView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business    = request.user.business
        loyalty_tag = request.query_params.get('loyalty_tag')

        queryset = Customer.objects.filter(
            business=business,
            is_deleted=False,
            is_active=True,
        )

        if loyalty_tag:
            queryset = queryset.filter(loyalty_tag=loyalty_tag)

        top_customers = queryset.order_by('-lifetime_spend')[:20]

        results = [{
            'id':              str(c.id),
            'full_name':       c.full_name,
            'phone_number':    c.phone_number,
            'business_name':   c.business_name,
            'loyalty_tag':     c.loyalty_tag,
            'lifetime_spend':  str(c.lifetime_spend),
            'total_purchases': c.sales.filter(is_deleted=False).count(),
            'last_purchase_date': str(c.last_purchase_date) if c.last_purchase_date else None,
            'outstanding_debt': str(c.total_outstanding_debt),
        } for c in top_customers]

        return Response({
            'count': len(results),
            'top_customers': results,
        })