import uuid
from django.db import models
from .business import Business
from .customer import Customer


class JobCard(models.Model):
    STATUS_RECEIVED        = 'received'
    STATUS_DIAGNOSING      = 'diagnosing'
    STATUS_AWAITING_PARTS  = 'awaiting_parts'
    STATUS_IN_REPAIR       = 'in_repair'
    STATUS_READY           = 'ready'
    STATUS_COLLECTED       = 'collected'
    STATUS_CANCELLED       = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_RECEIVED,       'Received'),
        (STATUS_DIAGNOSING,     'Diagnosing'),
        (STATUS_AWAITING_PARTS, 'Awaiting Parts'),
        (STATUS_IN_REPAIR,      'In Repair'),
        (STATUS_READY,          'Ready for Collection'),
        (STATUS_COLLECTED,      'Collected'),
        (STATUS_CANCELLED,      'Cancelled'),
    ]

    PAYMENT_UNPAID  = 'unpaid'
    PAYMENT_PARTIAL = 'partial'
    PAYMENT_PAID    = 'paid'
    PAYMENT_CHOICES = [
        (PAYMENT_UNPAID,  'Unpaid'),
        (PAYMENT_PARTIAL, 'Partial'),
        (PAYMENT_PAID,    'Paid'),
    ]

    METHOD_CASH     = 'cash'
    METHOD_TRANSFER = 'transfer'
    METHOD_POS      = 'pos'
    METHOD_CHOICES  = [
        (METHOD_CASH,     'Cash'),
        (METHOD_TRANSFER, 'Transfer'),
        (METHOD_POS,      'POS'),
    ]

    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business           = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='job_cards')
    branch             = models.ForeignKey('core.Branch', on_delete=models.CASCADE, related_name='job_cards')
    job_number         = models.CharField(max_length=50, unique=True)
    customer           = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='job_cards')
    customer_name      = models.CharField(max_length=150)
    customer_phone     = models.CharField(max_length=20, null=True, blank=True)
    device_description = models.CharField(max_length=200)
    customer_complaint = models.TextField()
    technician         = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_jobs')
    status             = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_RECEIVED)
    technician_notes   = models.TextField(null=True, blank=True)
    labour_charge      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    parts_charge       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_charge       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount_paid        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_due        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    payment_status     = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default=PAYMENT_UNPAID)
    payment_method     = models.CharField(max_length=20, choices=METHOD_CHOICES, null=True, blank=True)
    warranty_days      = models.IntegerField(null=True, blank=True)
    collected_at       = models.DateTimeField(null=True, blank=True)
    intake_date        = models.DateField(auto_now_add=True)
    is_deleted         = models.BooleanField(default=False)
    deleted_at         = models.DateTimeField(null=True, blank=True)
    created_at         = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)
    created_by         = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_jobs')

    class Meta:
        db_table = 'job_cards'
        indexes = [
            models.Index(fields=['business', 'status']),
            models.Index(fields=['business', 'payment_status']),
            models.Index(fields=['technician', 'status']),
        ]

    def __str__(self):
        return f"{self.job_number} — {self.device_description}"


class JobCardPart(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_card   = models.ForeignKey(JobCard, on_delete=models.CASCADE, related_name='parts')
    business   = models.ForeignKey(Business, on_delete=models.CASCADE)
    part_name  = models.CharField(max_length=200)
    quantity   = models.IntegerField(default=1)
    unit_cost  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    supplier   = models.CharField(max_length=150, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'job_card_parts'

    def __str__(self):
        return f"{self.part_name} x{self.quantity} — ₦{self.line_total}"