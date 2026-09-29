from datetime import timedelta

from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from core.models import Booking, JobCard
from core.utils import generate_job_number, save_with_unique_number

from .factories import client_for, make_business, make_room


class SaveWithUniqueNumberTests(TestCase):
    def setUp(self):
        self.owner, self.business, self.branch = make_business()

    def job(self, **extra):
        return JobCard(
            business=self.business, branch=self.branch, customer_name='C',
            device_description='D', customer_complaint='X', **extra,
        )

    def test_retries_with_a_fresh_number_when_the_first_collides(self):
        # Simulates a concurrent request that grabbed JC-...-00001 first.
        taken = save_with_unique_number(self.job(), 'job_number', lambda: 'JC-2026-00001')
        numbers = iter(['JC-2026-00001', 'JC-2026-00002'])

        saved = save_with_unique_number(self.job(), 'job_number', lambda: next(numbers))

        self.assertEqual(taken.job_number, 'JC-2026-00001')
        self.assertEqual(saved.job_number, 'JC-2026-00002')
        self.assertEqual(JobCard.objects.filter(business=self.business).count(), 2)

    def test_gives_up_after_the_attempt_limit(self):
        save_with_unique_number(self.job(), 'job_number', lambda: 'JC-2026-00001')
        with self.assertRaises(IntegrityError):
            save_with_unique_number(self.job(), 'job_number', lambda: 'JC-2026-00001', attempts=3)

    def test_other_integrity_errors_are_not_swallowed(self):
        bad = self.job()
        bad.branch_id = None  # NOT NULL violation, unrelated to numbering
        calls = []
        with self.assertRaises(IntegrityError):
            save_with_unique_number(bad, 'job_number', lambda: calls.append(1) or 'JC-2026-00009')
        self.assertEqual(len(calls), 1)  # no retry loop for unrelated errors

    def test_numbers_are_per_business(self):
        other_owner, other_business, other_branch = make_business('Other')
        mine = save_with_unique_number(self.job(), 'job_number', lambda: generate_job_number(self.business.id))
        theirs = save_with_unique_number(
            JobCard(business=other_business, branch=other_branch, customer_name='C',
                    device_description='D', customer_complaint='X'),
            'job_number', lambda: generate_job_number(other_business.id),
        )
        self.assertEqual(mine.job_number, theirs.job_number)  # both ...-00001, no clash


class BookingTests(TestCase):
    def setUp(self):
        self.owner, self.business, self.branch = make_business()
        self.client = client_for(self.owner)
        self.room = make_room(self.business)
        self.today = timezone.localdate()

    def book(self, start, end):
        return self.client.post('/api/v1/hotel/bookings/', {
            'room_id': str(self.room.id), 'guest_name': 'G',
            'check_in_date': str(self.today + timedelta(days=start)),
            'check_out_date': str(self.today + timedelta(days=end)),
        }, format='json')

    def test_bookings_get_sequential_numbers(self):
        first, second = self.book(1, 2), self.book(3, 4)
        self.assertEqual(first.status_code, 201, first.data)
        self.assertNotEqual(first.data['booking_number'], second.data['booking_number'])

    def test_overlapping_booking_for_same_room_is_refused(self):
        self.assertEqual(self.book(1, 4).status_code, 201)
        clash = self.book(2, 3)
        self.assertEqual(clash.status_code, 400)
        self.assertEqual(Booking.objects.filter(room=self.room).count(), 1)
