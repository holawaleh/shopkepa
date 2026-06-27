import uuid
from django.db import models
from .business import Business


class Customer(models.Model):
    LOYALTY_NONE   = 'none'
    LOYALTY_BRONZE = 'bronze'
    LOYALTY_SILVER = 'silver'
    LOYALTY_GOLD   = 'gold'
    LOYALTY_CHOICES = [
        (LOYALTY_NONE,   'None'),
        (LOYALTY_BRONZE, 'Bronze'),
        (LOYALTY_SILVER, 'Silver'),
        (LOYALTY_GOLD,   'Gold'),
    ]

    TYPE_RETAIL    = 'retail'
    TYPE_WHOLESALE = 'wholesale'
    TYPE_CHOICES   = [
        (TYPE_RETAIL,    'Retail'),
        (TYPE_WHOLESALE, 'Wholesale'),
    ]

    id                    = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business              = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='customers')
    full_name             = models.CharField(max_length=150)
    phone_number          = models.CharField(max_length=20, null=True, blank=True)
    email                 = models.EmailField(null=True, blank=True)
    address               = models.TextField(null=True, blank=True)
    business_name         = models.CharField(max_length=200, null=True, blank=True)
    customer_type         = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_RETAIL)
    loyalty_tag           = models.CharField(max_length=20, choices=LOYALTY_CHOICES, default=LOYALTY_NONE)
    lifetime_spend        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_outstanding_debt = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    last_purchase_date    = models.DateField(null=True, blank=True)
    is_active             = models.BooleanField(default=True)
    is_deleted            = models.BooleanField(default=False)
    deleted_at            = models.DateTimeField(null=True, blank=True)
    created_at            = models.DateTimeField(auto_now_add=True)
    updated_at            = models.DateTimeField(auto_now=True)
    created_by            = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'customers'
        indexes = [
            models.Index(fields=['business', 'loyalty_tag']),
            models.Index(fields=['business', 'customer_type']),
            models.Index(fields=['business', 'last_purchase_date']),
        ]

    def __str__(self):
        return f"{self.full_name} — {self.business.name}"


class CustomerNote(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer   = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='notes')
    business   = models.ForeignKey(Business, on_delete=models.CASCADE)
    note       = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'customer_notes'

    def __str__(self):
        return f"Note on {self.customer.full_name}"