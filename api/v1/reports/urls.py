from django.urls import path
from . import views

urlpatterns = [
    path('sales/daily/',   views.DailySalesReportView.as_view(),   name='report-daily'),
    path('sales/weekly/',  views.WeeklySalesReportView.as_view(),  name='report-weekly'),
    path('sales/monthly/', views.MonthlySalesReportView.as_view(), name='report-monthly'),
    path('debtors/',       views.DebtorReportView.as_view(),       name='report-debtors'),
    path('inventory/',     views.InventoryReportView.as_view(),     name='report-inventory'),
    path('customers/',     views.CustomerReportView.as_view(),      name='report-customers'),
    path('branches/',      views.BranchReportView.as_view(),        name='report-branches'),
    path('expenses/',      views.ExpenseReportView.as_view(),       name='report-expenses'),
]