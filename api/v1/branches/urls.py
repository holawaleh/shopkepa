from django.urls import path
from . import views

urlpatterns = [
    path('', views.BranchListCreateView.as_view(), name='branch-list-create'),
    path('<uuid:branch_id>/', views.BranchDetailView.as_view(), name='branch-detail'),
]