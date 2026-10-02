from django.urls import path

from . import views

urlpatterns = [
    path('overview/', views.PlatformOverviewView.as_view(), name='platform-overview'),
    path('businesses/', views.PlatformBusinessListView.as_view(), name='platform-businesses'),
    path('businesses/<uuid:business_id>/', views.PlatformBusinessDetailView.as_view(), name='platform-business-detail'),
    path('users/', views.PlatformUserListView.as_view(), name='platform-users'),
    path('users/<uuid:user_id>/', views.PlatformUserDetailView.as_view(), name='platform-user-detail'),
    path('users/<uuid:user_id>/reset-link/', views.PlatformUserResetLinkView.as_view(), name='platform-user-reset-link'),
    path('activity/', views.PlatformActivityView.as_view(), name='platform-activity'),
]
