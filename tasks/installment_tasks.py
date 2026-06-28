from celery import shared_task
from django.utils import timezone


@shared_task
def mark_overdue_installments():
    """
    Run daily via Celery beat.
    Marks any active installment plan whose due_date has passed as overdue.
    """
    from core.models import InstallmentPlan

    today = timezone.now().date()
    updated = InstallmentPlan.objects.filter(
        status=InstallmentPlan.STATUS_ACTIVE,
        due_date__lt=today,
        current_balance__gt=0,
    ).update(status=InstallmentPlan.STATUS_OVERDUE)

    return f"Marked {updated} installment plan(s) as overdue."
