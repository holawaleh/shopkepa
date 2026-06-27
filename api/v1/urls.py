from django.urls import path, include

urlpatterns = [
    path('auth/',      include('api.v1.auth.urls')),
    path('modules/',   include('api.v1.modules.urls')),
    path('branches/',  include('api.v1.branches.urls')),
    path('staff/',     include('api.v1.staff.urls')),
    path('products/',  include('api.v1.products.urls')),
    path('customers/', include('api.v1.customers.urls')),
    path('expenses/',  include('api.v1.expenses.urls')),
]