from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health(_request):
    return JsonResponse({
        'status': 'ok',
        'service': 'ShopKepa API',
        'version': 'v1.0',
        'docs': '/api/v1/',
    })


urlpatterns = [
    path('',        health),
    path('health/', health),
    path('admin/',  admin.site.urls),
    path('api/v1/', include('api.v1.urls')),
    path('api/v1', include('api.v1.urls')),
]
