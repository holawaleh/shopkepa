from django.utils import timezone


def generate_sale_number(business_id):
    """
    Generates a unique sale number e.g. SK-2026-00001
    """
    from core.models import Sale
    year = timezone.now().year
    prefix = f"SK-{year}-"
    last_sale = (
        Sale.objects
        .filter(business_id=business_id, sale_number__startswith=prefix)
        .order_by('-sale_number')
        .first()
    )
    if last_sale:
        last_number = int(last_sale.sale_number.split('-')[-1])
        new_number = last_number + 1
    else:
        new_number = 1
    return f"{prefix}{str(new_number).zfill(5)}"


def generate_job_number(business_id):
    """
    Generates a unique job card number e.g. JC-2026-00001
    """
    from core.models import JobCard
    year = timezone.now().year
    prefix = f"JC-{year}-"
    last_job = (
        JobCard.objects
        .filter(business_id=business_id, job_number__startswith=prefix)
        .order_by('-job_number')
        .first()
    )
    if last_job:
        last_number = int(last_job.job_number.split('-')[-1])
        new_number = last_number + 1
    else:
        new_number = 1
    return f"{prefix}{str(new_number).zfill(5)}"


def get_client_ip(request):
    """
    Extracts the real client IP address from a request.
    Handles proxies and load balancers.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def update_customer_loyalty(customer):
    """
    Recalculates and updates a customer's loyalty tag
    based on their lifetime spend and the business thresholds.
    """
    try:
        settings = customer.business.settings
        spend = customer.lifetime_spend
        if spend >= settings.loyalty_gold_threshold:
            customer.loyalty_tag = 'gold'
        elif spend >= settings.loyalty_silver_threshold:
            customer.loyalty_tag = 'silver'
        elif spend >= settings.loyalty_bronze_threshold:
            customer.loyalty_tag = 'bronze'
        else:
            customer.loyalty_tag = 'none'
        customer.save(update_fields=['loyalty_tag', 'updated_at'])
    except Exception:
        pass


def log_audit(business_id, user_id, action, table_name, record_id,
              old_values=None, new_values=None, ip_address=None):
    """
    Creates an audit log entry. Call this after every write operation.
    """
    from core.models import AuditLog
    AuditLog.objects.create(
        business_id=business_id,
        user_id=user_id,
        action=action,
        table_name=table_name,
        record_id=record_id,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
    )