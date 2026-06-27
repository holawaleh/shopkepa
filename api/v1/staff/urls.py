from django.urls import path
from . import views

urlpatterns = [
    path('', views.StaffListCreateView.as_view(), name='staff-list-create'),
    path('<uuid:user_id>/', views.StaffDetailView.as_view(), name='staff-detail'),
    path('<uuid:user_id>/toggle-active/', views.ToggleStaffActiveView.as_view(), name='staff-toggle'),
]