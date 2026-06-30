from rest_framework import serializers
from core.models import Room, Booking


class RoomSerializer(serializers.ModelSerializer):
    room_type_display   = serializers.CharField(source='get_room_type_display', read_only=True)
    status_display      = serializers.CharField(source='get_status_display',    read_only=True)
    amenities_list      = serializers.SerializerMethodField()

    class Meta:
        model  = Room
        fields = [
            'id', 'room_number', 'room_type', 'room_type_display',
            'description', 'capacity', 'price_per_night',
            'status', 'status_display', 'floor', 'amenities', 'amenities_list',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_amenities_list(self, obj):
        if not obj.amenities:
            return []
        return [a.strip() for a in obj.amenities.split(',') if a.strip()]


class CreateRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Room
        fields = ['room_number', 'room_type', 'description', 'capacity',
                  'price_per_night', 'floor', 'amenities']


class UpdateRoomSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Room
        fields = ['room_number', 'room_type', 'description', 'capacity',
                  'price_per_night', 'status', 'floor', 'amenities', 'is_active']


class BookingSerializer(serializers.ModelSerializer):
    room_number     = serializers.CharField(source='room.room_number', read_only=True)
    room_type       = serializers.CharField(source='room.room_type',   read_only=True)
    status_display  = serializers.CharField(source='get_status_display',  read_only=True)
    payment_display = serializers.CharField(source='get_payment_status_display', read_only=True)

    class Meta:
        model  = Booking
        fields = [
            'id', 'booking_number', 'room', 'room_number', 'room_type',
            'guest_name', 'guest_phone', 'guest_email',
            'check_in_date', 'check_out_date', 'nights',
            'price_per_night', 'total_amount', 'amount_paid', 'balance_due',
            'payment_status', 'payment_display', 'payment_method',
            'status', 'status_display', 'notes',
            'checked_in_at', 'checked_out_at', 'created_at',
        ]
        read_only_fields = [
            'id', 'booking_number', 'nights', 'total_amount',
            'balance_due', 'checked_in_at', 'checked_out_at', 'created_at',
        ]


class CreateBookingSerializer(serializers.Serializer):
    room_id        = serializers.UUIDField()
    guest_name     = serializers.CharField(max_length=150)
    guest_phone    = serializers.CharField(max_length=20, required=False, allow_blank=True)
    guest_email    = serializers.EmailField(required=False, allow_blank=True)
    check_in_date  = serializers.DateField()
    check_out_date = serializers.DateField()
    notes          = serializers.CharField(required=False, allow_blank=True)
    amount_paid    = serializers.DecimalField(max_digits=15, decimal_places=2, default=0)
    payment_method = serializers.ChoiceField(choices=Booking.METHOD_CHOICES, required=False, allow_null=True)

    def validate(self, data):
        if data['check_out_date'] <= data['check_in_date']:
            raise serializers.ValidationError('Check-out date must be after check-in date.')
        return data


class BookingPaymentSerializer(serializers.Serializer):
    amount         = serializers.DecimalField(max_digits=15, decimal_places=2)
    payment_method = serializers.ChoiceField(choices=Booking.METHOD_CHOICES)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError('Amount must be greater than zero.')
        return value
