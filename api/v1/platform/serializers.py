from rest_framework import serializers

from core.models import Business


class UpdateBusinessSerializer(serializers.Serializer):
    """What the platform admin may change on a business."""
    is_active               = serializers.BooleanField(required=False)
    subscription_tier       = serializers.ChoiceField(choices=Business.TIER_CHOICES, required=False)
    subscription_model      = serializers.ChoiceField(choices=Business.MODEL_CHOICES, required=False, allow_null=True)
    subscription_expires_at = serializers.DateTimeField(required=False, allow_null=True)
    ai_queries_limit        = serializers.IntegerField(required=False, min_value=0)

    def validate(self, data):
        if not data:
            raise serializers.ValidationError('Nothing to update.')
        return data


class UpdateUserSerializer(serializers.Serializer):
    is_active = serializers.BooleanField()
