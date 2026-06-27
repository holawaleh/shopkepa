from rest_framework import serializers
from core.models import Expense, ExpenseCategory


class ExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = ExpenseCategory
        fields = ['id', 'name', 'is_custom']


class ExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    branch_name   = serializers.CharField(source='branch.name',   read_only=True)
    created_by_name = serializers.CharField(
        source='created_by.full_name', read_only=True
    )

    class Meta:
        model  = Expense
        fields = [
            'id', 'category', 'category_name', 'branch', 'branch_name',
            'amount', 'description', 'expense_date', 'receipt_url',
            'created_by_name', 'created_at',
        ]
        read_only_fields = ['id', 'expense_date', 'created_at']


class CreateExpenseSerializer(serializers.Serializer):
    branch_id   = serializers.UUIDField()
    category_id = serializers.UUIDField()
    amount      = serializers.DecimalField(max_digits=15, decimal_places=2)
    description = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                'Amount must be greater than zero.'
            )
        return value

    def validate_branch_id(self, value):
        from core.models import Branch
        business = self.context['request'].user.business
        if not Branch.objects.filter(
            id=value,
            business=business,
            is_deleted=False
        ).exists():
            raise serializers.ValidationError('Branch not found.')
        return value

    def validate_category_id(self, value):
        business = self.context['request'].user.business
        if not ExpenseCategory.objects.filter(
            id=value,
            is_active=True
        ).filter(
            business=business
        ).exists() and not ExpenseCategory.objects.filter(
            id=value,
            is_active=True,
            business__isnull=True
        ).exists():
            raise serializers.ValidationError('Expense category not found.')
        return value


class CreateCategorySerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)

    def validate_name(self, value):
        business = self.context['request'].user.business
        if ExpenseCategory.objects.filter(
            business=business,
            name__iexact=value
        ).exists():
            raise serializers.ValidationError(
                'A category with this name already exists.'
            )
        return value