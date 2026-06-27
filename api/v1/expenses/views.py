from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.db.models import Sum, Q
from django.utils.dateparse import parse_date

from core.models import Expense, ExpenseCategory, Branch
from core.permissions import IsManagerOrAbove
from core.utils import log_audit, get_client_ip
from .serializers import (
    ExpenseSerializer, ExpenseCategorySerializer,
    CreateExpenseSerializer, CreateCategorySerializer
)


class ExpenseCategoryListCreateView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business = request.user.business
        # Return global categories + business-specific categories
        categories = ExpenseCategory.objects.filter(
            Q(business=business) | Q(business__isnull=True),
            is_active=True
        ).order_by('name')
        serializer = ExpenseCategorySerializer(categories, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CreateCategorySerializer(
            data=request.data,
            context={'request': request}
        )
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        category = ExpenseCategory.objects.create(
            business=request.user.business,
            name=serializer.validated_data['name'],
            is_custom=True,
            created_by=request.user,
        )

        return Response(
            ExpenseCategorySerializer(category).data,
            status=status.HTTP_201_CREATED
        )


class ExpenseListCreateView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business  = request.user.business
        queryset  = Expense.objects.filter(
            business=business,
            is_deleted=False
        ).select_related('category', 'branch', 'created_by')

        # Filters
        branch_id   = request.query_params.get('branch_id')
        category_id = request.query_params.get('category_id')
        date_from   = request.query_params.get('date_from')
        date_to     = request.query_params.get('date_to')

        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if date_from:
            queryset = queryset.filter(expense_date__gte=parse_date(date_from))
        if date_to:
            queryset = queryset.filter(expense_date__lte=parse_date(date_to))

        queryset = queryset.order_by('-expense_date', '-created_at')
        serializer = ExpenseSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CreateExpenseSerializer(
            data=request.data,
            context={'request': request}
        )
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        data    = serializer.validated_data
        business = request.user.business

        expense = Expense.objects.create(
            business=business,
            branch_id=data['branch_id'],
            category_id=data['category_id'],
            amount=data['amount'],
            description=data.get('description', ''),
            created_by=request.user,
        )

        log_audit(
            business_id=business.id,
            user_id=request.user.id,
            action='CREATE',
            table_name='expenses',
            record_id=expense.id,
            new_values={
                'amount': str(expense.amount),
                'category': str(expense.category_id),
            },
            ip_address=get_client_ip(request),
        )

        return Response(
            ExpenseSerializer(expense).data,
            status=status.HTTP_201_CREATED
        )


class ExpenseDetailView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get_expense(self, request, expense_id):
        try:
            return Expense.objects.get(
                id=expense_id,
                business=request.user.business,
                is_deleted=False
            )
        except Expense.DoesNotExist:
            return None

    def get(self, request, expense_id):
        expense = self.get_expense(request, expense_id)
        if not expense:
            return Response(
                {'error': 'Expense not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(ExpenseSerializer(expense).data)

    def patch(self, request, expense_id):
        expense = self.get_expense(request, expense_id)
        if not expense:
            return Response(
                {'error': 'Expense not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Only allow same-day edits
        if expense.expense_date != timezone.now().date():
            return Response(
                {'error': 'You can only edit expenses recorded today.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = request.data
        if 'amount' in data:
            if float(data['amount']) <= 0:
                return Response(
                    {'error': 'Amount must be greater than zero.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            expense.amount = data['amount']
        if 'description' in data:
            expense.description = data['description']
        if 'category_id' in data:
            expense.category_id = data['category_id']
        expense.save()

        return Response(ExpenseSerializer(expense).data)

    def delete(self, request, expense_id):
        expense = self.get_expense(request, expense_id)
        if not expense:
            return Response(
                {'error': 'Expense not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        expense.is_deleted = True
        expense.deleted_at = timezone.now()
        expense.save()

        return Response(status=status.HTTP_204_NO_CONTENT)


class ExpenseSummaryView(APIView):
    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        business  = request.user.business
        branch_id = request.query_params.get('branch_id')
        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')

        queryset = Expense.objects.filter(
            business=business,
            is_deleted=False
        )

        if branch_id:
            queryset = queryset.filter(branch_id=branch_id)
        if date_from:
            queryset = queryset.filter(
                expense_date__gte=parse_date(date_from)
            )
        if date_to:
            queryset = queryset.filter(
                expense_date__lte=parse_date(date_to)
            )

        total_expenses = queryset.aggregate(
            total=Sum('amount')
        )['total'] or 0

        # By category
        by_category = []
        categories  = ExpenseCategory.objects.filter(
            Q(business=business) | Q(business__isnull=True)
        )
        for cat in categories:
            cat_total = queryset.filter(
                category=cat
            ).aggregate(total=Sum('amount'))['total'] or 0
            if cat_total > 0:
                by_category.append({
                    'category': cat.name,
                    'total': str(cat_total),
                })

        # By branch
        by_branch = []
        branches  = Branch.objects.filter(
            business=business,
            is_deleted=False
        )
        for branch in branches:
            branch_total = queryset.filter(
                branch=branch
            ).aggregate(total=Sum('amount'))['total'] or 0
            by_branch.append({
                'branch': branch.name,
                'total': str(branch_total),
            })

        # Sales total for profit calculation
        from core.models import Sale
        sales_query = Sale.objects.filter(
            business=business,
            is_deleted=False
        )
        if branch_id:
            sales_query = sales_query.filter(branch_id=branch_id)
        if date_from:
            sales_query = sales_query.filter(
                sale_date__gte=parse_date(date_from)
            )
        if date_to:
            sales_query = sales_query.filter(
                sale_date__lte=parse_date(date_to)
            )

        total_sales = sales_query.aggregate(
            total=Sum('amount_paid')
        )['total'] or 0

        net_profit = float(total_sales) - float(total_expenses)

        return Response({
            'total_expenses':  str(total_expenses),
            'total_sales':     str(total_sales),
            'net_profit':      str(net_profit),
            'by_category':     by_category,
            'by_branch':       by_branch,
        })