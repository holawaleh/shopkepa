import uuid
from django.db import models
from .business import Business
from .customer import Customer
from .sale import Sale, Payment


class InstallmentPlan(models.Model):
    STATUS_ACTIVE    = 'active'
    STATUS_COMPLETED = 'completed'
    STATUS_OVERDUE   = 'overdue'
    STATUS_CANCELLED = 'cancelled'
    STATUS_CHOICES   = [
        (STATUS_ACTIVE,    'Active'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_OVERDUE,   'Overdue'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale                 = models.OneToOneField(Sale, on_delete=models.CASCADE, related_name='installment_plan')
    business             = models.ForeignKey(Business, on_delete=models.CASCADE)
    customer             = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='installment_plans')
    total_amount         = models.DecimalField(max_digits=15, decimal_places=2)
    initial_deposit      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_at_creation  = models.DecimalField(max_digits=15, decimal_places=2)
    current_balance      = models.DecimalField(max_digits=15, decimal_places=2)
    max_tranches         = models.IntegerField(default=5)
    tranches_used        = models.IntegerField(default=1)
    status               = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    due_date             = models.DateField(null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)
    created_by           = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'installment_plans'
        indexes = [
            models.Index(fields=['customer', 'status']),
            models.Index(fields=['business', 'status']),
        ]

    def __str__(self):
        return f"Plan for {self.sale.sale_number} — Balance: ₦{self.current_balance}"


class InstallmentPayment(models.Model):
    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    installment_plan     = models.ForeignKey(InstallmentPlan, on_delete=models.CASCADE, related_name='installment_payments')
    payment              = models.ForeignKey(Payment, on_delete=models.CASCADE)
    business             = models.ForeignKey(Business, on_delete=models.CASCADE)
    tranche_number       = models.IntegerField()
    amount               = models.DecimalField(max_digits=15, decimal_places=2)
    balance_before       = models.DecimalField(max_digits=15, decimal_places=2)
    balance_after        = models.DecimalField(max_digits=15, decimal_places=2)
    payment_date         = models.DateField(auto_now_add=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    created_by           = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'installment_payments'

    def __str__(self):
        return f"Tranche {self.tranche_number} — ₦{self.amount}"