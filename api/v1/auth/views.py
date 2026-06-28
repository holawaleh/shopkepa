from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.utils import timezone

from core.services.auth_service import register_business
from core.utils import log_audit, get_client_ip
from .serializers import (
    RegisterSerializer, LoginSerializer,
    UserSerializer, ChangePasswordSerializer
)


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access':  str(refresh.access_token),
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'register'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = register_business(serializer.validated_data)
        tokens = get_tokens_for_user(user)

        log_audit(
            business_id=user.business.id,
            user_id=user.id,
            action='CREATE',
            table_name='businesses',
            record_id=user.business.id,
            new_values={'business_name': user.business.name},
            ip_address=get_client_ip(request),
        )

        return Response({
            'message': 'Business registered successfully.',
            'user': UserSerializer(user).data,
            'tokens': tokens,
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        user = authenticate(request, username=username, password=password)

        if not user:
            return Response(
                {'error': 'Invalid username or password.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {'error': 'Your account has been deactivated. Contact your business owner.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if not user.business.is_active:
            return Response(
                {'error': 'Your business account is inactive. Contact ShopKepa support.'},
                status=status.HTTP_403_FORBIDDEN
            )

        user.last_login_at = timezone.now()
        user.save(update_fields=['last_login_at'])

        tokens = get_tokens_for_user(user)

        log_audit(
            business_id=user.business.id,
            user_id=user.id,
            action='LOGIN',
            table_name='users',
            record_id=user.id,
            ip_address=get_client_ip(request),
        )

        return Response({
            'message': 'Login successful.',
            'user': UserSerializer(user).data,
            'tokens': tokens,
        }, status=status.HTTP_200_OK)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            token = RefreshToken(refresh_token)
            token.blacklist()

            log_audit(
                business_id=request.user.business.id,
                user_id=request.user.id,
                action='LOGOUT',
                table_name='users',
                record_id=request.user.id,
                ip_address=get_client_ip(request),
            )

            return Response(
                {'message': 'Logged out successfully.'},
                status=status.HTTP_200_OK
            )
        except Exception:
            return Response(
                {'error': 'Invalid or expired token.'},
                status=status.HTTP_400_BAD_REQUEST
            )


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not user.check_password(serializer.validated_data['current_password']):
            return Response(
                {'error': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(serializer.validated_data['new_password'])
        user.save()

        return Response(
            {'message': 'Password changed successfully.'},
            status=status.HTTP_200_OK
        )
        