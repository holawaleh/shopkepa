from datetime import timedelta
from decimal import Decimal

from django.test import TestCase
from django.utils import timezone

from core.models import BranchInventory, IdempotencyRecord, JobCard, Sale

from .factories import activate_module, client_for, make_business, make_product, make_room


class SaleIdempotencyTests(TestCase):
    def setUp(self):
        self.owner, self.business, self.branch = make_business()
        self.module = activate_module(self.business)
        self.product = make_product(self.business, self.branch, self.module, stock=10)
        self.client = client_for(self.owner)

    def sale_payload(self, qty=2):
        return {
            'branch_id': str(self.branch.id),
            'module_id': str(self.module.id),
            'items': [{
                'product_id': str(self.product.id), 'quantity': qty,
                'price_type': 'retail', 'unit_price': '1000.00',
            }],
            'payment_method': 'cash',
            'amount_paid': str(qty * 1000),
        }

    def post_sale(self, key=None, qty=2):
        headers = {'HTTP_IDEMPOTENCY_KEY': key} if key else {}
        return self.client.post('/api/v1/sales/', self.sale_payload(qty), format='json', **headers)

    def stock(self):
        return BranchInventory.objects.get(product=self.product, branch=self.branch).quantity_in_stock

    def test_same_key_records_the_sale_once_and_replays_the_response(self):
        first = self.post_sale(key='checkout-1')
        second = self.post_sale(key='checkout-1')

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second['Idempotent-Replayed'], 'true')
        self.assertEqual(second.data['sale_number'], first.data['sale_number'])
        self.assertEqual(Sale.objects.filter(business=self.business).count(), 1)
        self.assertEqual(self.stock(), 8)  # deducted once, not twice

    def test_different_keys_are_different_sales(self):
        self.post_sale(key='a')
        self.post_sale(key='b')
        self.assertEqual(Sale.objects.filter(business=self.business).count(), 2)
        self.assertEqual(self.stock(), 6)

    def test_requests_without_a_key_behave_as_before(self):
        self.post_sale()
        self.post_sale()
        self.assertEqual(Sale.objects.filter(business=self.business).count(), 2)

    def test_a_failed_attempt_frees_the_key_for_a_corrected_retry(self):
        too_many = self.post_sale(key='retry-me', qty=50)
        self.assertEqual(too_many.status_code, 400)
        self.assertFalse(IdempotencyRecord.objects.filter(key='retry-me').exists())

        fixed = self.post_sale(key='retry-me', qty=1)
        self.assertEqual(fixed.status_code, 201)
        self.assertEqual(self.stock(), 9)

    def test_in_flight_duplicate_gets_409_instead_of_running_twice(self):
        IdempotencyRecord.objects.create(
            business=self.business, key='busy', method='POST', path='/api/v1/sales/',
        )
        response = self.post_sale(key='busy')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(Sale.objects.filter(business=self.business).count(), 0)

    def test_abandoned_in_flight_key_is_taken_over_after_timeout(self):
        record = IdempotencyRecord.objects.create(
            business=self.business, key='crashed', method='POST', path='/api/v1/sales/',
        )
        IdempotencyRecord.objects.filter(pk=record.pk).update(
            created_at=timezone.now() - timedelta(minutes=5),
        )
        response = self.post_sale(key='crashed')
        self.assertEqual(response.status_code, 201)

    def test_reusing_a_key_on_a_different_endpoint_is_rejected(self):
        self.post_sale(key='shared')
        response = self.client.post(
            '/api/v1/job-cards/',
            {'branch_id': str(self.branch.id), 'customer_name': 'X',
             'device_description': 'Phone', 'customer_complaint': 'Cracked'},
            format='json', HTTP_IDEMPOTENCY_KEY='shared',
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(JobCard.objects.filter(business=self.business).count(), 0)

    def test_keys_are_scoped_per_business(self):
        other_owner, other_business, other_branch = make_business('Other')
        other_module = activate_module(other_business)
        other_product = make_product(other_business, other_branch, other_module)
        self.post_sale(key='same-key')

        other = client_for(other_owner).post('/api/v1/sales/', {
            'branch_id': str(other_branch.id), 'module_id': str(other_module.id),
            'items': [{'product_id': str(other_product.id), 'quantity': 1,
                       'price_type': 'retail', 'unit_price': '1000.00'}],
            'payment_method': 'cash', 'amount_paid': '1000',
        }, format='json', HTTP_IDEMPOTENCY_KEY='same-key')
        self.assertEqual(other.status_code, 201)
        self.assertNotIn('Idempotent-Replayed', other)

    def test_oversized_key_is_rejected(self):
        response = self.post_sale(key='x' * 101)
        self.assertEqual(response.status_code, 400)


class PaymentIdempotencyTests(TestCase):
    def setUp(self):
        self.owner, self.business, self.branch = make_business()
        self.client = client_for(self.owner)

    def test_job_card_payment_retry_is_applied_once(self):
        created = self.client.post('/api/v1/job-cards/', {
            'branch_id': str(self.branch.id), 'customer_name': 'Ada',
            'device_description': 'Laptop', 'customer_complaint': 'No power',
            'labour_charge': '5000.00',
        }, format='json')
        self.assertEqual(created.status_code, 201)
        job_id = created.data['id']

        for _ in range(3):
            response = self.client.post(
                f'/api/v1/job-cards/{job_id}/add-payment/',
                {'amount': '2000.00', 'payment_method': 'cash'},
                format='json', HTTP_IDEMPOTENCY_KEY='pay-1',
            )
            self.assertEqual(response.status_code, 200)

        job = JobCard.objects.get(pk=job_id)
        self.assertEqual(job.amount_paid, Decimal('2000.00'))
        self.assertEqual(job.balance_due, Decimal('3000.00'))

    def test_booking_payment_retry_is_applied_once(self):
        room = make_room(self.business)
        today = timezone.localdate()
        booking = self.client.post('/api/v1/hotel/bookings/', {
            'room_id': str(room.id), 'guest_name': 'Bola',
            'check_in_date': str(today + timedelta(days=1)),
            'check_out_date': str(today + timedelta(days=3)),
        }, format='json')
        self.assertEqual(booking.status_code, 201, booking.data)

        for _ in range(2):
            self.client.post(
                f"/api/v1/hotel/bookings/{booking.data['id']}/payment/",
                {'amount': '10000.00', 'payment_method': 'transfer'},
                format='json', HTTP_IDEMPOTENCY_KEY='room-pay',
            )

        from core.models import Booking
        b = Booking.objects.get(pk=booking.data['id'])
        self.assertEqual(b.amount_paid, Decimal('10000.00'))
