import uuid
from django.db import models
from .business import Business
from .module import Module



class ProductCategory(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business    = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='product_categories')
    module      = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='product_categories')
    name        = models.CharField(max_length=100)
    description = models.CharField(max_length=255, null=True, blank=True)
    is_custom   = models.BooleanField(default=False)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_categories'
        ordering = ['module__sort_order', 'name']
        unique_together = ('business', 'module', 'name')
        indexes = [
            models.Index(fields=['business', 'module']),
            models.Index(fields=['business', 'is_active']),
        ]

    def __str__(self):
        return f"{self.module.name} - {self.name}"

class Product(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business      = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='products')
    module        = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='products')
    category      = models.ForeignKey('ProductCategory', on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    name          = models.CharField(max_length=200)
    description   = models.TextField(null=True, blank=True)
    sku           = models.CharField(max_length=100, null=True, blank=True)
    barcode       = models.CharField(max_length=100, null=True, blank=True)
    unit_type     = models.CharField(max_length=50, null=True, blank=True)
    wholesale_price = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    retail_price  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    cost_price    = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    reorder_level = models.IntegerField(default=0)
    is_active     = models.BooleanField(default=True)
    is_deleted    = models.BooleanField(default=False)
    deleted_at    = models.DateTimeField(null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)
    created_by    = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'products'
        indexes = [
            models.Index(fields=['business', 'module']),
            models.Index(fields=['business', 'category']),
            models.Index(fields=['business', 'is_active']),
            models.Index(fields=['business', 'is_deleted']),
        ]

    def __str__(self):
        return f"{self.name} — {self.business.name}"


class ProductAttribute(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product         = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='attributes')
    business        = models.ForeignKey(Business, on_delete=models.CASCADE)
    attribute_key   = models.CharField(max_length=100)
    attribute_value = models.TextField()
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_attributes'
        unique_together = ('product', 'attribute_key')
        indexes = [
            models.Index(fields=['product', 'attribute_key']),
        ]

    def __str__(self):
        return f"{self.product.name} — {self.attribute_key}: {self.attribute_value}"


class BranchInventory(models.Model):
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business            = models.ForeignKey(Business, on_delete=models.CASCADE)
    branch              = models.ForeignKey('core.Branch', on_delete=models.CASCADE, related_name='inventory')
    product             = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='inventory')
    quantity_in_stock   = models.IntegerField(default=0)
    last_restocked_at   = models.DateTimeField(null=True, blank=True)
    last_restocked_by   = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'branch_inventory'
        unique_together = ('branch', 'product')
        indexes = [
            models.Index(fields=['business', 'branch']),
            models.Index(fields=['branch', 'product']),
        ]

    def __str__(self):
        return f"{self.product.name} @ {self.branch.name} — {self.quantity_in_stock}"


class StockAdjustment(models.Model):
    TYPE_RESTOCK          = 'restock'
    TYPE_MANUAL_INCREASE  = 'manual_increase'
    TYPE_MANUAL_DECREASE  = 'manual_decrease'
    TYPE_RETURN           = 'return'
    TYPE_DAMAGE           = 'damage'
    TYPE_OPENING_STOCK    = 'opening_stock'
    TYPE_CHOICES = [
        (TYPE_RESTOCK,         'Restock'),
        (TYPE_MANUAL_INCREASE, 'Manual Increase'),
        (TYPE_MANUAL_DECREASE, 'Manual Decrease'),
        (TYPE_RETURN,          'Return'),
        (TYPE_DAMAGE,          'Damage'),
        (TYPE_OPENING_STOCK,   'Opening Stock'),
    ]

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business         = models.ForeignKey(Business, on_delete=models.CASCADE)
    branch           = models.ForeignKey('core.Branch', on_delete=models.CASCADE)
    product          = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='stock_adjustments')
    adjustment_type  = models.CharField(max_length=30, choices=TYPE_CHOICES)
    quantity_change  = models.IntegerField()
    quantity_before  = models.IntegerField()
    quantity_after   = models.IntegerField()
    reason           = models.TextField(null=True, blank=True)
    reference_id     = models.UUIDField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    created_by       = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'stock_adjustments'

    def __str__(self):
        return f"{self.adjustment_type} — {self.product.name} ({self.quantity_change})"