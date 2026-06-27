from django.urls import path
from . import views

urlpatterns = [
    path('', views.ModuleListView.as_view(), name='module-list'),
    path('active/', views.ActiveModulesView.as_view(), name='module-active'),
    path('activate/', views.ActivateModulesView.as_view(), name='module-activate'),
    path('<uuid:module_id>/toggle/', views.ToggleModuleView.as_view(), name='module-toggle'),
]