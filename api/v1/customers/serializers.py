from rest_framework import serializers
from core.models import Customer, CustomerNote


class CustomerNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )

    class Meta:
        model  = CustomerNote
        fields = ['id', 'note', 'created_at', 'created_by_name']


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Customer
        fields = [
            'id', 'full_name', 'phone_number', 'email',
            'address', 'business_name', 'customer_type',
            'loyalty_tag', 'lifetime_spend',
            'total_outstanding_debt', 'last_purchase_date',
            'is_active', 'created_at',
        ]
        read_only_fields = [
            'id', 'loyalty_tag', 'lifetime_spend',
            'total_outstanding_debt', 'last_purchase_date', 'created_at'
        ]


class CustomerDetailSerializer(serializers.ModelSerializer):
    notes = CustomerNoteSerializer(many=True, read_only=True)
    total_purchases = serializers.SerializerMethodField()

    class Meta:
        model  = Customer
        fields = [
            'id', 'full_name', 'phone_number', 'email',
            'address', 'business_name', 'customer_type',
            'loyalty_tag', 'lifetime_spend',
            'total_outstanding_debt', 'last_purchase_date',
            'is_active', 'created_at', 'notes', 'total_purchases',
        ]

    def get_total_purchases(self, obj):
        return obj.sales.filter(is_deleted=False).count()


class CreateCustomerSerializer(serializers.Serializer):
    full_name     = serializers.CharField(max_length=150)
    phone_number  = serializers.CharField(max_length=20, required=False, allow_blank=True)
    email         = serializers.EmailField(required=False, allow_blank=True)
    address       = serializers.CharField(required=False, allow_blank=True)
    business_name = serializers.CharField(max_length=200, required=False, allow_blank=True)
    customer_type = serializers.ChoiceField(
        choices=['retail', 'wholesale'], default='retail'
    )

    def validate_phone_number(self, value):
        if not value:
            return value
        business = self.context['request'].user.business
        if Customer.objects.filter(
            business=business,
            phone_number=value,
            is_deleted=False
        ).exists():
            raise serializers.ValidationError(
                'A customer with this phone number already exists.'
            )
        return value


class UpdateCustomerSerializer(serializers.Serializer):
    full_name     = serializers.CharField(max_length=150, required=False)
    phone_number  = serializers.CharField(max_length=20, required=False)
    email         = serializers.EmailField(required=False)
    address       = serializers.CharField(required=False)
    business_name = serializers.CharField(max_length=200, required=False)
    customer_type = serializers.ChoiceField(
        choices=['retail', 'wholesale'], required=False
    )


class CustomerNoteCreateSerializer(serializers.Serializer):
    note = serializers.CharField()