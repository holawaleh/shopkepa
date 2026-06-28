import re
from rest_framework import serializers
from core.models import User


class RegisterSerializer(serializers.Serializer):
    business_name = serializers.CharField(max_length=200)
    first_name    = serializers.CharField(max_length=75)
    last_name     = serializers.CharField(max_length=75, required=False, default='')
    phone         = serializers.CharField(max_length=20)
    email         = serializers.EmailField()
    password      = serializers.CharField(min_length=6, write_only=True)
    location      = serializers.CharField(required=False, default='')

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
    business_name = serializers.CharField(
        source='business.name', read_only=True
    )
    business_id = serializers.UUIDField(
        source='business.id', read_only=True
    )

    class Meta:
        model  = User
        fields = [
            'id', 'full_name', 'username',
            'phone_number', 'email', 'location',
            'role', 'business_id', 'business_name',
            'is_active', 'created_at',
        ]


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password     = serializers.CharField(min_length=6, write_only=True)
