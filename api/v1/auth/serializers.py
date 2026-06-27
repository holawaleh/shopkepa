import re
from rest_framework import serializers
from core.models import User


class RegisterSerializer(serializers.Serializer):
    business_name = serializers.CharField(max_length=200)
    owner_name    = serializers.CharField(max_length=150)
    username      = serializers.CharField(max_length=50)
    phone_number  = serializers.CharField(max_length=20)
    email         = serializers.EmailField()
    password      = serializers.CharField(min_length=6, write_only=True)
    location      = serializers.CharField()

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

    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError(
                'Password must be at least 6 characters.'
            )
        return value


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=50)
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