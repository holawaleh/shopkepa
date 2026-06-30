from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db import transaction
from decimal import Decimal

from core.models import Room, Booking
from core.permissions import IsCashierOrAbove, IsManagerOrAbove
from core.utils import generate_booking_number, get_client_ip
from .serializers import (
    RoomSerializer, CreateRoomSerializer, UpdateRoomSerializer,
    BookingSerializer, CreateBookingSerializer, BookingPaymentSerializer,
)


class RoomListCreateView(APIView):
    permission_classes = [IsCashierOrAbove]

    def get(self, request):
        business = request.user.business
        rooms = Room.objects.filter(business=business, is_active=True).order_by('room_number')
        status_filter = request.query_params.get('status')
        type_filter   = request.query_params.get('room_type')
        if status_filter:
            rooms = rooms.filter(status=status_filter)
        if type_filter:
            rooms = rooms.filter(room_type=type_filter)
        return Response(RoomSerializer(rooms, many=True).data)

    def post(self, request):
        self.permission_classes = [IsManagerOrAbove]
        self.check_permissions(request)
        s = CreateRoomSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=status.HTTP_400_BAD_REQUEST)
        d = s.validated_data
        if Room.objects.filter(business=request.user.business, room_number=d['room_number']).exists():
            return Response({'error': f"Room {d['room_number']} already exists."}, status=400)
        room = Room.objects.create(business=request.user.business, **d)
        return Response(RoomSerializer(room).data, status=status.HTTP_201_CREATED)


class RoomDetailView(APIView):
    permission_classes = [IsCashierOrAbove]

    def _get_room(self, request, room_id):
        try:
            return Room.objects.get(id=room_id, business=request.user.business)
        except Room.DoesNotExist:
            return None

    def get(self, request, room_id):
        room = self._get_room(request, room_id)
        if not room:
            return Response({'error': 'Room not found.'}, status=404)
        return Response(RoomSerializer(room).data)

    def patch(self, request, room_id):
        self.permission_classes = [IsManagerOrAbove]
        self.check_permissions(request)
        room = self._get_room(request, room_id)
        if not room:
            return Response({'error': 'Room not found.'}, status=404)
        s = UpdateRoomSerializer(room, data=request.data, partial=True)
        if not s.is_valid():
            return Response(s.errors, status=400)
        s.save()
        return Response(RoomSerializer(room).data)

    def delete(self, request, room_id):
        self.permission_classes = [IsManagerOrAbove]
        self.check_permissions(request)
        room = self._get_room(request, room_id)
        if not room:
            return Response({'error': 'Room not found.'}, status=404)
        if room.bookings.filter(status__in=[Booking.STATUS_CHECKED_IN, Booking.STATUS_CONFIRMED]).exists():
            return Response({'error': 'Cannot delete a room with active bookings.'}, status=400)
        room.is_active = False
        room.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BookingListCreateView(APIView):
    permission_classes = [IsCashierOrAbove]

    def get(self, request):
        business = request.user.business
        qs = Booking.objects.filter(business=business).select_related('room').order_by('-created_at')
        status_filter  = request.query_params.get('status')
        payment_filter = request.query_params.get('payment_status')
        date_from      = request.query_params.get('date_from')
        date_to        = request.query_params.get('date_to')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if payment_filter:
            qs = qs.filter(payment_status=payment_filter)
        if date_from:
            qs = qs.filter(check_in_date__gte=date_from)
        if date_to:
            qs = qs.filter(check_in_date__lte=date_to)
        return Response(BookingSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        s = CreateBookingSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=400)
        d = s.validated_data

        try:
            room = Room.objects.get(id=d['room_id'], business=request.user.business, is_active=True)
        except Room.DoesNotExist:
            return Response({'error': 'Room not found.'}, status=404)

        # Conflict check: no overlapping confirmed/checked-in bookings for this room
        overlap = Booking.objects.filter(
            room=room,
            status__in=[Booking.STATUS_CONFIRMED, Booking.STATUS_CHECKED_IN],
            check_in_date__lt=d['check_out_date'],
            check_out_date__gt=d['check_in_date'],
        ).exists()
        if overlap:
            return Response({'error': f"Room {room.room_number} is already booked for the selected dates."}, status=400)

        amount_paid = Decimal(str(d.get('amount_paid', 0)))
        booking = Booking(
            business       = request.user.business,
            booking_number = generate_booking_number(request.user.business.id),
            room           = room,
            guest_name     = d['guest_name'],
            guest_phone    = d.get('guest_phone', ''),
            guest_email    = d.get('guest_email', ''),
            check_in_date  = d['check_in_date'],
            check_out_date = d['check_out_date'],
            price_per_night = room.price_per_night,
            amount_paid    = amount_paid,
            payment_method = d.get('payment_method'),
            notes          = d.get('notes', ''),
            status         = Booking.STATUS_CONFIRMED,
            created_by     = request.user,
        )
        booking.save()  # triggers nights/total/balance calc in model.save()

        if amount_paid > 0:
            if amount_paid >= booking.total_amount:
                booking.payment_status = Booking.PAYMENT_PAID
            else:
                booking.payment_status = Booking.PAYMENT_PARTIAL
            booking.balance_due = max(booking.total_amount - amount_paid, Decimal('0'))
            booking.save()

        # Mark room as occupied if checking in today
        from datetime import date
        if booking.check_in_date == date.today():
            room.status = Room.STATUS_OCCUPIED
            room.save()

        return Response(BookingSerializer(booking).data, status=201)


class BookingDetailView(APIView):
    permission_classes = [IsCashierOrAbove]

    def _get_booking(self, request, booking_id):
        try:
            return Booking.objects.select_related('room').get(id=booking_id, business=request.user.business)
        except Booking.DoesNotExist:
            return None

    def get(self, request, booking_id):
        b = self._get_booking(request, booking_id)
        if not b:
            return Response({'error': 'Booking not found.'}, status=404)
        return Response(BookingSerializer(b).data)

    def patch(self, request, booking_id):
        b = self._get_booking(request, booking_id)
        if not b:
            return Response({'error': 'Booking not found.'}, status=404)
        allowed = {'notes', 'guest_phone', 'guest_email'}
        data = {k: v for k, v in request.data.items() if k in allowed}
        for k, v in data.items():
            setattr(b, k, v)
        b.save()
        return Response(BookingSerializer(b).data)


class BookingCheckInView(APIView):
    permission_classes = [IsCashierOrAbove]

    @transaction.atomic
    def post(self, request, booking_id):
        try:
            b = Booking.objects.select_related('room').get(id=booking_id, business=request.user.business)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=404)
        if b.status not in [Booking.STATUS_PENDING, Booking.STATUS_CONFIRMED]:
            return Response({'error': f'Cannot check in a booking with status "{b.status}".'}, status=400)
        b.status       = Booking.STATUS_CHECKED_IN
        b.checked_in_at = timezone.now()
        b.save()
        b.room.status = Room.STATUS_OCCUPIED
        b.room.save()
        return Response(BookingSerializer(b).data)


class BookingCheckOutView(APIView):
    permission_classes = [IsCashierOrAbove]

    @transaction.atomic
    def post(self, request, booking_id):
        try:
            b = Booking.objects.select_related('room').get(id=booking_id, business=request.user.business)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=404)
        if b.status != Booking.STATUS_CHECKED_IN:
            return Response({'error': 'Guest is not currently checked in.'}, status=400)
        b.status        = Booking.STATUS_CHECKED_OUT
        b.checked_out_at = timezone.now()
        b.save()
        # Only free the room if no other active booking is using it
        other_active = Booking.objects.filter(
            room=b.room,
            status=Booking.STATUS_CHECKED_IN,
        ).exclude(id=b.id).exists()
        if not other_active:
            b.room.status = Room.STATUS_AVAILABLE
            b.room.save()
        return Response(BookingSerializer(b).data)


class BookingPaymentView(APIView):
    permission_classes = [IsCashierOrAbove]

    @transaction.atomic
    def post(self, request, booking_id):
        try:
            b = Booking.objects.get(id=booking_id, business=request.user.business)
        except Booking.DoesNotExist:
            return Response({'error': 'Booking not found.'}, status=404)
        if b.payment_status == Booking.PAYMENT_PAID:
            return Response({'error': 'This booking is already fully paid.'}, status=400)
        s = BookingPaymentSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=400)
        d = s.validated_data
        if Decimal(str(d['amount'])) > b.balance_due:
            return Response({'error': f'Amount exceeds balance due of ₦{b.balance_due}.'}, status=400)
        b.amount_paid    += Decimal(str(d['amount']))
        b.balance_due     = b.total_amount - b.amount_paid
        b.payment_method  = d['payment_method']
        if b.balance_due <= 0:
            b.payment_status = Booking.PAYMENT_PAID
            b.balance_due    = Decimal('0')
        else:
            b.payment_status = Booking.PAYMENT_PARTIAL
        b.save()
        return Response(BookingSerializer(b).data)


class OccupancyView(APIView):
    permission_classes = [IsCashierOrAbove]

    def get(self, request):
        business = request.user.business
        total     = Room.objects.filter(business=business, is_active=True).count()
        occupied  = Room.objects.filter(business=business, is_active=True, status=Room.STATUS_OCCUPIED).count()
        available = Room.objects.filter(business=business, is_active=True, status=Room.STATUS_AVAILABLE).count()
        maintenance = Room.objects.filter(business=business, is_active=True, status=Room.STATUS_MAINTENANCE).count()
        from django.utils.timezone import now
        today = now().date()
        checkins_today  = Booking.objects.filter(business=business, check_in_date=today).count()
        checkouts_today = Booking.objects.filter(business=business, check_out_date=today, status=Booking.STATUS_CHECKED_IN).count()
        return Response({
            'total_rooms':      total,
            'occupied':         occupied,
            'available':        available,
            'maintenance':      maintenance,
            'occupancy_rate':   round((occupied / total * 100) if total else 0, 1),
            'checkins_today':   checkins_today,
            'checkouts_today':  checkouts_today,
        })
