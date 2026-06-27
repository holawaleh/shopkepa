from django.urls import path
from . import views

urlpatterns = [
    path('', views.CustomerListCreateView.as_view(), name='customer-list-create'),
    path('top/', views.TopCustomersView.as_view(), name='customer-top'),
    path('<uuid:customer_id>/', views.CustomerDetailView.as_view(), name='customer-detail'),
    path('<uuid:customer_id>/notes/', views.CustomerNoteView.as_view(), name='customer-notes'),
    path('<uuid:customer_id>/notes/<uuid:note_id>/', views.CustomerNoteView.as_view(), name='customer-note-delete'),
]