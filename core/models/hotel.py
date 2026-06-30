import uuid
from django.db import models
from .business import Business


class Room(models.Model):
    TYPE_SINGLE  = 'single'
    TYPE_DOUBLE  = 'double'
    TYPE_TWIN    = 'twin'
    TYPE_SUITE   = 'suite'
    TYPE_FAMILY  = 'family'
    TYPE_DELUXE  = 'deluxe'
    TYPE_CHOICES = [
        (TYPE_SINGLE, 'Single'),
        (TYPE_DOUBLE, 'Double'),
        (TYPE_TWIN,   'Twin'),
        (TYPE_SUITE,  'Suite'),
        (TYPE_FAMILY, 'Family'),
        (TYPE_DELUXE, 'Deluxe'),
    ]

    STATUS_AVAILABLE    = 'available'
    STATUS_OCCUPIED     = 'occupied'
    STATUS_MAINTENANCE  = 'maintenance'
    STATUS_CHOICES = [
        (STATUS_AVAILABLE,   'Available'),
        (STATUS_OCCUPIED,    'Occupied'),
        (STATUS_MAINTENANCE, 'Under Maintenance'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business        = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='rooms')
    room_number     = models.CharField(max_length=20)
    room_type       = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_DOUBLE)
    description     = models.TextField(blank=True, null=True)
    capacity        = models.PositiveIntegerField(default=2)
    price_per_night = models.DecimalField(max_digits=15, decimal_places=2)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE)
    floor           = models.CharField(max_length=10, blank=True, null=True)
    amenities       = models.CharField(max_length=500, blank=True, null=True, help_text='Comma-separated list')
    is_active       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'hotel_rooms'
        unique_together = [('business', 'room_number')]
        indexes = [
            models.Index(fields=['business', 'status']),
            models.Index(fields=['business', 'room_type']),
        ]

    def __str__(self):
        return f"Room {self.room_number} ({self.get_room_type_display()})"


class Booking(models.Model):
    STATUS_PENDING    = 'pending'
    STATUS_CONFIRMED  = 'confirmed'
    STATUS_CHECKED_IN = 'checked_in'
    STATUS_CHECKED_OUT = 'checked_out'
    STATUS_CANCELLED  = 'cancelled'
    STATUS_CHOICES = [
        (STATUS_PENDING,     'Pending'),
        (STATUS_CONFIRMED,   'Confirmed'),
        (STATUS_CHECKED_IN,  'Checked In'),
        (STATUS_CHECKED_OUT, 'Checked Out'),
        (STATUS_CANCELLED,   'Cancelled'),
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

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business        = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='bookings')
    booking_number  = models.CharField(max_length=20, unique=True)
    room            = models.ForeignKey(Room, on_delete=models.PROTECT, related_name='bookings')
    guest_name      = models.CharField(max_length=150)
    guest_phone     = models.CharField(max_length=20, blank=True, null=True)
    guest_email     = models.EmailField(blank=True, null=True)
    check_in_date   = models.DateField()
    check_out_date  = models.DateField()
    nights          = models.PositiveIntegerField(default=1)
    price_per_night = models.DecimalField(max_digits=15, decimal_places=2)
    total_amount    = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount_paid     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_due     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    payment_status  = models.CharField(max_length=20, choices=PAYMENT_CHOICES, default=PAYMENT_UNPAID)
    payment_method  = models.CharField(max_length=20, choices=METHOD_CHOICES, blank=True, null=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    notes           = models.TextField(blank=True, null=True)
    checked_in_at   = models.DateTimeField(null=True, blank=True)
    checked_out_at  = models.DateTimeField(null=True, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)
    created_by      = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_bookings')

    class Meta:
        db_table = 'hotel_bookings'
        indexes = [
            models.Index(fields=['business', 'status']),
            models.Index(fields=['business', 'payment_status']),
            models.Index(fields=['room', 'check_in_date', 'check_out_date']),
            models.Index(fields=['business', 'check_in_date']),
        ]

    def save(self, *args, **kwargs):
        from datetime import date
        if self.check_in_date and self.check_out_date:
            delta = (self.check_out_date - self.check_in_date).days
            self.nights = max(delta, 1)
            self.total_amount = self.price_per_night * self.nights
            self.balance_due  = self.total_amount - self.amount_paid
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.booking_number} — {self.guest_name} (Room {self.room.room_number})"
