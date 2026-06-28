from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db import transaction
from django.db.models import Q

from core.models import (
    Product, ProductAttribute, BranchInventory,
    StockAdjustment, Branch, Module
)
from core.permissions import IsManagerOrAbove, IsCashierOrAbove
from core.utils import log_audit, get_client_ip
from .serializers import (
    ProductSerializer, CreateProductSerializer,
    UpdateProductSerializer, StockAdjustmentSerializer,
    BranchStockSerializer
)


class ProductListCreateView(APIView):

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManagerOrAbove()]
        return [IsCashierOrAbove()]

    def get(self, request):
        business  = request.user.business
        queryset  = Product.objects.filter(
            business=business,
            is_deleted=False
        ).select_related('module').prefetch_related('attributes', 'inventory')

        # Filters
        module_id = request.query_params.get('module_id')
        is_active = request.query_params.get('is_active')
        search    = request.query_params.get('search')
        branch_id = request.query_params.get('branch_id')

        if module_id:
            queryset = queryset.filter(module_id=module_id)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(sku__icontains=search)      |
                Q(barcode__icontains=search)
            )

        queryset = queryset.order_by('name')

        serializer = ProductSerializer(
            queryset, many=True,
            context={'request': request, 'branch_id': branch_id}
        )
        return Response(serializer.data)

    @transaction.atomic
    def post(self, request):
        serializer = CreateProductSerializer(
            data=request.data,
            context={'request': request}
        )
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data    = serializer.validated_data
        business = request.user.business

        # Create product
        product = Product.objects.create(
            business=business,
            module_id=data['module_id'],
            name=data['name'],
            description=data.get('description', ''),
            sku=data.get('sku', ''),
            unit_type=data.get('unit_type', ''),
            wholesale_price=data['wholesale_price'],
            retail_price=data['retail_price'],
            cost_price=data.get('cost_price'),
            reorder_level=data.get('reorder_level', 0),
            created_by=request.user,
        )

        # Create attributes
        for attr in data.get('attributes', []):
            ProductAttribute.objects.create(
                product=product,
                business=business,
                attribute_key=attr['attribute_key'],
                attribute_value=attr['attribute_value'],
            )

        # Create BranchInventory for ALL branches (quantity = 0)
        branches = Branch.objects.filter(
            business=business,
            is_deleted=False
        )
        for branch in branches:
            BranchInventory.objects.create(
                business=business,
                branch=branch,
                product=product,
                quantity_in_stock=0,
            )

        log_audit(
            business_id=business.id,
            user_id=request.user.id,
            action='CREATE',
            table_name='products',
            record_id=product.id,
            new_values={'name': product.name},
            ip_address=get_client_ip(request),
        )

        return Response(
            ProductSerializer(
                product,
                context={'request': request}
            ).data,
            status=status.HTTP_201_CREATED
        )


class ProductDetailView(APIView):

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsCashierOrAbove()]
        return [IsManagerOrAbove()]

    def get_product(self, request, product_id):
        try:
            return Product.objects.get(
                id=product_id,
                business=request.user.business,
                is_deleted=False
            )
        except Product.DoesNotExist:
            return None

    def get(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = ProductSerializer(
            product,
            context={'request': request}
        )
        return Response(serializer.data)

    @transaction.atomic
    def patch(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = UpdateProductSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data

        # Update product fields
        for field in [
            'name', 'description','sku', 'barcode', 'unit_type',
            'wholesale_price', 'retail_price',
            'cost_price', 'reorder_level', 'is_active'
        ]:
            if field in data:
                setattr(product, field, data[field])
        product.save()

        # Upsert attributes
        if 'attributes' in data:
            for attr in data['attributes']:
                ProductAttribute.objects.update_or_create(
                    product=product,
                    attribute_key=attr['attribute_key'],
                    defaults={'attribute_value': attr['attribute_value']}
                )

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='UPDATE',
            table_name='products',
            record_id=product.id,
            new_values=data,
            ip_address=get_client_ip(request),
        )

        return Response(
            ProductSerializer(
                product,
                context={'request': request}
            ).data
        )

    def delete(self, request, product_id):
        product = self.get_product(request, product_id)
        if not product:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        product.is_deleted = True
        product.deleted_at = timezone.now()
        product.save()

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='DELETE',
            table_name='products',
            record_id=product.id,
            ip_address=get_client_ip(request),
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class StockAdjustView(APIView):
    permission_classes = [IsManagerOrAbove]

    @transaction.atomic
    def post(self, request, product_id):
        try:
            product = Product.objects.get(
                id=product_id,
                business=request.user.business,
                is_deleted=False
            )
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = StockAdjustmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data

        # Verify branch belongs to this business
        try:
            branch = Branch.objects.get(
                id=data['branch_id'],
                business=request.user.business,
                is_deleted=False
            )
        except Branch.DoesNotExist:
            return Response(
                {'error': 'Branch not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get or create inventory record
        inventory, _ = BranchInventory.objects.get_or_create(
            business=request.user.business,
            branch=branch,
            product=product,
            defaults={'quantity_in_stock': 0}
        )

        quantity_before = inventory.quantity_in_stock
        quantity_change = data['quantity_change']
        quantity_after  = quantity_before + quantity_change

        # Prevent negative stock
        if quantity_after < 0:
            return Response(
                {
                    'error': f'Insufficient stock. Current stock is {quantity_before}.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update inventory
        inventory.quantity_in_stock = quantity_after
        if quantity_change > 0:
            inventory.last_restocked_at = timezone.now()
            inventory.last_restocked_by = request.user
        inventory.save()

        # Create adjustment record
        adjustment = StockAdjustment.objects.create(
            business=request.user.business,
            branch=branch,
            product=product,
            adjustment_type=data['adjustment_type'],
            quantity_change=quantity_change,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            reason=data.get('reason', ''),
            created_by=request.user,
        )

        return Response({
            'message': 'Stock adjusted successfully.',
            'product': product.name,
            'branch': branch.name,
            'adjustment_type': adjustment.adjustment_type,
            'quantity_before': quantity_before,
            'quantity_change': quantity_change,
            'quantity_after': quantity_after,
        })


class ProductInventoryView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request, product_id):
        try:
            product = Product.objects.get(
                id=product_id,
                business=request.user.business,
                is_deleted=False
            )
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        inventory = BranchInventory.objects.filter(
            product=product,
            business=request.user.business
        ).select_related('branch')

        serializer = BranchStockSerializer(inventory, many=True)
        return Response({
            'product': product.name,
            'reorder_level': product.reorder_level,
            'stock_by_branch': serializer.data,
            'total_stock': sum(
                i.quantity_in_stock for i in inventory
            ),
        })


class LowStockView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business  = request.user.business
        branch_id = request.query_params.get('branch_id')

        inventory = BranchInventory.objects.filter(
            business=business,
        ).select_related('product', 'branch')

        if branch_id:
            inventory = inventory.filter(branch_id=branch_id)

        # Filter where stock <= reorder level
        low_stock = [
            i for i in inventory
            if i.quantity_in_stock <= i.product.reorder_level
            and not i.product.is_deleted
        ]

        results = [{
            'product_id':       str(i.product.id),
            'product_name':     i.product.name,
            'branch_id':        str(i.branch.id),
            'branch_name':      i.branch.name,
            'quantity_in_stock': i.quantity_in_stock,
            'reorder_level':    i.product.reorder_level,
        } for i in low_stock]

        return Response({
            'count': len(results),
            'low_stock_items': results,
        })


class ExpiringProductsView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        from datetime import date, timedelta
        business    = request.user.business
        alert_days  = getattr(
            business.settings, 'expiry_alert_days', 30
        )
        alert_date  = date.today() + timedelta(days=alert_days)

        # Find products with expiry_date attribute within alert window
        from core.models import ProductAttribute
        expiring_attrs = ProductAttribute.objects.filter(
            business=business,
            attribute_key='expiry_date',
            attribute_value__lte=str(alert_date),
            attribute_value__gte=str(date.today()),
        ).select_related('product')

        results = []
        for attr in expiring_attrs:
            if not attr.product.is_deleted:
                results.append({
                    'product_id':   str(attr.product.id),
                    'product_name': attr.product.name,
                    'expiry_date':  attr.attribute_value,
                    'days_remaining': (
                        date.fromisoformat(attr.attribute_value)
                        - date.today()
                    ).days,
                })

        results.sort(key=lambda x: x['days_remaining'])

        return Response({
            'count': len(results),
            'alert_window_days': alert_days,
            'expiring_products': results,
        })
        
class StockHistoryView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request, product_id):
        try:
            product = Product.objects.get(
                id=product_id,
                business=request.user.business,
                is_deleted=False
            )
        except Product.DoesNotExist:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        branch_id = request.query_params.get('branch_id')
        limit     = min(int(request.query_params.get('limit', 50)), 200)

        adjustments = StockAdjustment.objects.filter(
            product=product,
            business=request.user.business,
        ).select_related('branch', 'created_by').order_by('-created_at')

        if branch_id:
            adjustments = adjustments.filter(branch_id=branch_id)

        adjustments = adjustments[:limit]

        return Response({
            'product_id':   str(product.id),
            'product_name': product.name,
            'history': [
                {
                    'id':              str(a.id),
                    'date':            str(a.created_at.date()),
                    'branch':          a.branch.name,
                    'type':            a.adjustment_type,
                    'quantity_change': a.quantity_change,
                    'quantity_before': a.quantity_before,
                    'quantity_after':  a.quantity_after,
                    'reason':          a.reason or '',
                    'created_by':      a.created_by.full_name if a.created_by else None,
                }
                for a in adjustments
            ],
        })


class ProductBarcodeLookupView(APIView):
    permission_classes = [IsCashierOrAbove]

    def get(self, request):
        barcode  = request.query_params.get('barcode', '').strip()
        branch_id = request.query_params.get('branch_id')

        if not barcode:
            return Response(
                {'error': 'barcode parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            product = Product.objects.get(
                business=request.user.business,
                barcode=barcode,
                is_deleted=False,
                is_active=True,
            )
        except Product.DoesNotExist:
            return Response(
                {'error': f'No product found with barcode {barcode}.'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Product.MultipleObjectsReturned:
            # Shouldn't happen but handle gracefully
            product = Product.objects.filter(
                business=request.user.business,
                barcode=barcode,
                is_deleted=False,
                is_active=True,
            ).first()

        # Get stock at specific branch if provided
        stock = None
        if branch_id:
            inventory = product.inventory.filter(
                branch_id=branch_id
            ).first()
            stock = inventory.quantity_in_stock if inventory else 0

        serializer = ProductSerializer(
            product,
            context={
                'request':   request,
                'branch_id': branch_id
            }
        )
        data = serializer.data
        if stock is not None:
            data['branch_stock'] = stock

        return Response(data)