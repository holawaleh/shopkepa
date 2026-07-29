from datetime import timedelta

from django.contrib import admin
from django.db.models import Count, Sum, Max, Q
from django.shortcuts import render
from django.urls import path
from django.utils import timezone

from core.models import (
    Business, BusinessSettings, AuditLog, User, Sale,
)


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    change_list_template = 'admin/core/business/change_list.html'
    list_display = (
        'name', 'owner_name', 'email', 'phone_number',
        'subscription_tier', 'subscription_model', 'is_active',
        'subscription_expires_at', 'ai_queries_used', 'ai_queries_limit',
        'created_at',
    )
    list_filter = ('subscription_tier', 'subscription_model', 'is_active')
    search_fields = ('name', 'owner_name', 'email', 'phone_number')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at')

    def get_urls(self):
        return [
            path(
                'usage-dashboard/',
                self.admin_site.admin_view(self.usage_dashboard),
                name='business-usage-dashboard',
            ),
        ] + super().get_urls()

    def usage_dashboard(self, request):
        since_30d = (timezone.now() - timedelta(days=30)).date()

        businesses = Business.objects.annotate(
            user_count=Count(
                'users', filter=Q(users__is_deleted=False), distinct=True
            ),
        ).order_by('-created_at')

        sales_by_business = {
            row['business_id']: row
            for row in Sale.objects.filter(
                sale_date__gte=since_30d, is_deleted=False
            ).values('business_id').annotate(
                sales_30d=Count('id'),
                revenue_30d=Sum('amount_paid'),
            )
        }
        last_activity_by_business = {
            row['business_id']: row['last_seen']
            for row in AuditLog.objects.values('business_id')
                .annotate(last_seen=Max('created_at'))
        }

        rows = []
        for business in businesses:
            stats = sales_by_business.get(business.id, {})
            expires_at = business.subscription_expires_at
            rows.append({
                'business': business,
                'user_count': business.user_count,
                'sales_30d': stats.get('sales_30d', 0),
                'revenue_30d': stats.get('revenue_30d') or 0,
                'last_activity': last_activity_by_business.get(business.id),
                'expired': bool(expires_at and expires_at < timezone.now()),
            })

        rows.sort(
            key=lambda r: r['last_activity'] or timezone.datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

        return render(request, 'admin/business_usage_dashboard.html', {
            **self.admin_site.each_context(request),
            'title': 'Client Usage Dashboard',
            'rows': rows,
        })


@admin.register(BusinessSettings)
class BusinessSettingsAdmin(admin.ModelAdmin):
    list_display = ('business', 'currency_symbol', 'low_stock_alert_enabled', 'expiry_alert_days')
    search_fields = ('business__name',)
    autocomplete_fields = ('business',)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'business_id', 'user_id', 'action', 'table_name', 'record_id', 'ip_address')
    list_filter = ('action', 'table_name')
    search_fields = ('business_id', 'user_id', 'record_id', 'ip_address')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        'username', 'full_name', 'email', 'business',
        'role', 'is_active', 'is_staff', 'is_superuser', 'last_login_at',
    )
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'full_name', 'email', 'phone_number')
    ordering = ('-created_at',)
    readonly_fields = ('id', 'created_at', 'updated_at', 'last_login_at')
    autocomplete_fields = ('business',)
