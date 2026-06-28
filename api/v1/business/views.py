from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from core.models import BusinessModule
from core.permissions import IsOwner
from core.utils import log_audit, get_client_ip
from .serializers import (
    BusinessSerializer, UpdateBusinessSerializer,
    BusinessSettingsSerializer, UpdateBusinessSettingsSerializer,
    SubscriptionSerializer
)


class BusinessProfileView(APIView):

    def get_permissions(self):
        if self.request.method == 'PATCH':
            return [IsOwner()]
        return [IsAuthenticated()]

    def get(self, request):
        business = request.user.business
        # Include active modules in response
        active_modules = BusinessModule.objects.filter(
            business=business,
            is_active=True
        ).select_related('module').values_list(
            'module__code', 'module__name'
        )
        data = BusinessSerializer(business).data
        data['active_modules'] = [
            {'code': code, 'name': name}
            for code, name in active_modules
        ]
        return Response(data)

    def patch(self, request):
        business   = request.user.business
        serializer = UpdateBusinessSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data

        # Check phone uniqueness if changing
        if 'phone_number' in data:
            from core.models import Business
            if Business.objects.exclude(
                id=business.id
            ).filter(phone_number=data['phone_number']).exists():
                return Response(
                    {'error': 'This phone number is already in use.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        old_values = {
            'name':  business.name,
            'email': business.email,
        }

        for field in ['name', 'owner_name', 'phone_number', 'email', 'address']:
            if field in data:
                setattr(business, field, data[field])
        business.save()

        log_audit(
            business_id=business.id,
            user_id=request.user.id,
            action='UPDATE',
            table_name='businesses',
            record_id=business.id,
            old_values=old_values,
            new_values=data,
            ip_address=get_client_ip(request),
        )

        return Response(BusinessSerializer(business).data)


class BusinessSettingsView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        try:
            settings = request.user.business.settings
        except Exception:
            return Response(
                {'error': 'Business settings not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(BusinessSettingsSerializer(settings).data)

    def patch(self, request):
        try:
            settings = request.user.business.settings
        except Exception:
            return Response(
                {'error': 'Business settings not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = UpdateBusinessSettingsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data = serializer.validated_data

        old_custom_pricing = settings.custom_pricing_enabled

        for field in [
            'custom_pricing_enabled', 'loyalty_bronze_threshold',
            'loyalty_silver_threshold', 'loyalty_gold_threshold',
            'low_stock_alert_enabled', 'expiry_alert_days',
            'receipt_footer_message', 'currency_symbol',
        ]:
            if field in data:
                setattr(settings, field, data[field])
        settings.save()

        # Log if custom pricing was toggled
        if 'custom_pricing_enabled' in data:
            new_value = data['custom_pricing_enabled']
            if old_custom_pricing != new_value:
                log_audit(
                    business_id=request.user.business.id,
                    user_id=request.user.id,
                    action='UPDATE',
                    table_name='business_settings',
                    record_id=settings.id,
                    old_values={'custom_pricing_enabled': old_custom_pricing},
                    new_values={'custom_pricing_enabled': new_value},
                    ip_address=get_client_ip(request),
                )

        return Response(BusinessSettingsSerializer(settings).data)


class SubscriptionView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        business = request.user.business
        return Response(SubscriptionSerializer(business).data)