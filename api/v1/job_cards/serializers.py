from rest_framework import serializers
from core.models import JobCard, JobCardPart


class JobCardPartSerializer(serializers.ModelSerializer):
    class Meta:
        model  = JobCardPart
        fields = [
            'id', 'part_name', 'quantity',
            'unit_cost', 'line_total', 'supplier', 'created_at'
        ]


class JobCardSerializer(serializers.ModelSerializer):
    customer_name    = serializers.CharField(
        source='customer.full_name', read_only=True
    )
    branch_name      = serializers.CharField(
        source='branch.name', read_only=True
    )
    technician_name  = serializers.CharField(
        source='technician.full_name', read_only=True
    )
    created_by_name  = serializers.CharField(
        source='created_by.full_name', read_only=True
    )

    class Meta:
        model  = JobCard
        fields = [
            'id', 'job_number', 'branch', 'branch_name',
            'customer', 'customer_name',
            'customer_phone', 'device_description',
            'customer_complaint', 'technician', 'technician_name',
            'status', 'labour_charge', 'parts_charge',
            'total_charge', 'amount_paid', 'balance_due',
            'payment_status', 'intake_date', 'created_by_name',
            'created_at',
        ]
        read_only_fields = [
            'id', 'job_number', 'parts_charge',
            'total_charge', 'balance_due', 'intake_date', 'created_at'
        ]


class JobCardDetailSerializer(serializers.ModelSerializer):
    parts           = JobCardPartSerializer(many=True, read_only=True)
    customer_name   = serializers.CharField(
        source='customer.full_name', read_only=True
    )
    branch_name     = serializers.CharField(
        source='branch.name', read_only=True
    )
    technician_name = serializers.CharField(
        source='technician.full_name', read_only=True
    )

    class Meta:
        model  = JobCard
        fields = [
            'id', 'job_number', 'branch', 'branch_name',
            'customer', 'customer_name', 'customer_phone',
            'device_description', 'customer_complaint',
            'technician', 'technician_name', 'status',
            'technician_notes', 'labour_charge', 'parts_charge',
            'total_charge', 'amount_paid', 'balance_due',
            'payment_status', 'payment_method',
            'warranty_days', 'collected_at',
            'intake_date', 'created_at', 'parts',
        ]


class CreateJobCardSerializer(serializers.Serializer):
    branch_id          = serializers.UUIDField()
    customer_id        = serializers.UUIDField(required=False, allow_null=True)
    customer_name      = serializers.CharField(max_length=150)
    customer_phone     = serializers.CharField(
        max_length=20, required=False, allow_blank=True
    )
    device_description = serializers.CharField(max_length=200)
    customer_complaint = serializers.CharField()
    technician_id      = serializers.UUIDField(required=False, allow_null=True)
    labour_charge      = serializers.DecimalField(
        max_digits=15, decimal_places=2, default=0
    )
    technician_notes   = serializers.CharField(
        required=False, allow_blank=True
    )

    def validate_branch_id(self, value):
        from core.models import Branch
        business = self.context['request'].user.business
        if not Branch.objects.filter(
            id=value, business=business, is_deleted=False
        ).exists():
            raise serializers.ValidationError('Branch not found.')
        return value

    def validate_technician_id(self, value):
        if not value:
            return value
        from core.models import User
        business = self.context['request'].user.business
        if not User.objects.filter(
            id=value, business=business, is_deleted=False
        ).exists():
            raise serializers.ValidationError('Technician not found.')
        return value


class UpdateJobCardSerializer(serializers.Serializer):
    STATUS_CHOICES = [
        'received', 'diagnosing', 'awaiting_parts',
        'in_repair', 'ready', 'collected', 'cancelled'
    ]
    PAYMENT_CHOICES = ['cash', 'transfer', 'pos']

    status           = serializers.ChoiceField(
        choices=STATUS_CHOICES, required=False
    )
    technician_id    = serializers.UUIDField(required=False, allow_null=True)
    technician_notes = serializers.CharField(
        required=False, allow_blank=True
    )
    labour_charge    = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False
    )
    warranty_days    = serializers.IntegerField(
        min_value=1, required=False, allow_null=True
    )


class AddJobCardPartSerializer(serializers.Serializer):
    part_name  = serializers.CharField(max_length=200)
    quantity   = serializers.IntegerField(min_value=1, default=1)
    unit_cost  = serializers.DecimalField(max_digits=15, decimal_places=2)
    supplier   = serializers.CharField(
        max_length=150, required=False, allow_blank=True
    )

    def validate_unit_cost(self, value):
        if value < 0:
            raise serializers.ValidationError(
                'Unit cost cannot be negative.'
            )
        return value


class JobCardPaymentSerializer(serializers.Serializer):
    payment_method   = serializers.ChoiceField(
        choices=['cash', 'transfer', 'pos']
    )
    amount           = serializers.DecimalField(
        max_digits=15, decimal_places=2
    )
    reference_number = serializers.CharField(
        required=False, allow_blank=True
    )

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'Payment amount must be greater than zero.'
            )
        return value