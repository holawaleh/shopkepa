from django.urls import path
from . import views

urlpatterns = [
    path('', views.SaleListCreateView.as_view(), name='sale-list-create'),
    path('<uuid:sale_id>/', views.SaleDetailView.as_view(), name='sale-detail'),
    path('<uuid:sale_id>/add-payment/', views.AddPaymentView.as_view(), name='sale-add-payment'),
]