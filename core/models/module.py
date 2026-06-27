import uuid
from django.db import models
from .business import Business


class Module(models.Model):
    CODE_GENERAL_TRADE       = 'general_trade'
    CODE_FASHION             = 'fashion'
    CODE_ELECTRONICS         = 'electronics'
    CODE_FOOD                = 'food'
    CODE_PHARMACY            = 'pharmacy'
    CODE_BUILDING_MATERIALS  = 'building_materials'
    CODE_STATIONERY          = 'stationery'
    CODE_TECHNICAL_SERVICES  = 'technical_services'

    CODE_CHOICES = [
        (CODE_GENERAL_TRADE,      'General Trade / Provision Store'),
        (CODE_FASHION,            'Fashion & Clothing'),
        (CODE_ELECTRONICS,        'Electronics & Gadgets'),
        (CODE_FOOD,               'Food & Groceries'),
        (CODE_PHARMACY,           'Pharmacy / Chemist'),
        (CODE_BUILDING_MATERIALS, 'Building Materials'),
        (CODE_STATIONERY,         'Stationery / School Supplies'),
        (CODE_TECHNICAL_SERVICES, 'Technical Services'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code        = models.CharField(max_length=50, unique=True, choices=CODE_CHOICES)
    name        = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    icon_url    = models.TextField(null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    sort_order  = models.IntegerField(default=0)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'modules'
        ordering = ['sort_order']

    def __str__(self):
        return self.name


class BusinessModule(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business     = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='business_modules')
    module       = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='business_modules')
    is_active    = models.BooleanField(default=True)
    activated_at = models.DateTimeField(auto_now_add=True)
    created_by   = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'business_modules'
        unique_together = ('business', 'module')

    def __str__(self):
        return f"{self.business.name} — {self.module.name}"