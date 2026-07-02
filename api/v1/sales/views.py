from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
import logging

from core.models import Sale, Branch, Module, Customer
from core.permissions import IsCashierOrAbove, IsManagerOrAbove
from core.services.sale_service import create_sale, add_payment_to_sale
from core.utils import get_client_ip
logger = logging.getLogger(__name__)

from .serializers import (
    SaleSerializer, SaleDetailSerializer,
    CreateSaleSerializer, AddPaymentSerializer
)


class SaleListCreateView(APIView):
    permission_classes = [IsCashierOrAbove]

    def get(self, request):
        business = request.user.business
        queryset = Sale.objects.filter(
            business=business,
            is_deleted=False
        ).select_related(
            'branch', 'module', 'customer', 'created_by'
        ).order_by('-created_at')

        # Filters
        branch_id      = request.query_params.get('branch_id')
        module_id      = request.query_params.get('module_id')
        payment_status = request.query_params.get('payment_status')
        customer_id    = request.query_params.get('customer_id')
        date_from      = request.query_params.get('date_from')
        date_to        = request.query_params.get('date_to')

        # Cashier sees only their own sales
        if request.user.role == 'cashier':
            queryset = queryset.filter(created_by=request.user)

        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        if module_id:
            queryset = queryset.filter(module_id=module_id)
        if payment_status:
            queryset = queryset.filter(payment_status=payment_status)
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if date_from:
            queryset = queryset.filter(sale_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(sale_date__lte=date_to)

        serializer = SaleSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CreateSaleSerializer(
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

        branch   = Branch.objects.get(id=data['branch_id'])
        module   = Module.objects.get(id=data['module_id'])
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

        # Check custom pricing permission
        if any(
            item['price_type'] == 'custom' for item in data['items']
        ):
            try:
                settings = business.settings
                if not settings.custom_pricing_enabled:
                    return Response(
                        {'error': 'Custom pricing is disabled for this business.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Exception:
                pass

        try:
            result = create_sale(
                business=business,
                branch=branch,
                module=module,
                items=data['items'],
                payment_data={
                    'amount_paid':     data['amount_paid'],
                    'payment_method':  data['payment_method'],
                    'reference_number': data.get('reference_number', ''),
                },
                customer=customer,
                discount_amount=data.get('discount_amount', 0),
                notes=data.get('notes', ''),
                created_by=request.user,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            SaleDetailSerializer(result['sale']).data,
            status=status.HTTP_201_CREATED
        )


class SaleDetailView(APIView):
    permission_classes = [IsCashierOrAbove]

    def get_sale(self, request, sale_id):
        try:
            return Sale.objects.get(
                id=sale_id,
                business=request.user.business,
                is_deleted=False
            )
        except Sale.DoesNotExist:
            return None

    def get(self, request, sale_id):
        sale = self.get_sale(request, sale_id)
        if not sale:
            return Response(
                {'error': 'Sale not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(SaleDetailSerializer(sale).data)

    def delete(self, request, sale_id):
        if request.user.role not in ('owner', 'manager'):
            return Response(
                {'error': 'Only managers or owners can void a sale.'},
                status=status.HTTP_403_FORBIDDEN
            )

        sale = self.get_sale(request, sale_id)
        if not sale:
            return Response(
                {'error': 'Sale not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if sale.sale_date != timezone.now().date():
            return Response(
                {'error': 'Sales can only be voided on the same day.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if sale.amount_paid > 0:
            return Response(
                {'error': 'Cannot void a sale that has payments recorded.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sale.is_deleted = True
        sale.deleted_at = timezone.now()
        sale.save()

        return Response(status=status.HTTP_204_NO_CONTENT)


class AddPaymentView(APIView):
    permission_classes = [IsCashierOrAbove]

    def post(self, request, sale_id):
        try:
            sale = Sale.objects.get(
                id=sale_id,
                business=request.user.business,
                is_deleted=False
            )
        except Sale.DoesNotExist:
            return Response(
                {'error': 'Sale not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AddPaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            result = add_payment_to_sale(
                sale=sale,
                payment_data=serializer.validated_data,
                created_by=request.user,
            )
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'message': 'Payment recorded successfully.',
            'sale_number':        result['sale'].sale_number,
            'amount_paid':        str(result['payment'].amount),
            'remaining_balance':  str(result['remaining_balance']),
            'payment_status':     result['sale'].payment_status,
        })