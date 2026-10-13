from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from django.db import transaction
from django.utils import timezone
import logging

from core.models import (
    Sale, Branch, Module, Customer, SaleReturn, BranchInventory, StockAdjustment, InstallmentPlan,
)
from core.permissions import IsCashierOrAbove, IsManagerOrAbove, HasPrivilege
from core.services.sale_service import create_sale, add_payment_to_sale, find_or_create_customer, money
from core.services.return_service import process_return
from core.idempotency import idempotent
from core.utils import get_client_ip, log_audit
logger = logging.getLogger(__name__)

from .serializers import (
    SaleSerializer, SaleDetailSerializer,
    CreateSaleSerializer, AddPaymentSerializer,
    SaleReturnSerializer, CreateReturnSerializer,
)


class SaleListCreateView(APIView):
    permission_classes = [IsCashierOrAbove, HasPrivilege('pos')]

    def get(self, request):
        business = request.user.business
        queryset = Sale.objects.filter(
            business=business,
            is_deleted=False
        ).select_related(
            'branch', 'module', 'customer', 'created_by'
        ).prefetch_related('payments__created_by').order_by('-created_at')

        # Filters
        branch_id      = request.query_params.get('branch_id')
        module_id      = request.query_params.get('module_id')
        payment_status = request.query_params.get('payment_status')
        customer_id    = request.query_params.get('customer_id')
        date_from      = request.query_params.get('date_from')
        date_to        = request.query_params.get('date_to')
        search         = request.query_params.get('search')
        mine           = request.query_params.get('mine')

        # Cashier sees only their own sales. Any role can also explicitly
        # ask for just their own (e.g. a personal "today's sales" widget)
        # without that becoming the default for manager/owner-facing views.
        if request.user.role == 'cashier' or (mine and mine.lower() == 'true'):
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
        if search:
            queryset = queryset.filter(
                Q(sale_number__icontains=search) |
                Q(customer__full_name__icontains=search) |
                Q(customer__phone_number__icontains=search) |
                Q(items__product_name__icontains=search)
            ).distinct()

        serializer = SaleSerializer(queryset, many=True)
        return Response(serializer.data)

    @idempotent
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

        new_customer_name = (data.get('new_customer_name') or '').strip()
        try:
            # One transaction: a customer typed at checkout is only saved if
            # the sale itself succeeds (ValueError propagates out and rolls
            # both back).
            with transaction.atomic():
                if customer is None and new_customer_name:
                    customer = find_or_create_customer(
                        business, new_customer_name,
                        data.get('new_customer_phone', ''), request.user,
                    )
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

        except Exception:
            logger.exception('Unexpected error while creating sale')
            return Response(
                {'error': 'Could not complete sale. Please retry or contact support if it continues.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            SaleDetailSerializer(result['sale']).data,
            status=status.HTTP_201_CREATED
        )


class SaleDetailView(APIView):
    permission_classes = [IsCashierOrAbove, HasPrivilege('pos')]

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

        with transaction.atomic():
            sale = Sale.objects.select_for_update().get(pk=sale.pk)
            if sale.is_deleted:
                return Response(status=status.HTTP_204_NO_CONTENT)
            if sale.returns.exists():
                return Response(
                    {'error': 'This sale has returns recorded and cannot be voided.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Put the goods back on the shelf
            for item in sale.items.filter(product__isnull=False):
                inventory, _ = BranchInventory.objects.select_for_update().get_or_create(
                    business=sale.business, branch=sale.branch, product_id=item.product_id,
                    defaults={'quantity_in_stock': 0},
                )
                before = inventory.quantity_in_stock
                inventory.quantity_in_stock = before + item.quantity
                inventory.save(update_fields=['quantity_in_stock'])
                StockAdjustment.objects.create(
                    business=sale.business, branch=sale.branch, product_id=item.product_id,
                    adjustment_type=StockAdjustment.TYPE_RETURN, quantity_change=item.quantity,
                    quantity_before=before, quantity_after=before + item.quantity,
                    reason=f'Voided sale {sale.sale_number}', reference_id=sale.id,
                    created_by=request.user,
                )

            # Nothing was paid, so the whole total was added to the customer's debt
            if sale.customer_id and sale.balance_due > 0:
                customer = Customer.objects.select_for_update().get(pk=sale.customer_id)
                customer.total_outstanding_debt = max(
                    money(customer.total_outstanding_debt) - money(sale.balance_due), 0)
                customer.save(update_fields=['total_outstanding_debt', 'updated_at'])
            InstallmentPlan.objects.filter(sale=sale).update(status=InstallmentPlan.STATUS_CANCELLED)

            sale.is_deleted = True
            sale.deleted_at = timezone.now()
            sale.save()

            log_audit(
                business_id=sale.business_id, user_id=request.user.id, action='DELETE',
                table_name='sales', record_id=sale.id,
                old_values={'sale_number': sale.sale_number, 'total_amount': str(sale.total_amount)},
                ip_address=get_client_ip(request),
            )

        return Response(status=status.HTTP_204_NO_CONTENT)


class SaleReturnCreateView(APIView):
    """Record goods brought back from a sale."""
    permission_classes = [IsManagerOrAbove, HasPrivilege('pos')]

    @idempotent
    def post(self, request, sale_id):
        sale = Sale.objects.filter(id=sale_id, business=request.user.business, is_deleted=False).first()
        if not sale:
            return Response({'error': 'Sale not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = CreateReturnSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data

        try:
            sale_return = process_return(
                sale, data['items'], refund_method=data.get('refund_method'),
                reason=data.get('reason', ''), created_by=request.user,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        sale.refresh_from_db()
        return Response({
            'return': SaleReturnSerializer(sale_return).data,
            'sale': SaleDetailSerializer(sale).data,
        }, status=status.HTTP_201_CREATED)


class SaleReturnListView(APIView):
    permission_classes = [IsCashierOrAbove, HasPrivilege('pos')]

    def get(self, request):
        qs = (SaleReturn.objects.filter(business=request.user.business)
              .select_related('sale', 'customer', 'branch', 'created_by')
              .prefetch_related('items').order_by('-created_at'))
        if request.user.role == 'cashier':
            qs = qs.filter(sale__created_by=request.user)
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        branch_id = request.query_params.get('branch_id')
        if date_from:
            qs = qs.filter(return_date__gte=date_from)
        if date_to:
            qs = qs.filter(return_date__lte=date_to)
        if branch_id:
            qs = qs.filter(branch_id=branch_id)
        return Response(SaleReturnSerializer(qs[:500], many=True).data)


class AddPaymentView(APIView):
    permission_classes = [IsCashierOrAbove, HasPrivilege('pos')]

    @idempotent
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

        except Exception:
            logger.exception('Unexpected error while creating sale')
            return Response(
                {'error': 'Could not complete sale. Please retry or contact support if it continues.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response({
            'message': 'Payment recorded successfully.',
            'sale_number':        result['sale'].sale_number,
            'amount_paid':        str(result['payment'].amount),
            'remaining_balance':  str(result['remaining_balance']),
            'payment_status':     result['sale'].payment_status,
        })