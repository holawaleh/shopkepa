from django.urls import path
from . import views

urlpatterns = [
    path('profile/',      views.BusinessProfileView.as_view(),  name='business-profile'),
    path('settings/',     views.BusinessSettingsView.as_view(), name='business-settings'),
    path('subscription/', views.SubscriptionView.as_view(),     name='business-subscription'),
]