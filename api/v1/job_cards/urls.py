from django.urls import path
from . import views
from .service_views import ServiceTypeListCreateView, ServiceTypeDetailView

urlpatterns = [
    path('', views.JobCardListCreateView.as_view(), name='jobcard-list-create'),
    path('services/', ServiceTypeListCreateView.as_view(), name='service-type-list'),
    path('services/<uuid:pk>/', ServiceTypeDetailView.as_view(), name='service-type-detail'),
    path('<uuid:job_id>/', views.JobCardDetailView.as_view(), name='jobcard-detail'),
    path('<uuid:job_id>/parts/', views.JobCardPartView.as_view(), name='jobcard-parts'),
    path('<uuid:job_id>/parts/<uuid:part_id>/', views.JobCardPartView.as_view(), name='jobcard-part-delete'),
    path('<uuid:job_id>/add-payment/', views.JobCardPaymentView.as_view(), name='jobcard-payment'),
]