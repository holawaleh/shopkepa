import uuid
from django.db import models
from .business import Business


class ExpenseCategory(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business   = models.ForeignKey(Business, on_delete=models.CASCADE, null=True, blank=True)
    name       = models.CharField(max_length=100)
    is_custom  = models.BooleanField(default=False)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'expense_categories'

    def __str__(self):
        return self.name


class Expense(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business     = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='expenses')
    branch       = models.ForeignKey('core.Branch', on_delete=models.CASCADE, related_name='expenses')
    category     = models.ForeignKey(ExpenseCategory, on_delete=models.PROTECT, related_name='expenses')
    amount       = models.DecimalField(max_digits=15, decimal_places=2)
    description  = models.TextField(null=True, blank=True)
    expense_date = models.DateField(auto_now_add=True)
    receipt_url  = models.TextField(null=True, blank=True)
    is_deleted   = models.BooleanField(default=False)
    deleted_at   = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    created_by   = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'expenses'
        indexes = [
            models.Index(fields=['business', 'expense_date']),
            models.Index(fields=['business', 'branch']),
            models.Index(fields=['business', 'category']),
            models.Index(fields=['business', 'is_deleted']),
        ]

    def __str__(self):
        return f"{self.category.name} — ₦{self.amount}"