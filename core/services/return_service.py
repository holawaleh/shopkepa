"""
Returns: goods brought back from an earlier sale.

The sale itself is adjusted (total, VAT, balance, amount paid) so every
existing report, debtor list and customer balance stays correct, and a
SaleReturn records what came back, when, and how the money was settled.
Money is settled against what the customer still owes first; only the
rest is refunded, recorded as a negative payment so the day's cash and
transfer totals match the till.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from core.models import (
    BranchInventory, Customer, InstallmentPlan, Payment, Sale, SaleItem,
    SaleReturn, SaleReturnItem, StockAdjustment,
)
from core.services.sale_service import CENT, money, vat_included_in
from core.utils import log_audit, save_with_unique_number, update_customer_loyalty

logger = logging.getLogger(__name__)


def generate_return_number(business_id):
    prefix = f"RT-{timezone.now().year}-"
    last = (SaleReturn.objects.filter(business_id=business_id, return_number__startswith=prefix)
            .order_by('-return_number').values_list('return_number', flat=True).first())
    next_number = int(last.split('-')[-1]) + 1 if last else 1
    return f"{prefix}{next_number:05d}"


def _unit_value(sale, item):
    """What one unit actually cost the customer: its line price, less its
    share of any whole-sale discount."""
    unit = money(item.line_total) / item.quantity
    if sale.discount_amount and sale.subtotal:
        unit = unit * (money(sale.subtotal) - money(sale.discount_amount)) / money(sale.subtotal)
    return unit


@transaction.atomic
def process_return(sale, items, refund_method=None, reason='', created_by=None):
    """
    items: [{'sale_item_id', 'quantity', 'restock' (default True)}]
    restock=False is for damaged goods that can't be sold again.
    """
    sale = Sale.objects.select_for_update().get(pk=sale.pk)
    if sale.is_deleted:
        raise ValueError('This sale was voided.')
    if not items:
        raise ValueError('Choose at least one item to return.')

    sale_items = {
        str(si.id): si
        for si in SaleItem.objects.select_for_update().filter(sale=sale)
    }

    lines = []
    for entry in items:
        sale_item = sale_items.get(str(entry['sale_item_id']))
        if not sale_item:
            raise ValueError('That item is not part of this sale.')
        qty = int(entry['quantity'])
        if qty <= 0:
            continue
        remaining = sale_item.quantity - sale_item.returned_quantity
        if qty > remaining:
            raise ValueError(
                f'Only {remaining} of {sale_item.product_name} can still be returned.'
            )
        lines.append((sale_item, qty, entry.get('restock', True)))

    if not lines:
        raise ValueError('Enter a quantity for at least one item.')

    # Value of what's coming back
    for sale_item, qty, _ in lines:
        sale_item.returned_quantity += qty
    everything_back = all(si.returned_quantity >= si.quantity for si in sale_items.values())
    line_values = [(_unit_value(sale, si) * qty).quantize(CENT) for si, qty, _ in lines]
    value = sum(line_values, Decimal('0'))
    if everything_back or value > sale.total_amount:
        value = money(sale.total_amount)   # absorbs rounding on a full return

    debt_reduction = min(value, money(sale.balance_due))
    refund_amount  = min(value - debt_reduction, money(sale.amount_paid))
    if refund_amount > 0 and not refund_method:
        raise ValueError('Choose how the refund was paid (cash, transfer or POS).')
    tax_amount = min(vat_included_in(value, money(sale.tax_rate)), money(sale.tax_amount))
    if everything_back:
        tax_amount = money(sale.tax_amount)

    sale_return = save_with_unique_number(
        SaleReturn(
            business=sale.business, branch=sale.branch, sale=sale, customer=sale.customer,
            reason=(reason or '').strip(), value=value, debt_reduction=debt_reduction,
            refund_amount=refund_amount, refund_method=refund_method if refund_amount > 0 else None,
            tax_amount=tax_amount, created_by=created_by,
        ),
        'return_number',
        lambda: generate_return_number(sale.business_id),
    )

    for (sale_item, qty, restock), line_value in zip(lines, line_values):
        sale_item.save(update_fields=['returned_quantity'])
        SaleReturnItem.objects.create(
            sale_return=sale_return, sale_item=sale_item, product_id=sale_item.product_id,
            product_name=sale_item.product_name, quantity=qty,
            unit_value=(line_value / qty).quantize(CENT), line_value=line_value,
            restocked=bool(restock and sale_item.product_id),
        )
        if restock and sale_item.product_id:
            inventory, _ = BranchInventory.objects.select_for_update().get_or_create(
                business=sale.business, branch=sale.branch, product_id=sale_item.product_id,
                defaults={'quantity_in_stock': 0},
            )
            before = inventory.quantity_in_stock
            inventory.quantity_in_stock = before + qty
            inventory.save(update_fields=['quantity_in_stock'])
            StockAdjustment.objects.create(
                business=sale.business, branch=sale.branch, product_id=sale_item.product_id,
                adjustment_type=StockAdjustment.TYPE_RETURN, quantity_change=qty,
                quantity_before=before, quantity_after=before + qty,
                reason=f'Return {sale_return.return_number} (sale {sale.sale_number})',
                reference_id=sale_return.id, created_by=created_by,
            )

    # The sale now reflects only what the customer kept
    sale.total_amount    = money(sale.total_amount) - value
    sale.returned_amount = money(sale.returned_amount) + value
    sale.tax_amount      = money(sale.tax_amount) - tax_amount
    sale.balance_due     = money(sale.balance_due) - debt_reduction
    sale.amount_paid     = money(sale.amount_paid) - refund_amount
    if sale.balance_due <= 0:
        sale.balance_due = Decimal('0')
        sale.payment_status = Sale.STATUS_PAID
    elif sale.amount_paid > 0:
        sale.payment_status = Sale.STATUS_PARTIAL
    else:
        sale.payment_status = Sale.STATUS_UNPAID
    sale.save()

    if refund_amount > 0:
        Payment.objects.create(
            sale=sale, business=sale.business, branch=sale.branch, customer=sale.customer,
            payment_method=refund_method, amount=-refund_amount,
            notes=f'Refund for return {sale_return.return_number}', created_by=created_by,
        )

    try:
        plan = sale.installment_plan
    except InstallmentPlan.DoesNotExist:
        plan = None
    if plan:
        plan.total_amount    = money(plan.total_amount) - value
        plan.current_balance = max(money(plan.current_balance) - debt_reduction, Decimal('0'))
        if plan.current_balance <= 0:
            plan.status = InstallmentPlan.STATUS_COMPLETED
        plan.save()

    if sale.customer_id:
        customer = Customer.objects.select_for_update().get(pk=sale.customer_id)
        customer.total_outstanding_debt = max(money(customer.total_outstanding_debt) - debt_reduction, Decimal('0'))
        customer.lifetime_spend = max(money(customer.lifetime_spend) - refund_amount, Decimal('0'))
        customer.save(update_fields=['total_outstanding_debt', 'lifetime_spend', 'updated_at'])
        update_customer_loyalty(customer)

    try:
        log_audit(
            business_id=sale.business_id,
            user_id=created_by.id if created_by else None,
            action='CREATE',
            table_name='sale_returns',
            record_id=sale_return.id,
            new_values={
                'return_number': sale_return.return_number,
                'sale_number': sale.sale_number,
                'value': str(value),
                'refund_amount': str(refund_amount),
            },
        )
    except Exception:
        logger.exception('Return %s saved but audit logging failed', sale_return.id)

    return sale_return
