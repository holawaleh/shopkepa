from rest_framework import serializers
from core.models import Product, ProductAttribute, BranchInventory, StockAdjustment


class ProductAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ProductAttribute
        fields = ['id', 'attribute_key', 'attribute_value']


class BranchStockSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model  = BranchInventory
        fields = [
            'id', 'branch', 'branch_name',
            'quantity_in_stock', 'last_restocked_at'
        ]


class ProductSerializer(serializers.ModelSerializer):
    attributes   = ProductAttributeSerializer(many=True, read_only=True)
    module_name  = serializers.CharField(source='module.name', read_only=True)
    stock        = serializers.SerializerMethodField()

    class Meta:
        model  = Product
        fields = [
            'id', 'name', 'description', 'sku', 'barcode',
            'module', 'module_name', 'unit_type',
            'wholesale_price', 'retail_price', 'cost_price',
            'reorder_level', 'is_active',
            'attributes', 'stock', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_stock(self, obj):
        branch_id = self.context.get('branch_id')
        if branch_id:
            inventory = obj.inventory.filter(branch_id=branch_id).first()
            return inventory.quantity_in_stock if inventory else 0
        return BranchStockSerializer(
            obj.inventory.all(), many=True
        ).data


class CreateProductSerializer(serializers.Serializer):
    name            = serializers.CharField(max_length=200)
    description     = serializers.CharField(required=False, allow_blank=True)
    sku             = serializers.CharField(required=False, allow_blank=True)
    module_id       = serializers.UUIDField()
    unit_type       = serializers.CharField(required=False, allow_blank=True)
    wholesale_price = serializers.DecimalField(max_digits=15, decimal_places=2)
    retail_price    = serializers.DecimalField(max_digits=15, decimal_places=2)
    cost_price      = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False
    )
    reorder_level   = serializers.IntegerField(default=0)
    attributes      = serializers.ListField(
        child=serializers.DictField(), required=False, default=[]
    )

    def validate_module_id(self, value):
        from core.models import BusinessModule
        business = self.context['request'].user.business
        if not BusinessModule.objects.filter(
            business=business,
            module_id=value,
            is_active=True
        ).exists():
            raise serializers.ValidationError(
                'This module is not active for your business.'
            )
        return value

    def validate_retail_price(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'Retail price must be greater than zero.'
            )
        return value

    def validate_attributes(self, value):
        for attr in value:
            if 'attribute_key' not in attr or 'attribute_value' not in attr:
                raise serializers.ValidationError(
                    'Each attribute must have attribute_key and attribute_value.'
                )
        return value


class UpdateProductSerializer(serializers.Serializer):
    name            = serializers.CharField(max_length=200, required=False)
    description     = serializers.CharField(required=False, allow_blank=True)
    sku             = serializers.CharField(required=False, allow_blank=True)
    barcode         = serializers.CharField(required=False, allow_blank=True)
    unit_type       = serializers.CharField(required=False, allow_blank=True)
    wholesale_price = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False
    )
    retail_price    = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False
    )
    cost_price      = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False
    )
    reorder_level   = serializers.IntegerField(required=False)
    is_active       = serializers.BooleanField(required=False)
    attributes      = serializers.ListField(
        child=serializers.DictField(), required=False
    )

class StockAdjustmentSerializer(serializers.Serializer):
    branch_id       = serializers.UUIDField()
    adjustment_type = serializers.ChoiceField(choices=[
        'restock', 'manual_increase',
        'manual_decrease', 'damage',
        'return', 'opening_stock'
    ])
    quantity_change = serializers.IntegerField()
    reason          = serializers.CharField(required=False, allow_blank=True)

    def validate_quantity_change(self, value):
        if value == 0:
            raise serializers.ValidationError(
                'Quantity change cannot be zero.'
            )
        return value

    def validate(self, data):
        if data['adjustment_type'] in (
            'manual_decrease', 'damage', 'return'
        ) and data['quantity_change'] > 0:
            data['quantity_change'] = -abs(data['quantity_change'])
        elif data['adjustment_type'] in (
            'restock', 'manual_increase', 'opening_stock'
        ) and data['quantity_change'] < 0:
            data['quantity_change'] = abs(data['quantity_change'])
        return data