from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncDate, TruncWeek
from django.utils.dateparse import parse_date
from datetime import date, timedelta
from decimal import Decimal

from core.models import (
    Sale, SaleItem, Payment, Customer,
    Expense, BranchInventory, InstallmentPlan,
    JobCard, Branch, Product
)
from core.permissions import IsManagerOrAbove


def get_date_range(request, default_days=30):
    date_from = request.query_params.get('date_from')
    date_to   = request.query_params.get('date_to')
    if date_from:
        date_from = parse_date(date_from)
    else:
        date_from = date.today() - timedelta(days=default_days)
    if date_to:
        date_to = parse_date(date_to)
    else:
        date_to = date.today()
    return date_from, date_to


class DailySalesReportView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business    = request.user.business
        branch_id   = request.query_params.get('branch_id')
        report_date = request.query_params.get('date', str(date.today()))
        report_date = parse_date(report_date) or date.today()

        sales = Sale.objects.filter(
            business=business,
            sale_date=report_date,
            is_deleted=False
        )
        if branch_id:
            sales = sales.filter(branch_id=branch_id)

        totals = sales.aggregate(
            total_revenue=Sum('amount_paid'),
            total_transactions=Count('id'),
            total_discount=Sum('discount_amount'),
        )

        by_payment = {}
        for method in ['cash', 'transfer', 'pos']:
            method_qs = Payment.objects.filter(
                business=business,
                payment_date=report_date,
                payment_method=method,
                sale__is_deleted=False
            )
            if branch_id:
                method_qs = method_qs.filter(branch_id=branch_id)
            by_payment[method] = str(
                method_qs.aggregate(total=Sum('amount'))['total'] or 0
            )

        top_products = SaleItem.objects.filter(
            sale__business=business,
            sale__sale_date=report_date,
            sale__is_deleted=False,
        )
        if branch_id:
            top_products = top_products.filter(sale__branch_id=branch_id)

        top_products = top_products.values(
            'product_name'
        ).annotate(
            total_qty=Sum('quantity'),
            total_revenue=Sum('line_total')
        ).order_by('-total_qty')[:5]

        by_staff = sales.values(
            'created_by__full_name'
        ).annotate(
            transactions=Count('id'),
            revenue=Sum('amount_paid')
        ).order_by('-revenue')

        return Response({
            'date':               str(report_date),
            'total_revenue':      str(totals['total_revenue'] or 0),
            'total_transactions': totals['total_transactions'] or 0,
            'total_discount':     str(totals['total_discount'] or 0),
            'by_payment_method':  by_payment,
            'top_products':       list(top_products),
            'by_staff':           list(by_staff),
        })


class WeeklySalesReportView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business  = request.user.business
        branch_id = request.query_params.get('branch_id')

        today      = date.today()
        week_start = today - timedelta(days=today.weekday())
        week_end   = week_start + timedelta(days=6)

        date_from = parse_date(
            request.query_params.get('date_from', str(week_start))
        )
        date_to = parse_date(
            request.query_params.get('date_to', str(week_end))
        )

        sales = Sale.objects.filter(
            business=business,
            sale_date__range=[date_from, date_to],
            is_deleted=False
        )
        if branch_id:
            sales = sales.filter(branch_id=branch_id)

        daily = sales.annotate(
            day=TruncDate('sale_date')
        ).values('day').annotate(
            revenue=Sum('amount_paid'),
            transactions=Count('id'),
        ).order_by('day')

        total_revenue = sales.aggregate(
            total=Sum('amount_paid')
        )['total'] or 0

        prev_start   = date_from - timedelta(days=7)
        prev_end     = date_to   - timedelta(days=7)
        prev_sales   = Sale.objects.filter(
            business=business,
            sale_date__range=[prev_start, prev_end],
            is_deleted=False
        )
        if branch_id:
            prev_sales = prev_sales.filter(branch_id=branch_id)

        prev_revenue = prev_sales.aggregate(
            total=Sum('amount_paid')
        )['total'] or Decimal('0')

        if prev_revenue > 0:
            vs_last_week = round(
                float(
                    (Decimal(str(total_revenue)) - prev_revenue)
                    / prev_revenue * 100
                ), 1
            )
        else:
            vs_last_week = 0

        return Response({
            'period':           f"{date_from} to {date_to}",
            'total_revenue':    str(total_revenue),
            'transactions':     sales.count(),
            'vs_last_week_pct': vs_last_week,
            'daily_breakdown': [
                {
                    'day':          str(d['day']),
                    'revenue':      str(d['revenue'] or 0),
                    'transactions': d['transactions'],
                }
                for d in daily
            ],
        })


class MonthlySalesReportView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business  = request.user.business
        branch_id = request.query_params.get('branch_id')
        module_id = request.query_params.get('module_id')

        today       = date.today()
        month_start = today.replace(day=1)
        if today.month == 12:
            month_end = today.replace(
                year=today.year + 1, month=1, day=1
            ) - timedelta(days=1)
        else:
            month_end = today.replace(
                month=today.month + 1, day=1
            ) - timedelta(days=1)

        date_from = parse_date(
            request.query_params.get('date_from', str(month_start))
        )
        date_to = parse_date(
            request.query_params.get('date_to', str(month_end))
        )

        sales = Sale.objects.filter(
            business=business,
            sale_date__range=[date_from, date_to],
            is_deleted=False
        )
        if branch_id:
            sales = sales.filter(branch_id=branch_id)
        if module_id:
            sales = sales.filter(module_id=module_id)

        total_revenue = sales.aggregate(
            total=Sum('amount_paid')
        )['total'] or 0

        weekly = sales.annotate(
            week=TruncWeek('sale_date')
        ).values('week').annotate(
            revenue=Sum('amount_paid'),
            transactions=Count('id'),
        ).order_by('week')

        by_module = sales.values(
            'module__name'
        ).annotate(
            revenue=Sum('amount_paid'),
            transactions=Count('id'),
        ).order_by('-revenue')

        prev_start   = (month_start - timedelta(days=1)).replace(day=1)
        prev_end     = month_start - timedelta(days=1)
        prev_revenue = Sale.objects.filter(
            business=business,
            sale_date__range=[prev_start, prev_end],
            is_deleted=False
        ).aggregate(total=Sum('amount_paid'))['total'] or Decimal('0')

        if prev_revenue > 0:
            vs_last_month = round(
                float(
                    (Decimal(str(total_revenue)) - prev_revenue)
                    / prev_revenue * 100
                ), 1
            )
        else:
            vs_last_month = 0

        return Response({
            'period':            f"{date_from} to {date_to}",
            'total_revenue':     str(total_revenue),
            'transactions':      sales.count(),
            'vs_last_month_pct': vs_last_month,
            'weekly_breakdown': [
                {
                    'week':         str(w['week']),
                    'revenue':      str(w['revenue'] or 0),
                    'transactions': w['transactions'],
                }
                for w in weekly
            ],
            'by_module': [
                {
                    'module':       bm['module__name'],
                    'revenue':      str(bm['revenue'] or 0),
                    'transactions': bm['transactions'],
                }
                for bm in by_module
            ],
        })


class DebtorReportView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business  = request.user.business
        branch_id = request.query_params.get('branch_id')

        plans = InstallmentPlan.objects.filter(
            business=business,
            status__in=['active', 'overdue']
        ).select_related('customer', 'sale')

        if branch_id:
            plans = plans.filter(sale__branch_id=branch_id)

        plans = plans.order_by('-current_balance')

        total_outstanding = plans.aggregate(
            total=Sum('current_balance')
        )['total'] or 0

        debtors = []
        for plan in plans:
            days_outstanding = (date.today() - plan.created_at.date()).days
            debtors.append({
                'plan_id':          str(plan.id),
                'customer_name':    plan.customer.full_name,
                'customer_phone':   plan.customer.phone_number,
                'sale_number':      plan.sale.sale_number,
                'total_amount':     str(plan.total_amount),
                'amount_paid':      str(plan.total_amount - plan.current_balance),
                'balance':          str(plan.current_balance),
                'tranches_used':    plan.tranches_used,
                'max_tranches':     plan.max_tranches,
                'days_outstanding': days_outstanding,
                'status':           plan.status,
            })

        unpaid_jobs = JobCard.objects.filter(
            business=business,
            payment_status__in=['unpaid', 'partial'],
            is_deleted=False
        ).select_related('customer')

        if branch_id:
            unpaid_jobs = unpaid_jobs.filter(branch_id=branch_id)

        job_debts = []
        for job in unpaid_jobs:
            job_debts.append({
                'job_number':     job.job_number,
                'customer_name':  job.customer_name,
                'customer_phone': job.customer_phone,
                'device':         job.device_description,
                'total_charge':   str(job.total_charge),
                'amount_paid':    str(job.amount_paid),
                'balance_due':    str(job.balance_due),
                'payment_status': job.payment_status,
            })

        total_job_debt = sum(float(j['balance_due']) for j in job_debts)

        return Response({
            'total_outstanding_sales': str(total_outstanding),
            'total_outstanding_jobs':  str(total_job_debt),
            'total_outstanding':       str(float(total_outstanding) + total_job_debt),
            'active_plans':            plans.filter(status='active').count(),
            'overdue_plans':           plans.filter(status='overdue').count(),
            'debtors':                 debtors,
            'unpaid_job_cards':        job_debts,
        })


class InventoryReportView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business  = request.user.business
        branch_id = request.query_params.get('branch_id')
        module_id = request.query_params.get('module_id')

        products = Product.objects.filter(
            business=business,
            is_deleted=False
        )
        if module_id:
            products = products.filter(module_id=module_id)

        inventory = BranchInventory.objects.filter(business=business)
        if branch_id:
            inventory = inventory.filter(branch_id=branch_id)

        total_products  = products.count()
        active_products = products.filter(is_active=True).count()

        low_stock = [
            {
                'product': i.product.name,
                'branch':  i.branch.name,
                'stock':   i.quantity_in_stock,
                'reorder': i.product.reorder_level,
            }
            for i in inventory.select_related('product', 'branch')
            if i.quantity_in_stock <= i.product.reorder_level
            and not i.product.is_deleted
        ]

        out_of_stock = [i for i in low_stock if i['stock'] == 0]

        from core.models import ProductAttribute
        alert_days = getattr(business.settings, 'expiry_alert_days', 30)
        alert_date = date.today() + timedelta(days=alert_days)
        expiring   = ProductAttribute.objects.filter(
            business=business,
            attribute_key='expiry_date',
            attribute_value__lte=str(alert_date),
            attribute_value__gte=str(date.today()),
        ).count()

        return Response({
            'total_products':      total_products,
            'active_products':     active_products,
            'low_stock_count':     len(low_stock),
            'out_of_stock_count':  len(out_of_stock),
            'expiring_soon_count': expiring,
            'low_stock_items':     low_stock[:20],
            'out_of_stock_items':  out_of_stock[:20],
        })


class CustomerReportView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business            = request.user.business
        date_from, date_to  = get_date_range(request, default_days=30)

        customers = Customer.objects.filter(
            business=business,
            is_deleted=False
        )

        total_customers = customers.count()

        new_customers = customers.filter(
            created_at__date__range=[date_from, date_to]
        ).count()

        returning = customers.filter(
            last_purchase_date__range=[date_from, date_to]
        ).exclude(
            created_at__date__range=[date_from, date_to]
        ).count()

        sixty_days_ago = date.today() - timedelta(days=60)
        dormant = customers.filter(
            Q(last_purchase_date__lt=sixty_days_ago) |
            Q(last_purchase_date__isnull=True)
        ).order_by('last_purchase_date')[:10]

        top_customers = customers.order_by('-lifetime_spend')[:10]

        by_loyalty = customers.values(
            'loyalty_tag'
        ).annotate(count=Count('id')).order_by('loyalty_tag')

        return Response({
            'period':          f"{date_from} to {date_to}",
            'total_customers': total_customers,
            'new_this_period': new_customers,
            'returning':       returning,
            'by_loyalty_tag':  list(by_loyalty),
            'dormant_customers': [
                {
                    'name':           c.full_name,
                    'phone':          c.phone_number,
                    'last_purchase':  str(c.last_purchase_date) if c.last_purchase_date else 'Never',
                    'lifetime_spend': str(c.lifetime_spend),
                }
                for c in dormant
            ],
            'top_10_by_spend': [
                {
                    'name':             c.full_name,
                    'phone':            c.phone_number,
                    'loyalty_tag':      c.loyalty_tag,
                    'lifetime_spend':   str(c.lifetime_spend),
                    'outstanding_debt': str(c.total_outstanding_debt),
                }
                for c in top_customers
            ],
        })


class BranchReportView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business           = request.user.business
        date_from, date_to = get_date_range(request, default_days=30)

        branches = Branch.objects.filter(
            business=business,
            is_deleted=False
        )

        report = []
        for branch in branches:
            sales = Sale.objects.filter(
                business=business,
                branch=branch,
                sale_date__range=[date_from, date_to],
                is_deleted=False
            )
            expenses = Expense.objects.filter(
                business=business,
                branch=branch,
                expense_date__range=[date_from, date_to],
                is_deleted=False
            )

            revenue = sales.aggregate(
                total=Sum('amount_paid')
            )['total'] or Decimal('0')

            total_expenses = expenses.aggregate(
                total=Sum('amount')
            )['total'] or Decimal('0')

            top_product = SaleItem.objects.filter(
                sale__business=business,
                sale__branch=branch,
                sale__sale_date__range=[date_from, date_to],
                sale__is_deleted=False,
            ).values('product_name').annotate(
                qty=Sum('quantity')
            ).order_by('-qty').first()

            report.append({
                'branch':       branch.name,
                'is_main':      branch.is_main_branch,
                'revenue':      str(revenue),
                'expenses':     str(total_expenses),
                'net_profit':   str(float(revenue) - float(total_expenses)),
                'transactions': sales.count(),
                'top_product':  top_product['product_name'] if top_product else None,
            })

        report.sort(key=lambda x: float(x['revenue']), reverse=True)

        return Response({
            'period':   f"{date_from} to {date_to}",
            'branches': report,
        })


class ExpenseReportView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business           = request.user.business
        branch_id          = request.query_params.get('branch_id')
        date_from, date_to = get_date_range(request, default_days=30)

        expenses = Expense.objects.filter(
            business=business,
            expense_date__range=[date_from, date_to],
            is_deleted=False
        )
        if branch_id:
            expenses = expenses.filter(branch_id=branch_id)

        total_expenses = expenses.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0')

        by_category = expenses.values(
            'category__name'
        ).annotate(total=Sum('amount')).order_by('-total')

        by_branch = expenses.values(
            'branch__name'
        ).annotate(total=Sum('amount')).order_by('-total')

        sales = Sale.objects.filter(
            business=business,
            sale_date__range=[date_from, date_to],
            is_deleted=False
        )
        if branch_id:
            sales = sales.filter(branch_id=branch_id)

        total_sales = sales.aggregate(
            total=Sum('amount_paid')
        )['total'] or Decimal('0')

        net_profit = float(total_sales) - float(total_expenses)

        period_days   = (date_to - date_from).days
        prev_start    = date_from - timedelta(days=period_days)
        prev_end      = date_from - timedelta(days=1)
        prev_expenses = Expense.objects.filter(
            business=business,
            expense_date__range=[prev_start, prev_end],
            is_deleted=False
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        if prev_expenses > 0:
            expense_change = round(
                float(
                    (total_expenses - prev_expenses)
                    / prev_expenses * 100
                ), 1
            )
        else:
            expense_change = 0

        return Response({
            'period':             f"{date_from} to {date_to}",
            'total_expenses':     str(total_expenses),
            'total_sales':        str(total_sales),
            'net_profit':         str(net_profit),
            'expense_change_pct': expense_change,
            'by_category': [
                {
                    'category': b['category__name'],
                    'total':    str(b['total']),
                }
                for b in by_category
            ],
            'by_branch': [
                {
                    'branch': b['branch__name'],
                    'total':  str(b['total']),
                }
                for b in by_branch
            ],
        })