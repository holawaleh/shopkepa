import re
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from core.models import User, UserBranch


class RegisterSerializer(serializers.Serializer):
    business_name = serializers.CharField(max_length=200)
    first_name    = serializers.CharField(max_length=75)
    last_name     = serializers.CharField(max_length=75, required=False, default='')
    phone         = serializers.CharField(max_length=20)
    email         = serializers.EmailField()
    password      = serializers.CharField(min_length=6, write_only=True)
    location      = serializers.CharField(required=False, default='')
    logo          = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_logo(self, value):
        if value and not value.startswith('data:image/'):
            raise serializers.ValidationError('Logo must be an uploaded image.')
        if value and len(value) > 700_000:
            raise serializers.ValidationError('Logo image is too large. Please use a smaller image (under ~500KB).')
        return value

    def validate_phone(self, value):
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

    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError(
                'Password must be at least 6 characters.'
            )
        return value


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    business_name    = serializers.SerializerMethodField()
    business_id      = serializers.SerializerMethodField()
    business_logo    = serializers.SerializerMethodField()
    business_phone   = serializers.SerializerMethodField()
    business_email   = serializers.SerializerMethodField()
    business_address = serializers.SerializerMethodField()
    branch_ids       = serializers.SerializerMethodField()

    def get_business_name(self, obj):
        return obj.business.name if obj.business else None

    def get_business_id(self, obj):
        return obj.business_id

    def get_business_logo(self, obj):
        return obj.business.logo_url if obj.business else None

    def get_business_phone(self, obj):
        return obj.business.phone_number if obj.business else None

    def get_business_email(self, obj):
        return obj.business.email if obj.business else None

    def get_business_address(self, obj):
        return obj.business.address if obj.business else None

    def get_branch_ids(self, obj):
        return list(
            UserBranch.objects.filter(user=obj)
            .values_list('branch_id', flat=True)
        )

    class Meta:
        model  = User
        fields = [
            'id', 'full_name', 'username',
            'phone_number', 'email', 'location',
            'role', 'permissions', 'business_id', 'business_name', 'business_logo',
            'business_phone', 'business_email', 'business_address',
            'branch_ids', 'is_active', 'created_at',
        ]


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password     = serializers.CharField(min_length=6, write_only=True)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)

    def validate_new_password(self, value):
        validate_password(value)
        return value
