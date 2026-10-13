import uuid
from django.db import models
from .business import Business
from .module import Module
from .customer import Customer


class Sale(models.Model):
    STATUS_PAID    = 'paid'
    STATUS_PARTIAL = 'partial'
    STATUS_UNPAID  = 'unpaid'
    STATUS_CHOICES = [
        (STATUS_PAID,    'Paid'),
        (STATUS_PARTIAL, 'Partial'),
        (STATUS_UNPAID,  'Unpaid'),
    ]

    METHOD_CASH     = 'cash'
    METHOD_TRANSFER = 'transfer'
    METHOD_POS      = 'pos'
    METHOD_CHOICES  = [
        (METHOD_CASH,     'Cash'),
        (METHOD_TRANSFER, 'Transfer'),
        (METHOD_POS,      'POS'),
    ]

    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business             = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='sales')
    branch               = models.ForeignKey('core.Branch', on_delete=models.CASCADE, related_name='sales')
    module               = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='sales')
    customer             = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales')
    sale_number          = models.CharField(max_length=50)
    subtotal             = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    discount_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount_paid          = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_due          = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    payment_status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_UNPAID)
    # VAT included in total_amount (prices are VAT-inclusive), snapshotted
    # from business settings at the time of sale; 0 when VAT is off.
    tax_rate             = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_amount           = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    # Value of goods brought back. total_amount is already reduced by it.
    returned_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    has_installment_plan = models.BooleanField(default=False)
    sale_date            = models.DateField(auto_now_add=True)
    notes                = models.TextField(null=True, blank=True)
    receipt_url          = models.TextField(null=True, blank=True)
    is_deleted           = models.BooleanField(default=False)
    deleted_at           = models.DateTimeField(null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)
    created_by           = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'sales'
        # Sale numbers are only meant to be unique per business (each
        # business's own sequence, e.g. SK-2026-00001) - not globally, which
        # previously caused an unrelated business to be able to "steal" the
        # next number and even collide/crash on insert.
        constraints = [
            models.UniqueConstraint(fields=['business', 'sale_number'], name='unique_sale_number_per_business'),
        ]
        indexes = [
            models.Index(fields=['business', 'sale_date']),
            models.Index(fields=['business', 'payment_status']),
            models.Index(fields=['customer', 'business']),
            models.Index(fields=['business', 'branch']),
            models.Index(fields=['business', 'created_by']),
        ]

    def __str__(self):
        return f"{self.sale_number} — ₦{self.total_amount}"


class SaleItem(models.Model):
    PRICE_RETAIL    = 'retail'
    PRICE_WHOLESALE = 'wholesale'
    PRICE_CUSTOM    = 'custom'
    PRICE_CHOICES   = [
        (PRICE_RETAIL,    'Retail'),
        (PRICE_WHOLESALE, 'Wholesale'),
        (PRICE_CUSTOM,    'Custom'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale            = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    business        = models.ForeignKey(Business, on_delete=models.CASCADE)
    product         = models.ForeignKey('core.Product', on_delete=models.SET_NULL, null=True)
    product_name    = models.CharField(max_length=200)
    quantity        = models.IntegerField()
    unit_type       = models.CharField(max_length=50, null=True, blank=True)
    price_type      = models.CharField(max_length=20, choices=PRICE_CHOICES, default=PRICE_RETAIL)
    unit_price      = models.DecimalField(max_digits=15, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    line_total      = models.DecimalField(max_digits=15, decimal_places=2)
    returned_quantity = models.IntegerField(default=0)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sale_items'

    def __str__(self):
        return f"{self.product_name} x{self.quantity} — ₦{self.line_total}"


class Payment(models.Model):
    METHOD_CASH     = 'cash'
    METHOD_TRANSFER = 'transfer'
    METHOD_POS      = 'pos'
    METHOD_CHOICES  = [
        (METHOD_CASH,     'Cash'),
        (METHOD_TRANSFER, 'Transfer'),
        (METHOD_POS,      'POS'),
    ]

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale             = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='payments')
    business         = models.ForeignKey(Business, on_delete=models.CASCADE)
    branch           = models.ForeignKey('core.Branch', on_delete=models.CASCADE)
    customer         = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    payment_method   = models.CharField(max_length=20, choices=METHOD_CHOICES)
    amount           = models.DecimalField(max_digits=15, decimal_places=2)
    payment_date     = models.DateField(auto_now_add=True)
    reference_number = models.CharField(max_length=100, null=True, blank=True)
    notes            = models.TextField(null=True, blank=True)
    tranche_number   = models.IntegerField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    created_by       = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'payments'
        indexes = [
            models.Index(fields=['sale']),
            models.Index(fields=['business', 'payment_date']),
            models.Index(fields=['business', 'payment_method']),
        ]

    def __str__(self):
        return f"₦{self.amount} — {self.payment_method} ({self.sale.sale_number})"

class SaleReturn(models.Model):
    """Goods brought back from a sale: stock, debt and money adjustments."""
    REFUND_CASH     = 'cash'
    REFUND_TRANSFER = 'transfer'
    REFUND_POS      = 'pos'
    REFUND_CHOICES  = [
        (REFUND_CASH,     'Cash'),
        (REFUND_TRANSFER, 'Transfer'),
        (REFUND_POS,      'POS'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business        = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='sale_returns')
    branch          = models.ForeignKey('core.Branch', on_delete=models.CASCADE)
    sale            = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='returns')
    customer        = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True)
    return_number   = models.CharField(max_length=50)
    reason          = models.TextField(null=True, blank=True)
    # value = debt_reduction + refund_amount
    value           = models.DecimalField(max_digits=15, decimal_places=2)
    debt_reduction  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    refund_amount   = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    refund_method   = models.CharField(max_length=20, choices=REFUND_CHOICES, null=True, blank=True)
    tax_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    return_date     = models.DateField(auto_now_add=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    created_by      = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'sale_returns'
        constraints = [
            models.UniqueConstraint(fields=['business', 'return_number'], name='unique_return_number_per_business'),
        ]
        indexes = [models.Index(fields=['business', 'return_date'])]

    def __str__(self):
        return f"{self.return_number} ({self.sale.sale_number})"


class SaleReturnItem(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sale_return   = models.ForeignKey(SaleReturn, on_delete=models.CASCADE, related_name='items')
    sale_item     = models.ForeignKey(SaleItem, on_delete=models.CASCADE, related_name='return_items')
    product       = models.ForeignKey('core.Product', on_delete=models.SET_NULL, null=True)
    product_name  = models.CharField(max_length=200)
    quantity      = models.IntegerField()
    unit_value    = models.DecimalField(max_digits=15, decimal_places=2)
    line_value    = models.DecimalField(max_digits=15, decimal_places=2)
    restocked     = models.BooleanField(default=True)

    class Meta:
        db_table = 'sale_return_items'
