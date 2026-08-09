from django.db import transaction, IntegrityError
from django.utils import timezone
from decimal import Decimal
import logging

from core.models import (
    Sale, SaleItem, Payment, InstallmentPlan,
    InstallmentPayment, BranchInventory, StockAdjustment
)
from core.utils import generate_sale_number, update_customer_loyalty, log_audit

logger = logging.getLogger(__name__)

def money(value):
    if value is None or value == '':
        return Decimal('0')
    return Decimal(str(value))


@transaction.atomic
def create_sale(business, branch, module, items, payment_data,
                customer=None, discount_amount=0, notes='', created_by=None):
    """
    Creates a complete sale transaction atomically.
    Handles stock deduction, payment, installment plan creation,
    customer loyalty update, and audit logging.
    """

    # ── 1. Validate stock for all items first ─────────────────────────
    for item in items:
        try:
            inventory = BranchInventory.objects.select_for_update().get(
                business=business,
                branch=branch,
                product_id=item['product_id'],
            )
        except BranchInventory.DoesNotExist:
            raise ValueError(
                f"{item['product_name']} has no stock record for {branch.name}. "
                "Restock it from Products before selling."
            )
        if inventory.quantity_in_stock < item['quantity']:
            raise ValueError(
                f"Insufficient stock for {item['product_name']}. "
                f"Available: {inventory.quantity_in_stock}, "
                f"Requested: {item['quantity']}"
            )

    # ── 2. Calculate totals ───────────────────────────────────────────
    subtotal = sum(
        money(item['unit_price']) * item['quantity']
        - money(item.get('discount_amount', 0))
        for item in items
    )
    total_amount  = subtotal - money(discount_amount)
    amount_paid   = money(payment_data['amount_paid'])
    balance_due   = total_amount - amount_paid

    if amount_paid > total_amount:
        amount_paid = total_amount
        balance_due = Decimal('0')

    # Determine payment status
    if balance_due <= 0:
        payment_status = Sale.STATUS_PAID
    elif amount_paid > 0:
        payment_status = Sale.STATUS_PARTIAL
    else:
        payment_status = Sale.STATUS_UNPAID

    # ── 3. Create Sale ────────────────────────────────────────────────
    sale = None
    for attempt in range(5):
        try:
            with transaction.atomic():
                sale = Sale.objects.create(
                    business=business,
                    branch=branch,
                    module=module,
                    customer=customer,
                    sale_number=generate_sale_number(business.id),
                    subtotal=subtotal,
                    discount_amount=money(discount_amount),
                    total_amount=total_amount,
                    amount_paid=amount_paid,
                    balance_due=balance_due,
                    payment_status=payment_status,
                    has_installment_plan=balance_due > 0 and customer is not None,
                    notes=notes,
                    created_by=created_by,
                )
            break
        except IntegrityError as exc:
            if 'sale_number' not in str(exc) or attempt == 4:
                raise
    if sale is None:
        raise ValueError('Could not generate a unique sale number. Please retry.')

    # ── 4. Create Sale Items + Deduct Stock ───────────────────────────
    for item in items:
        SaleItem.objects.create(
            sale=sale,
            business=business,
            product_id=item['product_id'],
            product_name=item['product_name'],
            quantity=item['quantity'],
            unit_type=item.get('unit_type', ''),
            price_type=item['price_type'],
            unit_price=money(item['unit_price']),
            discount_amount=money(item.get('discount_amount', 0)),
            line_total=(
                money(item['unit_price']) * item['quantity']
                - money(item.get('discount_amount', 0))
            ),
        )

        # Deduct stock
        try:
            inventory = BranchInventory.objects.select_for_update().get(
                business=business,
                branch=branch,
                product_id=item['product_id'],
            )
        except BranchInventory.DoesNotExist:
            raise ValueError(
                f"{item['product_name']} has no stock record for {branch.name}. "
                "Restock it from Products before selling."
            )
        qty_before = inventory.quantity_in_stock
        qty_after  = qty_before - item['quantity']

        inventory.quantity_in_stock = qty_after
        inventory.save()

        StockAdjustment.objects.create(
            business=business,
            branch=branch,
            product_id=item['product_id'],
            adjustment_type=StockAdjustment.TYPE_MANUAL_DECREASE,
            quantity_change=-item['quantity'],
            quantity_before=qty_before,
            quantity_after=qty_after,
            reason=f'Sale {sale.sale_number}',
            reference_id=sale.id,
            created_by=created_by,
        )

    # ── 5. Record Payment ─────────────────────────────────────────────
    payment = None
    if amount_paid > 0:
        payment = Payment.objects.create(
            sale=sale,
            business=business,
            branch=branch,
            customer=customer,
            payment_method=payment_data['payment_method'],
            amount=amount_paid,
            reference_number=payment_data.get('reference_number', ''),
            tranche_number=1,
            created_by=created_by,
        )

    # ── 6. Create Installment Plan if partial payment ─────────────────
    installment_plan = None
    if balance_due > 0 and customer:
        installment_plan = InstallmentPlan.objects.create(
            sale=sale,
            business=business,
            customer=customer,
            total_amount=total_amount,
            initial_deposit=amount_paid,
            balance_at_creation=balance_due,
            current_balance=balance_due,
            max_tranches=5,
            tranches_used=1,
            created_by=created_by,
        )

        if payment:
            InstallmentPayment.objects.create(
                installment_plan=installment_plan,
                payment=payment,
                business=business,
                tranche_number=1,
                amount=amount_paid,
                balance_before=total_amount,
                balance_after=balance_due,
                created_by=created_by,
            )

    # ── 7. Update Customer Stats ──────────────────────────────────────
    if customer:
        customer.lifetime_spend = money(customer.lifetime_spend) + amount_paid
        customer.last_purchase_date   = timezone.now().date()
        customer.total_outstanding_debt = money(customer.total_outstanding_debt) + balance_due
        customer.save(update_fields=[
            'lifetime_spend', 'last_purchase_date',
            'total_outstanding_debt', 'updated_at'
        ])
        update_customer_loyalty(customer)

    # ── 8. Audit Log ──────────────────────────────────────────────────
    try:
        log_audit(
            business_id=business.id,
            user_id=created_by.id if created_by else None,
            action='CREATE',
            table_name='sales',
            record_id=sale.id,
            new_values={
                'sale_number':    sale.sale_number,
                'total_amount':   str(total_amount),
                'payment_status': payment_status,
            },
        )
    except Exception:
        logger.exception('Sale %s was created but audit logging failed', sale.id)

    return {
        'sale':             sale,
        'payment':          payment,
        'installment_plan': installment_plan,
    }


@transaction.atomic
def add_payment_to_sale(sale, payment_data, created_by):
    """
    Records an additional payment against an existing sale.
    Updates installment plan and customer debt.
    """
    if sale.payment_status == Sale.STATUS_PAID:
        raise ValueError('This sale is already fully paid.')

    try:
        plan = sale.installment_plan
    except InstallmentPlan.DoesNotExist:
        plan = None

    if plan and plan.tranches_used >= plan.max_tranches:
        raise ValueError(
            f'Maximum of {plan.max_tranches} payment tranches reached.'
        )

    amount = money(payment_data['amount'])

    if amount > sale.balance_due:
        raise ValueError(
            f'Overpayment not allowed. This sale has only ₦{sale.balance_due} outstanding.'
        )

    tranche_number = (plan.tranches_used + 1) if plan else 2

    payment = Payment.objects.create(
        sale=sale,
        business=sale.business,
        branch=sale.branch,
        customer=sale.customer,
        payment_method=payment_data['payment_method'],
        amount=amount,
        reference_number=payment_data.get('reference_number', ''),
        notes=payment_data.get('notes', ''),
        tranche_number=tranche_number,
        created_by=created_by,
    )

    # Update sale totals
    sale.amount_paid  += amount
    sale.balance_due  -= amount
    if sale.balance_due <= 0:
        sale.balance_due   = Decimal('0')
        sale.payment_status = Sale.STATUS_PAID
    else:
        sale.payment_status = Sale.STATUS_PARTIAL
    sale.save()

    # Update installment plan
    if plan:
        balance_before      = plan.current_balance
        plan.current_balance -= amount
        plan.tranches_used  += 1
        if plan.current_balance <= 0:
            plan.current_balance = Decimal('0')
            plan.status = InstallmentPlan.STATUS_COMPLETED
        plan.save()

        InstallmentPayment.objects.create(
            installment_plan=plan,
            payment=payment,
            business=sale.business,
            tranche_number=tranche_number,
            amount=amount,
            balance_before=balance_before,
            balance_after=plan.current_balance,
            created_by=created_by,
        )

    # Update customer debt
    if sale.customer:
        sale.customer.lifetime_spend = money(sale.customer.lifetime_spend) + amount
        sale.customer.total_outstanding_debt = money(sale.customer.total_outstanding_debt) - amount
        if sale.customer.total_outstanding_debt < 0:
            sale.customer.total_outstanding_debt = Decimal('0')
        sale.customer.save(update_fields=[
            'lifetime_spend', 'total_outstanding_debt', 'updated_at'
        ])
        update_customer_loyalty(sale.customer)

    return {
        'sale':              sale,
        'payment':           payment,
        'remaining_balance': sale.balance_due,
    }


@transaction.atomic
def add_payment_to_customer(customer, payment_data, created_by):
    """Apply one customer repayment to the oldest outstanding sales first."""
    amount = money(payment_data['amount'])
    sales = list(
        Sale.objects.select_for_update()
        .filter(
            customer=customer,
            business=customer.business,
            is_deleted=False,
            balance_due__gt=0,
        )
        .order_by('sale_date', 'created_at')
    )
    total_balance = sum((money(sale.balance_due) for sale in sales), Decimal('0'))

    if not sales:
        raise ValueError('This customer has no outstanding debt.')
    if amount > total_balance:
        raise ValueError(
            f'Overpayment not allowed. This customer has only ₦{total_balance} outstanding.'
        )

    remaining = amount
    allocations = []
    for sale in sales:
        if remaining <= 0:
            break
        allocation = min(remaining, money(sale.balance_due))
        result = add_payment_to_sale(
            sale,
            {**payment_data, 'amount': allocation},
            created_by,
        )
        allocations.append({
            'sale_number': sale.sale_number,
            'amount_paid': str(result['payment'].amount),
            'remaining_balance': str(result['remaining_balance']),
        })
        remaining -= allocation

    return {
        'amount_paid': amount,
        'remaining_customer_debt': total_balance - amount,
        'allocations': allocations,
    }