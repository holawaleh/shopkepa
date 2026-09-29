from decimal import Decimal

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
    outstanding = serializers.SerializerMethodField()

    class Meta:
        model  = Customer
        fields = [
            'id', 'full_name', 'phone_number', 'email',
            'address', 'business_name', 'customer_type',
            'loyalty_tag', 'lifetime_spend',
            'total_outstanding_debt', 'last_purchase_date',
            'is_active', 'created_at', 'notes', 'total_purchases',
            'outstanding',
        ]

    def get_total_purchases(self, obj):
        return obj.sales.filter(is_deleted=False).count()

    def get_outstanding(self, obj):
        """Everything this customer still owes, item by item, computed from
        the sales and job cards themselves (the record of truth) rather
        than the running total_outstanding_debt counter."""
        items = []
        for sale in obj.sales.filter(is_deleted=False, balance_due__gt=0).order_by('sale_date', 'created_at'):
            items.append({
                'type': 'sale', 'id': str(sale.id), 'reference': sale.sale_number,
                'date': sale.sale_date, 'total': sale.total_amount,
                'paid': sale.amount_paid, 'balance': sale.balance_due,
            })
        jobs = obj.job_cards.filter(is_deleted=False, balance_due__gt=0).exclude(status='cancelled')
        for job in jobs.order_by('intake_date', 'created_at'):
            items.append({
                'type': 'job_card', 'id': str(job.id), 'reference': job.job_number,
                'date': job.intake_date, 'total': job.total_charge,
                'paid': job.amount_paid, 'balance': job.balance_due,
            })
        sales_total = sum((i['balance'] for i in items if i['type'] == 'sale'), Decimal('0'))
        jobs_total = sum((i['balance'] for i in items if i['type'] == 'job_card'), Decimal('0'))
        return {
            'total': sales_total + jobs_total,
            'sales_total': sales_total,
            'job_cards_total': jobs_total,
            'items': items,
        }


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