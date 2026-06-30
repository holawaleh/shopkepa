import uuid
from django.db import models


class ServiceType(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business    = models.ForeignKey('Business', on_delete=models.CASCADE, related_name='service_types')
    name        = models.CharField(max_length=200)
    category    = models.CharField(max_length=100, blank=True)
    base_price  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    description = models.CharField(max_length=500, blank=True)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'service_types'
        ordering = ['category', 'name']

    def __str__(self):
        return f'{self.category} — {self.name}' if self.category else self.name
