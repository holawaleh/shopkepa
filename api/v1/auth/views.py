from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.conf import settings
from django.utils import timezone
from django.core.mail import send_mail
from django.db import transaction
from datetime import timedelta
import hashlib
import logging
import secrets

from core.models import User, PasswordResetToken
from core.services.auth_service import register_business
from core.utils import log_audit, get_client_ip
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from .serializers import (
    RegisterSerializer, LoginSerializer,
    UserSerializer, ChangePasswordSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
)

logger = logging.getLogger(__name__)

REFRESH_COOKIE = 'shopkepa_refresh'
COOKIE_MAX_AGE = 7 * 24 * 60 * 60  # 7 days in seconds


def _get_tokens(user):
    refresh = RefreshToken.for_user(user)
    return str(refresh), str(refresh.access_token)


def _set_refresh_cookie(response, token):
    """Attach the refresh token as an httpOnly cookie appropriate for the env."""
    is_prod = not settings.DEBUG
    response.set_cookie(
        REFRESH_COOKIE,
        token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=is_prod,
        samesite='None' if is_prod else 'Lax',
        path='/api/v1/auth/',
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(REFRESH_COOKIE, path='/api/v1/auth/')


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'register'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = register_business(serializer.validated_data)
        refresh_token, access_token = _get_tokens(user)

        log_audit(
            business_id=user.business.id,
            user_id=user.id,
            action='CREATE',
            table_name='businesses',
            record_id=user.business.id,
            new_values={'business_name': user.business.name},
            ip_address=get_client_ip(request),
        )

        response = Response({
            'message': 'Business registered successfully.',
            'access': access_token,
            'user': UserSerializer(user).data,
        }, status=status.HTTP_201_CREATED)
        _set_refresh_cookie(response, refresh_token)
        return response


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email    = serializer.validated_data['email'].lower().strip()
        password = serializer.validated_data['password']

        # Look up user by email then authenticate via username
        try:
            user_obj = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid email or password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user_obj.check_password(password):
            return Response(
                {'error': 'Invalid email or password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user_obj.is_active:
            return Response(
                {'error': 'Your account has been deactivated. Contact your business owner.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user_obj.business.is_active:
            return Response(
                {'error': 'Your business account is inactive. Contact ShopKepa support.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        user_obj.last_login_at = timezone.now()
        user_obj.save(update_fields=['last_login_at'])

        refresh_token, access_token = _get_tokens(user_obj)

        log_audit(
            business_id=user_obj.business.id,
            user_id=user_obj.id,
            action='LOGIN',
            table_name='users',
            record_id=user_obj.id,
            ip_address=get_client_ip(request),
        )

        response = Response({
            'message': 'Login successful.',
            'access': access_token,
            'user': UserSerializer(user_obj).data,
        }, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, refresh_token)
        return response


class TokenRefreshCookieView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        raw_token = request.COOKIES.get(REFRESH_COOKIE)
        if not raw_token:
            return Response(
                {'error': 'No refresh token found.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        try:
            refresh = RefreshToken(raw_token)
            access = str(refresh.access_token)

            response = Response({'access': access})

            # Rotate refresh token if enabled
            if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
                try:
                    refresh.blacklist()
                except AttributeError:
                    pass
                user_id = refresh.get('user_id')
                user = User.objects.get(pk=user_id)
                new_refresh = RefreshToken.for_user(user)
                _set_refresh_cookie(response, str(new_refresh))

            return response
        except (TokenError, User.DoesNotExist):
            resp = Response(
                {'error': 'Invalid or expired refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_refresh_cookie(resp)
            return resp


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw_token = request.COOKIES.get(REFRESH_COOKIE) or request.data.get('refresh_token')
        if raw_token:
            try:
                RefreshToken(raw_token).blacklist()
            except Exception:
                pass

        log_audit(
            business_id=request.user.business.id,
            user_id=request.user.id,
            action='LOGOUT',
            table_name='users',
            record_id=request.user.id,
            ip_address=get_client_ip(request),
        )

        response = Response({'message': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        _clear_refresh_cookie(response)
        return response


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
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data['new_password'])
        user.save()

        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'message': 'If an account exists for that email, reset instructions have been sent.'},
                status=status.HTTP_200_OK,
            )

        email = serializer.validated_data['email'].lower().strip()
        user = User.objects.filter(
            email=email,
            is_deleted=False,
            is_active=True,
        ).select_related('business').first()

        if user:
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
            now = timezone.now()
            PasswordResetToken.objects.filter(
                user=user,
                used_at__isnull=True,
            ).update(used_at=now)
            PasswordResetToken.objects.create(
                user=user,
                token_hash=token_hash,
                expires_at=now + timedelta(minutes=30),
                request_ip=get_client_ip(request),
            )

            reset_url = f'{settings.FRONTEND_URL}/reset-password?token={raw_token}'
            try:
                send_mail(
                    subject='Reset your ShopKepa password',
                    message=(
                        f'Hello {user.full_name},\n\n'
                        f'Use this link to reset your ShopKepa password:\n{reset_url}\n\n'
                        'This link expires in 30 minutes and can only be used once. '
                        'If you did not request this, you can ignore this email.\n\n'
                        'ShopKepa'
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=False,
                )
            except Exception:
                logger.exception('Could not send password reset email for user %s', user.id)

            log_audit(
                business_id=user.business_id,
                user_id=user.id,
                action='PASSWORD_RESET_REQUEST',
                table_name='users',
                record_id=user.id,
                ip_address=get_client_ip(request),
            )

        return Response(
            {'message': 'If an account exists for that email, reset instructions have been sent.'},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        raw_token = serializer.validated_data['token']
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
        now = timezone.now()

        try:
            reset_token = PasswordResetToken.objects.select_for_update().select_related(
                'user', 'user__business'
            ).get(token_hash=token_hash)
        except PasswordResetToken.DoesNotExist:
            return Response(
                {'error': 'This password reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if reset_token.used_at or reset_token.expires_at <= now:
            return Response(
                {'error': 'This password reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = reset_token.user
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password', 'updated_at'])
        reset_token.used_at = now
        reset_token.save(update_fields=['used_at'])

        # Revoke existing refresh sessions so the reset takes effect everywhere.
        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)

        log_audit(
            business_id=user.business_id,
            user_id=user.id,
            action='PASSWORD_RESET',
            table_name='users',
            record_id=user.id,
            ip_address=get_client_ip(request),
        )

        return Response({'message': 'Password reset successfully. You can now sign in.'})
