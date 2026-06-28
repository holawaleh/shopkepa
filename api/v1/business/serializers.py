from rest_framework import serializers
from core.models import Business, BusinessSettings


class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Business
        fields = [
            'id', 'name', 'owner_name', 'phone_number',
            'email', 'address', 'logo_url',
            'subscription_tier', 'subscription_model',
            'subscription_expires_at', 'ai_queries_used',
            'ai_queries_limit', 'is_active', 'created_at',
        ]
        read_only_fields = [
            'id', 'subscription_tier', 'subscription_model',
            'subscription_expires_at', 'ai_queries_used',
            'ai_queries_limit', 'is_active', 'created_at',
        ]


class UpdateBusinessSerializer(serializers.Serializer):
    name         = serializers.CharField(max_length=200, required=False)
    owner_name   = serializers.CharField(max_length=150, required=False)
    phone_number = serializers.CharField(max_length=20,  required=False)
    email        = serializers.EmailField(required=False)
    address      = serializers.CharField(required=False, allow_blank=True)


class BusinessSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model  = BusinessSettings
        fields = [
            'id',
            'custom_pricing_enabled',
            'loyalty_bronze_threshold',
            'loyalty_silver_threshold',
            'loyalty_gold_threshold',
            'low_stock_alert_enabled',
            'expiry_alert_days',
            'receipt_footer_message',
            'currency_symbol',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']


class UpdateBusinessSettingsSerializer(serializers.Serializer):
    custom_pricing_enabled   = serializers.BooleanField(required=False)
    loyalty_bronze_threshold = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False
    )
    loyalty_silver_threshold = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False
    )
    loyalty_gold_threshold   = serializers.DecimalField(
        max_digits=15, decimal_places=2, required=False
    )
    low_stock_alert_enabled  = serializers.BooleanField(required=False)
    expiry_alert_days        = serializers.IntegerField(
        min_value=1, max_value=365, required=False
    )
    receipt_footer_message   = serializers.CharField(
        required=False, allow_blank=True
    )
    currency_symbol          = serializers.CharField(
        max_length=5, required=False
    )

    def validate(self, data):
        # Ensure silver > bronze and gold > silver
        bronze = data.get('loyalty_bronze_threshold')
        silver = data.get('loyalty_silver_threshold')
        gold   = data.get('loyalty_gold_threshold')

        if bronze and silver and silver <= bronze:
            raise serializers.ValidationError(
                'Silver threshold must be greater than bronze threshold.'
            )
        if silver and gold and gold <= silver:
            raise serializers.ValidationError(
                'Gold threshold must be greater than silver threshold.'
            )
        return data


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Business
        fields = [
            'subscription_tier',
            'subscription_model',
            'subscription_expires_at',
            'ai_queries_used',
            'ai_queries_limit',
        ]