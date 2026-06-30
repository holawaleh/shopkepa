from django.urls import path
from . import views

urlpatterns = [
    path('rooms/',                             views.RoomListCreateView.as_view(),  name='hotel-rooms'),
    path('rooms/<uuid:room_id>/',              views.RoomDetailView.as_view(),      name='hotel-room-detail'),
    path('bookings/',                          views.BookingListCreateView.as_view(), name='hotel-bookings'),
    path('bookings/<uuid:booking_id>/',        views.BookingDetailView.as_view(),   name='hotel-booking-detail'),
    path('bookings/<uuid:booking_id>/check-in/',  views.BookingCheckInView.as_view(),  name='hotel-check-in'),
    path('bookings/<uuid:booking_id>/check-out/', views.BookingCheckOutView.as_view(), name='hotel-check-out'),
    path('bookings/<uuid:booking_id>/payment/',   views.BookingPaymentView.as_view(),  name='hotel-payment'),
    path('occupancy/',                         views.OccupancyView.as_view(),       name='hotel-occupancy'),
]
