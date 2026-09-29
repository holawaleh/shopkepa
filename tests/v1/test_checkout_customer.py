from decimal import Decimal

from django.test import TestCase

from core.models import Customer, Sale

from .factories import activate_module, client_for, make_business, make_product


class CheckoutTypedCustomerTests(TestCase):
    """A name typed in the POS customer box but never picked from the list
    used to be dropped, recording every such sale as walk-in."""

    def setUp(self):
        self.owner, self.business, self.branch = make_business()
        self.module = activate_module(self.business)
        self.product = make_product(self.business, self.branch, self.module, stock=5)
        self.client = client_for(self.owner)

    def sell(self, qty=1, paid=None, **customer):
        return self.client.post('/api/v1/sales/', {
            'branch_id': str(self.branch.id), 'module_id': str(self.module.id),
            'items': [{'product_id': str(self.product.id), 'quantity': qty,
                       'price_type': 'retail', 'unit_price': '1000.00'}],
            'payment_method': 'cash',
            'amount_paid': str(qty * 1000 if paid is None else paid),
            **customer,
        }, format='json')

    def customers(self):
        return Customer.objects.filter(business=self.business)

    def test_typed_name_creates_the_customer_and_attaches_the_sale(self):
        response = self.sell(new_customer_name='  Ramat   Folashade ', new_customer_phone='0901')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['customer_name'], 'Ramat Folashade')
        customer = self.customers().get()
        self.assertEqual(customer.phone_number, '0901')
        self.assertEqual(Sale.objects.get().customer, customer)

    def test_same_phone_reuses_the_existing_customer(self):
        existing = Customer.objects.create(business=self.business, full_name='Ahmed', phone_number='0801')
        self.sell(new_customer_name='Ahmed A.', new_customer_phone='0801')
        self.assertEqual(self.customers().count(), 1)
        self.assertEqual(Sale.objects.get().customer, existing)

    def test_unique_exact_name_reuses_the_existing_customer(self):
        existing = Customer.objects.create(business=self.business, full_name='Mariam Kilani')
        self.sell(new_customer_name='mariam kilani')
        self.assertEqual(Sale.objects.get().customer, existing)

    def test_ambiguous_name_creates_a_new_customer_rather_than_guessing(self):
        Customer.objects.create(business=self.business, full_name='Tunde')
        Customer.objects.create(business=self.business, full_name='Tunde')
        self.sell(new_customer_name='Tunde')
        self.assertEqual(self.customers().count(), 3)

    def test_failed_sale_does_not_leave_a_stray_customer(self):
        response = self.sell(qty=99, new_customer_name='Ghost')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(self.customers().exists())

    def test_explicit_customer_id_wins_over_a_typed_name(self):
        chosen = Customer.objects.create(business=self.business, full_name='Chosen')
        self.sell(customer_id=str(chosen.id), new_customer_name='Someone Else')
        self.assertEqual(Sale.objects.get().customer, chosen)
        self.assertEqual(self.customers().count(), 1)

    def test_credit_sale_is_allowed_with_a_typed_customer(self):
        response = self.sell(qty=2, paid=500, new_customer_name='Bola')
        self.assertEqual(response.status_code, 201, response.data)
        sale = Sale.objects.get()
        self.assertEqual(sale.balance_due, Decimal('1500.00'))
        self.assertEqual(sale.customer.total_outstanding_debt, Decimal('1500.00'))

    def test_no_name_is_still_a_walk_in(self):
        self.sell()
        self.assertIsNone(Sale.objects.get().customer)
        self.assertFalse(self.customers().exists())
