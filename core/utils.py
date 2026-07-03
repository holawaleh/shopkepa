from django.utils import timezone


def generate_sale_number(business_id):
    from core.models import Sale
    year = timezone.now().year
    prefix = f"SK-{year}-"
    last_sale = (
        Sale.objects
        .filter(sale_number__startswith=prefix)
        .order_by('-sale_number')
        .first()
    )
    if last_sale:
        last_number = int(last_sale.sale_number.split('-')[-1])
        new_number = last_number + 1
    else:
        new_number = 1
    return f"{prefix}{str(new_number).zfill(5)}"


def generate_booking_number(business_id):
    from core.models import Booking
    from django.utils import timezone
    year = timezone.now().year
    prefix = f"BK-{year}-"
    last = (
        Booking.objects
        .filter(business_id=business_id, booking_number__startswith=prefix)
        .order_by('-booking_number')
        .first()
    )
    new_number = (int(last.booking_number.split('-')[-1]) + 1) if last else 1
    return f"{prefix}{str(new_number).zfill(5)}"


def generate_job_number(business_id):
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
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def update_customer_loyalty(customer):
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