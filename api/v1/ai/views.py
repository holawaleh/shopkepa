from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from core.models import AIUsageLog, Business


# ── Placeholder responses for common questions ─────────────────────
# When real AI is activated, these are replaced by actual LLM responses.
# The query logging below already captures what owners ask most.

COMING_SOON_MESSAGE = (
    "ShopKepa AI Assistant is coming soon. "
    "It will be available to Basic and Pro subscribers "
    "and will answer questions about your sales, inventory, "
    "customers, debts, and profits in plain English."
)

AI_PREVIEW_RESPONSES = {
    "sales":     "Sales intelligence — coming soon. You will be able to ask about daily revenue, top products, and payment trends.",
    "debt":      "Debt analysis — coming soon. You will be able to ask who owes you, how much, and for how long.",
    "inventory": "Inventory intelligence — coming soon. You will be able to ask about low stock, fast-moving items, and reorder suggestions.",
    "customer":  "Customer insights — coming soon. You will be able to ask about top spenders, dormant customers, and loyalty standings.",
    "profit":    "Profit analysis — coming soon. You will be able to ask about net profit, expense trends, and revenue comparisons.",
    "staff":     "Staff performance — coming soon. You will be able to ask about sales per staff member and top performers.",
    "report":    "Report generation — coming soon. You will be able to ask for summaries in plain English instead of navigating reports manually.",
}


def get_preview_response(question):
    """
    Returns a preview response based on keywords in the question.
    Used as placeholder until real AI is activated.
    """
    question_lower = question.lower()
    if any(w in question_lower for w in ['debt', 'owe', 'balance', 'installment', 'debtor']):
        return AI_PREVIEW_RESPONSES['debt']
    if any(w in question_lower for w in ['stock', 'inventory', 'reorder', 'product', 'item']):
        return AI_PREVIEW_RESPONSES['inventory']
    if any(w in question_lower for w in ['customer', 'loyal', 'buyer', 'client']):
        return AI_PREVIEW_RESPONSES['customer']
    if any(w in question_lower for w in ['profit', 'expense', 'cost', 'loss', 'revenue']):
        return AI_PREVIEW_RESPONSES['profit']
    if any(w in question_lower for w in ['staff', 'cashier', 'attendant', 'employee']):
        return AI_PREVIEW_RESPONSES['staff']
    if any(w in question_lower for w in ['report', 'summary', 'overview', 'analysis']):
        return AI_PREVIEW_RESPONSES['report']
    if any(w in question_lower for w in ['sale', 'sold', 'revenue', 'transaction', 'today']):
        return AI_PREVIEW_RESPONSES['sales']
    return COMING_SOON_MESSAGE


class AIAskView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        question  = request.data.get('question', '').strip()
        branch_id = request.data.get('branch_id')

        if not question:
            return Response(
                {'error': 'question field is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(question) > 500:
            return Response(
                {'error': 'Question must be under 500 characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        business = request.user.business

        # Log every query — valuable data for when AI launches
        AIUsageLog.objects.create(
            business=business,
            user=request.user,
            query_text=question,
            response_summary='placeholder_response',
            tokens_used=0,
        )

        # Update AI query counter on business
        business.ai_queries_used += 1
        business.save(update_fields=['ai_queries_used'])

        preview_response = get_preview_response(question)

        return Response({
            'question':   question,
            'answer':     preview_response,
            'ai_status':  'coming_soon',
            'message':    (
                'ShopKepa AI is not yet active. '
                'Your question has been logged and will be '
                'answered automatically when AI launches.'
            ),
            'launch_info': {
                'free_tier':   'Basic rule-based AI answers — coming in V1.1',
                'basic_tier':  'Full conversational AI — coming in V2',
                'pro_tier':    'Unlimited AI with advanced insights — coming in V2',
            },
            'alternatives': {
                'sales_report':    '/api/v1/reports/sales/daily/',
                'debtors_report':  '/api/v1/reports/debtors/',
                'expense_report':  '/api/v1/reports/expenses/',
                'inventory_report': '/api/v1/reports/inventory/',
                'customer_report': '/api/v1/reports/customers/',
            },
            'logged_at': str(timezone.now()),
        }, status=status.HTTP_200_OK)


class AIUsageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business

        # Monthly reset check
        from datetime import date
        first_of_month = date.today().replace(day=1)
        monthly_queries = AIUsageLog.objects.filter(
            business=business,
            created_at__date__gte=first_of_month
        ).count()

        return Response({
            'queries_used_total':   business.ai_queries_used,
            'queries_this_month':   monthly_queries,
            'queries_limit':        business.ai_queries_limit,
            'subscription_tier':    business.subscription_tier,
            'ai_status':            'coming_soon',
            'message': (
                'AI Assistant is not yet active. '
                'Your usage is being tracked for when it launches.'
            ),
        })


class AIHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        business = request.user.business

        logs = AIUsageLog.objects.filter(
            business=business
        ).order_by('-created_at')[:20]

        return Response({
            'ai_status': 'coming_soon',
            'total_queries_logged': AIUsageLog.objects.filter(
                business=business
            ).count(),
            'recent_queries': [
                {
                    'question':   log.query_text,
                    'asked_at':   str(log.created_at),
                    'asked_by':   log.user.full_name if log.user else 'Unknown',
                }
                for log in logs
            ],
            'message': (
                'These questions will be answered by ShopKepa AI when it launches. '
                'They help us understand what matters most to your business.'
            ),
        })