from django.urls import path
from . import views

urlpatterns = [
    path('categories/', views.ExpenseCategoryListCreateView.as_view(), name='expense-category'),
    path('', views.ExpenseListCreateView.as_view(), name='expense-list-create'),
    path('summary/', views.ExpenseSummaryView.as_view(), name='expense-summary'),
    path('<uuid:expense_id>/', views.ExpenseDetailView.as_view(), name='expense-detail'),
]