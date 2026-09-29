from decimal import Decimal

from django.test import TestCase

from core.models import Customer, JobCard

from .factories import activate_module, client_for, make_business, make_product


class CustomerOutstandingRecordTests(TestCase):
    """The customer profile keeps a full, itemised record of what's owed -
    unpaid sales and unpaid job cards - computed from the records themselves."""

    def setUp(self):
        self.owner, self.business, self.branch = make_business()
        self.module = activate_module(self.business)
        self.product = make_product(self.business, self.branch, self.module, stock=10)
        self.customer = Customer.objects.create(business=self.business, full_name='Ada')
        self.client = client_for(self.owner)

    def sell(self, qty, paid):
        res = self.client.post('/api/v1/sales/', {
            'branch_id': str(self.branch.id), 'module_id': str(self.module.id),
            'customer_id': str(self.customer.id),
            'items': [{'product_id': str(self.product.id), 'quantity': qty,
                       'price_type': 'retail', 'unit_price': '1000.00'}],
            'payment_method': 'cash', 'amount_paid': str(paid),
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return res.data

    def job(self, charge, status='received', paid=Decimal('0')):
        return JobCard.objects.create(
            business=self.business, branch=self.branch, job_number=f'JC-T-{charge}-{status}',
            customer=self.customer, customer_name='Ada', device_description='Phone',
            customer_complaint='Screen', labour_charge=charge, total_charge=charge,
            amount_paid=paid, balance_due=Decimal(charge) - paid, status=status,
        )

    def outstanding(self):
        res = self.client.get(f'/api/v1/customers/{self.customer.id}/')
        self.assertEqual(res.status_code, 200)
        return res.data['outstanding']

    def test_lists_unpaid_sales_and_job_cards_with_a_combined_total(self):
        sale = self.sell(qty=3, paid=1000)          # owes 2000
        self.sell(qty=1, paid=1000)                 # fully paid - not listed
        job = self.job(Decimal('5000'))             # owes 5000
        self.job(Decimal('900'), status='cancelled')  # cancelled - not listed

        record = self.outstanding()
        self.assertEqual(Decimal(record['total']), Decimal('7000'))
        self.assertEqual(Decimal(record['sales_total']), Decimal('2000'))
        self.assertEqual(Decimal(record['job_cards_total']), Decimal('5000'))
        self.assertEqual(
            {(i['type'], i['reference']) for i in record['items']},
            {('sale', sale['sale_number']), ('job_card', job.job_number)},
        )

    def test_a_customer_who_owes_nothing_has_an_empty_record(self):
        self.sell(qty=1, paid=1000)
        record = self.outstanding()
        self.assertEqual(Decimal(record['total']), Decimal('0'))
        self.assertEqual(record['items'], [])

    def test_history_endpoint_carries_the_same_record(self):
        self.sell(qty=2, paid=0)
        res = self.client.get(f'/api/v1/customers/{self.customer.id}/history/')
        self.assertEqual(Decimal(res.data['customer']['outstanding']['total']), Decimal('2000'))
