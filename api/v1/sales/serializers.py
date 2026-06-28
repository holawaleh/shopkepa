from rest_framework import serializers
from core.models import Sale, SaleItem, Payment, InstallmentPlan


class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SaleItem
        fields = [
            'id', 'product', 'product_name', 'quantity',
            'unit_type', 'price_type', 'unit_price',
            'discount_amount', 'line_total',
        ]


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Payment
        fields = [
            'id', 'payment_method', 'amount',
            'payment_date', 'reference_number', 'tranche_number',
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
            'has_installment_plan', 'sale_date', 'notes',
            'created_by_name', 'created_at',
        ]


class SaleDetailSerializer(serializers.ModelSerializer):
    items            = SaleItemSerializer(many=True, read_only=True)
    payments         = PaymentSerializer(many=True, read_only=True)
    installment_plan = InstallmentPlanSerializer(read_only=True)
    customer_name    = serializers.CharField(
        source='customer.full_name', read_only=True
    )
    branch_name = serializers.CharField(
        source='branch.name', read_only=True
    )

    class Meta:
        model  = Sale
        fields = [
            'id', 'sale_number', 'branch', 'branch_name',
            'module', 'customer', 'customer_name',
            'subtotal', 'discount_amount', 'total_amount',
            'amount_paid', 'balance_due', 'payment_status',
            'has_installment_plan', 'installment_plan',
            'sale_date', 'notes', 'items', 'payments', 'created_at',
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