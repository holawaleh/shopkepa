"""
Platform administration API - for the ShopKepa platform owner (Django
superuser) only. Read-mostly views across every business, plus the few
actions a platform owner needs: enable/disable a business or user, change a
business's subscription, and issue a password reset link.

Passwords are never exposed: they're stored as one-way hashes, so not even
the platform owner can read them. Access recovery is via reset links.
"""
import re
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import (
    Count, DecimalField, ExpressionWrapper, F, IntegerField, Max, OuterRef, Q, Subquery, Sum,
)
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from api.v1.auth.views import issue_password_reset_link
from core.models import (
    AuditLog, Branch, Business, BusinessModule, Expense, Product, Sale, SaleItem, User,
)
from core.pagination import LargePagination
from core.permissions import IsPlatformAdmin
from core.utils import get_client_ip, log_audit

from .serializers import UpdateBusinessSerializer, UpdateUserSerializer

ZERO = Decimal('0')
MONEY = DecimalField(max_digits=18, decimal_places=2)


def _money(qs, field):
    return qs.aggregate(v=Coalesce(Sum(field), ZERO, output_field=MONEY))['v']


def _per_business(qs, value_expr, output_field):
    """Correlated subquery: one aggregated value per business row."""
    return Subquery(
        qs.filter(business=OuterRef('pk')).order_by().values('business')
          .annotate(v=value_expr).values('v')[:1],
        output_field=output_field,
    )


SALES_FIELDS = (('revenue', 'total_amount'), ('collected', 'amount_paid'), ('outstanding', 'balance_due'))


def _sales_summaries(sales_qs, **windows):
    """Count/revenue/collected/outstanding for several time windows in ONE
    query (conditional aggregates). windows: name -> Q filter, or None = all."""
    agg = {}
    for name, cond in windows.items():
        agg[f'{name}__count'] = Count('id', filter=cond)
        for out, field in SALES_FIELDS:
            agg[f'{name}__{out}'] = Coalesce(Sum(field, filter=cond), ZERO, output_field=MONEY)
    row = sales_qs.aggregate(**agg)
    keys = ('count',) + tuple(out for out, _ in SALES_FIELDS)
    return {name: {k: row[f'{name}__{k}'] for k in keys} for name in windows}


def _cost_summaries(items_qs, **windows):
    """Cost of goods sold, estimated from each product's *current* cost
    price (sale lines don't snapshot cost), per window in ONE query. Lines
    whose product has no cost price are left out of both sides so the
    margin isn't inflated."""
    known = Q(product__cost_price__isnull=False)
    unknown = Q(product__cost_price__isnull=True)
    cost = ExpressionWrapper(F('quantity') * F('product__cost_price'), output_field=MONEY)
    agg = {}
    for name, cond in windows.items():
        k = known & cond if cond is not None else known
        u = unknown & cond if cond is not None else unknown
        agg[f'{name}__cogs'] = Coalesce(Sum(cost, filter=k), ZERO, output_field=MONEY)
        agg[f'{name}__rev'] = Coalesce(Sum('line_total', filter=k), ZERO, output_field=MONEY)
        agg[f'{name}__missing'] = Count('id', filter=u)
    row = items_qs.aggregate(**agg)
    return {name: {
        'cost_of_goods': row[f'{name}__cogs'],
        'revenue_with_known_cost': row[f'{name}__rev'],
        'gross_profit': row[f'{name}__rev'] - row[f'{name}__cogs'],
        'lines_without_cost_price': row[f'{name}__missing'],
    } for name in windows}


def _names_for(user_ids):
    return {
        str(u['id']): u['full_name']
        for u in User.objects.filter(id__in=set(filter(None, user_ids))).values('id', 'full_name')
    }


def _frontend_base(request):
    """Build reset links on the site the admin is actually using, if it's
    one of ours (CORS-allowed); otherwise fall back to FRONTEND_URL."""
    origin = request.headers.get('Origin', '')
    allowed = list(getattr(settings, 'CORS_ALLOWED_ORIGINS', []))
    patterns = getattr(settings, 'CORS_ALLOWED_ORIGIN_REGEXES', [])
    if origin and (origin in allowed or any(re.match(p, origin) for p in patterns)):
        return origin
    return settings.FRONTEND_URL


# ── Overview ────────────────────────────────────────────────────────────────

class PlatformOverviewView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        now = timezone.now()
        today = timezone.localdate()
        d7, d30 = now - timedelta(days=7), now - timedelta(days=30)

        sales = Sale.objects.filter(is_deleted=False)
        businesses = Business.objects.all()

        b = businesses.aggregate(
            total=Count('id'),
            active=Count('id', filter=Q(is_active=True)),
            disabled=Count('id', filter=Q(is_active=False)),
            new_7d=Count('id', filter=Q(created_at__gte=d7)),
            new_30d=Count('id', filter=Q(created_at__gte=d30)),
        )
        u = User.objects.filter(is_deleted=False, is_superuser=False).aggregate(
            total=Count('id'),
            active=Count('id', filter=Q(is_active=True)),
            disabled=Count('id', filter=Q(is_active=False)),
        )
        # "Used" = made a sale or someone logged in during the last 7 days
        b['used_in_last_7d'] = businesses.filter(
            Q(sales__created_at__gte=d7, sales__is_deleted=False)
            | Q(id__in=AuditLog.objects.filter(action='LOGIN', created_at__gte=d7).values('business_id'))
        ).distinct().count()
        sales_windows = _sales_summaries(
            sales, today=Q(sale_date=today), last_30d=Q(created_at__gte=d30), all_time=None,
        )

        signups = (
            businesses.filter(created_at__gte=d30)
            .annotate(day=TruncDate('created_at')).values('day')
            .annotate(n=Count('id')).order_by('day')
        )

        top = (
            businesses.annotate(revenue_30d=Coalesce(
                _per_business(sales.filter(created_at__gte=d30), Sum('total_amount'), MONEY),
                ZERO, output_field=MONEY,
            ))
            .filter(revenue_30d__gt=0).order_by('-revenue_30d')[:5]
        )

        return Response({
            'businesses': b,
            'users': u,
            'sales': sales_windows,
            'signups_by_day': [{'date': r['day'], 'count': r['n']} for r in signups],
            'top_businesses_30d': [
                {'id': str(b.id), 'name': b.name, 'revenue': b.revenue_30d} for b in top
            ],
            'recent_signups': [
                {'id': str(b.id), 'name': b.name, 'owner_name': b.owner_name,
                 'created_at': b.created_at, 'is_active': b.is_active}
                for b in businesses.order_by('-created_at')[:6]
            ],
        })


# ── Businesses ──────────────────────────────────────────────────────────────

class PlatformBusinessListView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        sales = Sale.objects.filter(is_deleted=False)
        qs = Business.objects.annotate(
            user_count=Coalesce(_per_business(
                User.objects.filter(is_deleted=False), Count('id'), IntegerField()), 0),
            sales_count=Coalesce(_per_business(sales, Count('id'), IntegerField()), 0),
            revenue=Coalesce(_per_business(sales, Sum('total_amount'), MONEY), ZERO, output_field=MONEY),
            last_sale_at=_per_business(sales, Max('created_at'), Sale._meta.get_field('created_at')),
            last_login_at=_per_business(
                User.objects.all(), Max('last_login_at'), User._meta.get_field('last_login_at')),
        )

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) | Q(owner_name__icontains=search)
                | Q(email__icontains=search) | Q(phone_number__icontains=search)
                | Q(users__email__icontains=search) | Q(users__username__icontains=search)
            ).distinct()
        state = request.query_params.get('status')
        if state in ('active', 'disabled'):
            qs = qs.filter(is_active=(state == 'active'))

        qs = qs.order_by('-created_at')
        paginator = LargePagination()
        page = paginator.paginate_queryset(qs, request, view=self)

        modules = {}
        for bm in BusinessModule.objects.filter(
            business__in=page, is_active=True,
        ).select_related('module'):
            modules.setdefault(bm.business_id, []).append(bm.module.name)

        return paginator.get_paginated_response([{
            'id': str(b.id),
            'name': b.name,
            'owner_name': b.owner_name,
            'email': b.email,
            'phone_number': b.phone_number,
            'created_at': b.created_at,
            'is_active': b.is_active,
            'subscription_tier': b.subscription_tier,
            'subscription_expires_at': b.subscription_expires_at,
            'modules': modules.get(b.id, []),
            'user_count': b.user_count,
            'sales_count': b.sales_count,
            'revenue': b.revenue,
            'last_sale_at': b.last_sale_at,
            'last_login_at': b.last_login_at,
            'last_activity_at': max(filter(None, [b.last_sale_at, b.last_login_at]), default=None),
        } for b in page])


class PlatformBusinessDetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    def _get(self, business_id):
        return Business.objects.filter(id=business_id).first()

    def get(self, request, business_id):
        business = self._get(business_id)
        if not business:
            return Response({'error': 'Business not found.'}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        d30 = now - timedelta(days=30)
        sales = Sale.objects.filter(business=business, is_deleted=False)
        items = SaleItem.objects.filter(sale__business=business, sale__is_deleted=False)
        expenses = Expense.objects.filter(business=business, is_deleted=False)

        sales_w = _sales_summaries(sales, last_30d=Q(created_at__gte=d30), all_time=None)
        cost_w = _cost_summaries(items, last_30d=Q(sale__created_at__gte=d30), all_time=None)
        expenses_30d = _money(expenses.filter(created_at__gte=d30), 'amount')

        products = (
            Product.objects.filter(business=business, is_deleted=False)
            .select_related('module', 'category')
            .annotate(stock=Coalesce(Sum('inventory__quantity_in_stock'), 0))
            .order_by('name')[:200]
        )
        recent_lines = (
            items.select_related('sale', 'product').order_by('-created_at')[:40]
        )
        activity = list(AuditLog.objects.filter(business_id=business.id).order_by('-created_at')[:40])
        names = _names_for(a.user_id for a in activity)

        return Response({
            'business': {
                'id': str(business.id), 'name': business.name, 'owner_name': business.owner_name,
                'email': business.email, 'phone_number': business.phone_number,
                'address': business.address, 'created_at': business.created_at,
                'is_active': business.is_active,
                'subscription_tier': business.subscription_tier,
                'subscription_model': business.subscription_model,
                'subscription_expires_at': business.subscription_expires_at,
                'ai_queries_used': business.ai_queries_used,
                'ai_queries_limit': business.ai_queries_limit,
                'modules': list(BusinessModule.objects.filter(business=business, is_active=True)
                                .values_list('module__name', flat=True)),
            },
            'users': [_user_row(u) for u in _users_with_login_stats(
                User.objects.filter(business=business).order_by('-is_active', 'role', 'full_name'))],
            'branches': list(Branch.objects.filter(business=business, is_deleted=False)
                             .values('id', 'name', 'is_main_branch', 'created_at')),
            'sales': {
                'all_time': {**sales_w['all_time'], **cost_w['all_time']},
                'last_30d': {
                    **sales_w['last_30d'], **cost_w['last_30d'],
                    'expenses': expenses_30d,
                    'net_profit_estimate': cost_w['last_30d']['gross_profit'] - expenses_30d,
                },
            },
            'products': [{
                'id': str(p.id), 'name': p.name, 'sku': p.sku,
                'module': p.module.name, 'category': p.category.name if p.category else None,
                'cost_price': p.cost_price, 'wholesale_price': p.wholesale_price,
                'retail_price': p.retail_price, 'stock': p.stock, 'is_active': p.is_active,
                'margin_pct': (
                    round((p.retail_price - p.cost_price) / p.retail_price * 100, 1)
                    if p.cost_price is not None and p.retail_price else None
                ),
            } for p in products],
            'recent_sale_lines': [{
                'date': line.sale.created_at, 'sale_number': line.sale.sale_number,
                'product': line.product_name, 'quantity': line.quantity,
                'sold_unit_price': line.unit_price, 'line_total': line.line_total,
                'cost_price': line.product.cost_price if line.product else None,
                'price_type': line.price_type,
            } for line in recent_lines],
            'activity': [_activity_row(a, names, {business.id: business.name}) for a in activity],
        })

    @transaction.atomic
    def patch(self, request, business_id):
        business = self._get(business_id)
        if not business:
            return Response({'error': 'Business not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateBusinessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        old = {f: getattr(business, f) for f in data}
        for field, value in data.items():
            setattr(business, field, value)
        business.save()

        log_audit(
            business_id=business.id, user_id=request.user.id,
            action='DEACTIVATE' if data.get('is_active') is False else 'UPDATE',
            table_name='platform:businesses', record_id=business.id,
            old_values=old, new_values=data, ip_address=get_client_ip(request),
        )
        return Response({'id': str(business.id), **{f: getattr(business, f) for f in data}})


# ── Users ───────────────────────────────────────────────────────────────────

def _users_with_login_stats(qs):
    logins = AuditLog.objects.filter(action='LOGIN', user_id=OuterRef('pk')).order_by('-created_at')
    return qs.select_related('business').annotate(
        login_count=Coalesce(Subquery(
            AuditLog.objects.filter(action='LOGIN', user_id=OuterRef('pk')).order_by()
            .values('user_id').annotate(n=Count('id')).values('n')[:1]
        ), 0),
        last_login_ip=Subquery(logins.values('ip_address')[:1]),
    )


def _user_row(u):
    return {
        'id': str(u.id),
        'full_name': u.full_name,
        'username': u.username,
        'email': u.email,
        'phone_number': u.phone_number,
        'role': 'platform admin' if u.is_superuser else u.role,
        'is_active': u.is_active,
        'is_deleted': u.is_deleted,
        'is_superuser': u.is_superuser,
        'business': {'id': str(u.business_id), 'name': u.business.name,
                     'is_active': u.business.is_active} if u.business_id else None,
        'signed_up_at': u.created_at,
        'last_login_at': u.last_login_at,
        'login_count': getattr(u, 'login_count', None),
        'last_login_ip': getattr(u, 'last_login_ip', None),
    }


class PlatformUserListView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        qs = User.objects.filter(is_deleted=False)
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(full_name__icontains=search) | Q(username__icontains=search)
                | Q(email__icontains=search) | Q(phone_number__icontains=search)
                | Q(business__name__icontains=search)
            )
        state = request.query_params.get('status')
        if state in ('active', 'disabled'):
            qs = qs.filter(is_active=(state == 'active'))
        if request.query_params.get('role'):
            qs = qs.filter(role=request.query_params['role'])
        if request.query_params.get('business_id'):
            qs = qs.filter(business_id=request.query_params['business_id'])

        qs = _users_with_login_stats(qs).order_by('-created_at')
        paginator = LargePagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        return paginator.get_paginated_response([_user_row(u) for u in page])


class PlatformUserDetailView(APIView):
    permission_classes = [IsPlatformAdmin]

    @transaction.atomic
    def patch(self, request, user_id):
        user = User.objects.filter(id=user_id, is_deleted=False).select_related('business').first()
        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        if user.is_superuser:
            return Response(
                {'error': 'Platform admin accounts cannot be changed from here.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = UpdateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_active = serializer.validated_data['is_active']
        user.is_active = is_active
        user.save(update_fields=['is_active', 'updated_at'])

        if not is_active:
            # Sign them out everywhere now, rather than whenever their
            # refresh token would next be used.
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)

        if user.business_id:
            log_audit(
                business_id=user.business_id, user_id=request.user.id,
                action='UPDATE' if is_active else 'DEACTIVATE',
                table_name='platform:users', record_id=user.id,
                new_values={'is_active': is_active, 'username': user.username},
                ip_address=get_client_ip(request),
            )
        return Response(_user_row(_users_with_login_stats(User.objects.filter(pk=user.pk)).get()))


class PlatformUserResetLinkView(APIView):
    """Issue a one-time password reset link for the admin to pass on
    (WhatsApp, SMS) - works even when outgoing email isn't configured."""
    permission_classes = [IsPlatformAdmin]

    def post(self, request, user_id):
        user = User.objects.filter(id=user_id, is_deleted=False).first()
        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)
        if user.is_superuser:
            return Response(
                {'error': 'Platform admin accounts cannot be changed from here.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        url = issue_password_reset_link(
            user, request_ip=get_client_ip(request), frontend_url=_frontend_base(request),
        )
        if user.business_id:
            log_audit(
                business_id=user.business_id, user_id=request.user.id,
                action='PASSWORD_RESET_ISSUED', table_name='platform:users', record_id=user.id,
                new_values={'username': user.username}, ip_address=get_client_ip(request),
            )
        return Response({
            'reset_url': url,
            'expires_in_minutes': 30,
            'user': {'full_name': user.full_name, 'email': user.email, 'phone_number': user.phone_number},
        }, status=status.HTTP_201_CREATED)


# ── Activity ────────────────────────────────────────────────────────────────

def _activity_row(a, user_names, business_names):
    return {
        'id': str(a.id),
        'at': a.created_at,
        'action': a.action,
        'table': a.table_name,
        'record_id': str(a.record_id),
        'user_id': str(a.user_id) if a.user_id else None,
        'user_name': user_names.get(str(a.user_id)) if a.user_id else None,
        'business_id': str(a.business_id),
        'business_name': business_names.get(a.business_id),
        'ip_address': a.ip_address,
        'old_values': a.old_values,
        'new_values': a.new_values,
    }


class PlatformActivityView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        qs = AuditLog.objects.all()
        params = request.query_params
        if params.get('business_id'):
            qs = qs.filter(business_id=params['business_id'])
        if params.get('user_id'):
            qs = qs.filter(user_id=params['user_id'])
        if params.get('action'):
            qs = qs.filter(action=params['action'])
        if params.get('date_from'):
            qs = qs.filter(created_at__date__gte=params['date_from'])
        if params.get('date_to'):
            qs = qs.filter(created_at__date__lte=params['date_to'])

        qs = qs.order_by('-created_at')
        paginator = LargePagination()
        page = paginator.paginate_queryset(qs, request, view=self)
        names = _names_for(a.user_id for a in page)
        businesses = dict(Business.objects.filter(
            id__in={a.business_id for a in page}).values_list('id', 'name'))
        return paginator.get_paginated_response([_activity_row(a, names, businesses) for a in page])
