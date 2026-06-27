from rest_framework import serializers
from core.models import User, Branch, UserBranch
import re


class StaffBranchSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Branch
        fields = ['id', 'name', 'is_main_branch']


class StaffSerializer(serializers.ModelSerializer):
    branches = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            'id', 'full_name', 'username', 'phone_number',
            'email', 'role', 'is_active', 'created_at', 'branches'
        ]

    def get_branches(self, obj):
        user_branches = UserBranch.objects.filter(
            user=obj
        ).select_related('branch')
        return StaffBranchSerializer(
            [ub.branch for ub in user_branches], many=True
        ).data


class CreateStaffSerializer(serializers.Serializer):
    full_name    = serializers.CharField(max_length=150)
    username     = serializers.CharField(max_length=50)
    phone_number = serializers.CharField(max_length=20)
    email        = serializers.EmailField()
    password     = serializers.CharField(min_length=6, write_only=True)
    role         = serializers.ChoiceField(choices=['manager', 'cashier'])
    branch_ids   = serializers.ListField(
        child=serializers.UUIDField(), min_length=1
    )

    def validate_username(self, value):
        value = value.lower().strip()
        if len(value) < 4:
            raise serializers.ValidationError(
                'Username must be at least 4 characters.'
            )
        if not re.match(r'^[a-z0-9_]+$', value):
            raise serializers.ValidationError(
                'Username may only contain lowercase letters, numbers, and underscores.'
            )
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError(
                'This username is already taken.'
            )
        return value

    def validate_phone_number(self, value):
        if User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError(
                'An account with this phone number already exists.'
            )
        return value

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                'An account with this email already exists.'
            )
        return value

    def validate_branch_ids(self, value):
        business = self.context['request'].user.business
        valid_branches = Branch.objects.filter(
            business=business,
            id__in=value,
            is_deleted=False
        )
        if len(valid_branches) != len(value):
            raise serializers.ValidationError(
                'One or more branch IDs are invalid.'
            )
        return value


class UpdateStaffSerializer(serializers.Serializer):
    full_name  = serializers.CharField(max_length=150, required=False)
    role       = serializers.ChoiceField(
        choices=['manager', 'cashier'], required=False
    )
    branch_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False
    )