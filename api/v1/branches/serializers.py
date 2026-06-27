from rest_framework import serializers
from core.models import Branch


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = [
            'id', 'name', 'address', 'phone_number',
            'is_main_branch', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'is_main_branch', 'created_at']


class CreateBranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ['name', 'address', 'phone_number']

    def validate_name(self, value):
        business = self.context['request'].user.business
        if Branch.objects.filter(
            business=business,
            name__iexact=value,
            is_deleted=False
        ).exists():
            raise serializers.ValidationError(
                'A branch with this name already exists.'
            )
        return value