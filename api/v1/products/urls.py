from django.urls import path
from . import views

urlpatterns = [
    path('', views.ProductListCreateView.as_view(), name='product-list-create'),
    path('categories/', views.ProductCategoryListCreateView.as_view(), name='product-category-list-create'),
    path('low-stock/', views.LowStockView.as_view(), name='product-low-stock'),
    path('expiring/', views.ExpiringProductsView.as_view(), name='product-expiring'),
    path('barcode/', views.ProductBarcodeLookupView.as_view(), name='product-barcode'),
    path('<uuid:product_id>/', views.ProductDetailView.as_view(), name='product-detail'),
    path('<uuid:product_id>/inventory/', views.ProductInventoryView.as_view(), name='product-inventory'),
    path('<uuid:product_id>/adjust-stock/', views.StockAdjustView.as_view(), name='product-adjust-stock'),
    path('<uuid:product_id>/stock-history/', views.StockHistoryView.as_view(), name='product-stock-history'),
]