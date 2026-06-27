import uuid
from django.db import models


class Business(models.Model):
    TIER_FREE    = 'free'
    TIER_BASIC   = 'basic'
    TIER_PRO     = 'pro'
    TIER_CHOICES = [
        (TIER_FREE,  'Free'),
        (TIER_BASIC, 'Basic'),
        (TIER_PRO,   'Pro'),
    ]

    MODEL_MONTHLY  = 'monthly'
    MODEL_YEARLY   = 'yearly'
    MODEL_ONE_OFF  = 'one_off'
    MODEL_CHOICES  = [
        (MODEL_MONTHLY,  'Monthly'),
        (MODEL_YEARLY,   'Yearly'),
        (MODEL_ONE_OFF,  'One Off'),
    ]

    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name                  = models.CharField(max_length=200)
    owner_name            = models.CharField(max_length=150)
    phone_number          = models.CharField(max_length=20, unique=True)
    email                 = models.EmailField(unique=True, null=True, blank=True)
    address               = models.TextField(null=True, blank=True)
    logo_url              = models.TextField(null=True, blank=True)
    subscription_tier     = models.CharField(max_length=20, choices=TIER_CHOICES, default=TIER_FREE)
    subscription_model    = models.CharField(max_length=20, choices=MODEL_CHOICES, null=True, blank=True)
    subscription_expires_at = models.DateTimeField(null=True, blank=True)
    ai_queries_used       = models.IntegerField(default=0)
    ai_queries_limit      = models.IntegerField(default=10)
    is_active             = models.BooleanField(default=True)
    created_at            = models.DateTimeField(auto_now_add=True)
    updated_at            = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'businesses'
        verbose_name_plural = 'businesses'

    def __str__(self):
        return self.name


class BusinessSettings(models.Model):
    id                        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business                  = models.OneToOneField(Business, on_delete=models.CASCADE, related_name='settings')
    custom_pricing_enabled    = models.BooleanField(default=True)
    loyalty_bronze_threshold  = models.DecimalField(max_digits=15, decimal_places=2, default=10000)
    loyalty_silver_threshold  = models.DecimalField(max_digits=15, decimal_places=2, default=50000)
    loyalty_gold_threshold    = models.DecimalField(max_digits=15, decimal_places=2, default=150000)
    low_stock_alert_enabled   = models.BooleanField(default=True)
    expiry_alert_days         = models.IntegerField(default=30)
    receipt_footer_message    = models.TextField(null=True, blank=True)
    currency_symbol           = models.CharField(max_length=5, default='₦')
    created_at                = models.DateTimeField(auto_now_add=True)
    updated_at                = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'business_settings'

    def __str__(self):
        return f"Settings — {self.business.name}"