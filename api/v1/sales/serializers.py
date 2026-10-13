from rest_framework import serializers
from core.models import Sale, SaleItem, Payment, InstallmentPlan, SaleReturn, SaleReturnItem


class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SaleItem
        fields = [
            'id', 'product', 'product_name', 'quantity',
            'unit_type', 'price_type', 'unit_price',
            'discount_amount', 'line_total', 'returned_quantity',
        ]


class PaymentSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model  = Payment
        fields = [
            'id', 'payment_method', 'amount',
            'payment_date', 'reference_number', 'tranche_number', 'notes',
            'created_by', 'created_by_name', 'created_at',
        ]


class InstallmentPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InstallmentPlan
        fields = [
            'id', 'total_amount', 'initial_deposit',
            'current_balance', 'max_tranches',
            'tranches_used', 'status', 'due_date',
        ]


class SaleSerializer(serializers.ModelSerializer):
    payments = PaymentSerializer(many=True, read_only=True)
    customer_name = serializers.CharField(
        source='customer.full_name', read_only=True
    )
    branch_name = serializers.CharField(
        source='branch.name', read_only=True
    )
    module_name = serializers.CharField(
        source='module.name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )

    class Meta:
        model  = Sale
        fields = [
            'id', 'sale_number', 'branch', 'branch_name',
            'module', 'module_name', 'customer', 'customer_name',
            'subtotal', 'discount_amount', 'total_amount',
            'amount_paid', 'balance_due', 'payment_status',
            'tax_rate', 'tax_amount', 'returned_amount',
            'has_installment_plan', 'sale_date', 'notes',
            'payments', 'created_by_name', 'created_at',
        ]


class SaleReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SaleReturnItem
        fields = ['id', 'sale_item', 'product', 'product_name', 'quantity', 'unit_value', 'line_value', 'restocked']


class SaleReturnSerializer(serializers.ModelSerializer):
    items           = SaleReturnItemSerializer(many=True, read_only=True)
    sale_number     = serializers.CharField(source='sale.sale_number', read_only=True)
    customer_name   = serializers.CharField(source='customer.full_name', read_only=True, default=None)
    branch_name     = serializers.CharField(source='branch.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default=None)

    class Meta:
        model  = SaleReturn
        fields = [
            'id', 'return_number', 'sale', 'sale_number', 'customer', 'customer_name',
            'branch', 'branch_name', 'reason', 'value', 'debt_reduction', 'refund_amount',
            'refund_method', 'tax_amount', 'return_date', 'items',
            'created_by_name', 'created_at',
        ]


class ReturnItemInputSerializer(serializers.Serializer):
    sale_item_id = serializers.UUIDField()
    quantity     = serializers.IntegerField(min_value=0)
    restock      = serializers.BooleanField(default=True)


class CreateReturnSerializer(serializers.Serializer):
    items         = ReturnItemInputSerializer(many=True)
    refund_method = serializers.ChoiceField(choices=SaleReturn.REFUND_CHOICES, required=False, allow_null=True)
    reason        = serializers.CharField(required=False, allow_blank=True, max_length=500)


class SaleDetailSerializer(serializers.ModelSerializer):
    items            = SaleItemSerializer(many=True, read_only=True)
    returns          = SaleReturnSerializer(many=True, read_only=True)
    payments         = PaymentSerializer(many=True, read_only=True)
    installment_plan = InstallmentPlanSerializer(read_only=True)
    customer_name    = serializers.CharField(
        source='customer.full_name', read_only=True
    )
    branch_name = serializers.CharField(
        source='branch.name', read_only=True
    )
    module_name = serializers.CharField(
        source='module.name', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )

    class Meta:
        model  = Sale
        fields = [
            'id', 'sale_number', 'branch', 'branch_name',
            'module', 'module_name', 'customer', 'customer_name',
            'subtotal', 'discount_amount', 'total_amount',
            'amount_paid', 'balance_due', 'payment_status',
            'tax_rate', 'tax_amount', 'returned_amount',
            'has_installment_plan', 'installment_plan',
            'sale_date', 'notes', 'items', 'payments', 'returns', 'created_by_name', 'created_at',
        ]


class SaleItemInputSerializer(serializers.Serializer):
    product_id      = serializers.UUIDField()
    quantity        = serializers.IntegerField(min_value=1)
    price_type      = serializers.ChoiceField(
        choices=['retail', 'wholesale', 'custom']
    )
    unit_price      = serializers.DecimalField(max_digits=15, decimal_places=2)
    discount_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, default=0
    )


class CreateSaleSerializer(serializers.Serializer):
    branch_id       = serializers.UUIDField()
    module_id       = serializers.UUIDField()
    customer_id     = serializers.UUIDField(required=False, allow_null=True)
    # A customer typed at checkout but never picked from the search list or
    # saved via "+ Add". Used only when customer_id is absent: the sale
    # attaches to a matching existing customer, or creates one.
    new_customer_name  = serializers.CharField(max_length=150, required=False, allow_blank=True)
    new_customer_phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    items           = SaleItemInputSerializer(many=True, min_length=1)
    discount_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, default=0
    )
    payment_method  = serializers.ChoiceField(
        choices=['cash', 'transfer', 'pos']
    )
    amount_paid     = serializers.DecimalField(max_digits=15, decimal_places=2)
    reference_number = serializers.CharField(required=False, allow_blank=True)
    notes           = serializers.CharField(required=False, allow_blank=True)

    def validate_branch_id(self, value):
        from core.models import Branch
        business = self.context['request'].user.business
        if not Branch.objects.filter(
            id=value, business=business, is_deleted=False
        ).exists():
            raise serializers.ValidationError('Branch not found.')
        return value

    def validate_module_id(self, value):
        from core.models import BusinessModule
        business = self.context['request'].user.business
        if not BusinessModule.objects.filter(
            business=business, module_id=value, is_active=True
        ).exists():
            raise serializers.ValidationError(
                'This module is not active for your business.'
            )
        return value

    def validate_amount_paid(self, value):
        if value < 0:
            raise serializers.ValidationError(
                'Amount paid cannot be negative.'
            )
        return value

    def validate_items(self, items):
        from core.models import Product
        business = self.context['request'].user.business
        for item in items:
            try:
                product = Product.objects.get(
                    id=item['product_id'],
                    business=business,
                    is_deleted=False,
                    is_active=True,
                )
                item['product_name'] = product.name
                item['unit_type']    = product.unit_type or ''
            except Product.DoesNotExist:
                raise serializers.ValidationError(
                    f"Product {item['product_id']} not found."
                )
        return items

    def validate(self, data):
        from decimal import Decimal
        from core.models import Product, BranchInventory
        business = self.context['request'].user.business
        branch_id = data['branch_id']
        module_id = data['module_id']

        total_amount = Decimal('0')
        for item in data['items']:
            product = Product.objects.get(id=item['product_id'], business=business)
            if product.module_id != module_id:
                raise serializers.ValidationError({
                    'items': f'{product.name} does not belong to the selected module.'
                })

            inventory = BranchInventory.objects.filter(
                business=business,
                branch_id=branch_id,
                product=product,
            ).first()
            if not inventory:
                raise serializers.ValidationError({
                    'items': f'{product.name} has no stock record for this branch. Restock it from Products first.'
                })
            if inventory.quantity_in_stock < item['quantity']:
                raise serializers.ValidationError({
                    'items': f"Insufficient stock for {product.name}. Available: {inventory.quantity_in_stock}, requested: {item['quantity']}."
                })

            total_amount += (
                Decimal(str(item['unit_price'])) * item['quantity']
                - Decimal(str(item.get('discount_amount', 0)))
            )

        total_amount -= Decimal(str(data.get('discount_amount', 0)))
        if (data['amount_paid'] < total_amount and not data.get('customer_id')
                and not (data.get('new_customer_name') or '').strip()):
            raise serializers.ValidationError({
                'customer_id': 'Attach a customer before recording a partial or unpaid sale.'
            })

        return data

class AddPaymentSerializer(serializers.Serializer):
    payment_method   = serializers.ChoiceField(
        choices=['cash', 'transfer', 'pos']
    )
    amount           = serializers.DecimalField(max_digits=15, decimal_places=2)
    reference_number = serializers.CharField(required=False, allow_blank=True)
    notes            = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'Payment amount must be greater than zero.'
            )
        return value