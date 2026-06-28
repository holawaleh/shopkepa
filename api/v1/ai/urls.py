from django.urls import path
from . import views

urlpatterns = [
    path('ask/',     views.AIAskView.as_view(),     name='ai-ask'),
    path('usage/',   views.AIUsageView.as_view(),   name='ai-usage'),
    path('history/', views.AIHistoryView.as_view(), name='ai-history'),
]