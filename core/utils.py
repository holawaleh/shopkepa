from django.db import IntegrityError, transaction
from django.utils import timezone


def save_with_unique_number(instance, number_field, generate, attempts=5):
    """
    Save a new model instance whose `number_field` comes from a
    "last number + 1" generator (sale, job card, booking numbers).

    Two concurrent requests for the same business can read the same "last
    number" and pick the same next one; the per-business unique constraint
    then rejects the second insert. Rather than surfacing that as a 500,
    retry with a freshly generated number - by then the winner's row is
    committed and visible, so the next attempt picks the number after it.
    """
    for attempt in range(attempts):
        setattr(instance, number_field, generate())
        try:
            with transaction.atomic():  # savepoint: a failed insert can't poison the outer transaction
                instance.save(force_insert=True)
            return instance
        except IntegrityError as exc:
            if number_field not in str(exc) or attempt == attempts - 1:
                raise


def generate_sale_number(business_id):
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