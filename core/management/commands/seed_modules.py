from django.core.management.base import BaseCommand
from core.models import Module


MODULES = [
    {
        'code': 'general_trade',
        'name': 'General Trade / Provision Store',
        'description': 'For provision stores, supermarkets, and general merchandise shops. Supports unit types like carton, dozen, and piece with reorder alerts.',
        'sort_order': 1,
    },
    {
        'code': 'fashion',
        'name': 'Fashion & Clothing',
        'description': 'For boutiques and clothing stores. Supports size, colour, and gender variants per product.',
        'sort_order': 2,
    },
    {
        'code': 'electronics',
        'name': 'Electronics & Gadgets',
        'description': 'For electronics shops. Supports brand, specifications, IMEI/serial number, condition, and warranty tracking.',
        'sort_order': 3,
    },
    {
        'code': 'food',
        'name': 'Food & Groceries',
        'description': 'For supermarkets and food vendors. Supports expiry dates, perishable flags, and weight-based pricing.',
        'sort_order': 4,
    },
    {
        'code': 'pharmacy',
        'name': 'Pharmacy / Chemist',
        'description': 'For pharmacies and chemists. Supports expiry dates, NAFDAC numbers, and prescription flags.',
        'sort_order': 5,
    },
    {
        'code': 'building_materials',
        'name': 'Building Materials',
        'description': 'For building material dealers. Supports unit types like bag, tonne, and length with bulk pricing tiers.',
        'sort_order': 6,
    },
    {
        'code': 'stationery',
        'name': 'Stationery / School Supplies',
        'description': 'For stationery shops. Supports grade level tagging for school resumption season planning.',
        'sort_order': 7,
    },
    {
        'code': 'technical_services',
        'name': 'Technical Services',
        'description': 'For repair shops and technicians. Supports job cards, repair status tracking, parts logging, and labour charges.',
        'sort_order': 8,
    },
    {
        'code': 'hotel',
        'name': 'Hotel & Tourism',
        'description': 'For hotels, guesthouses, and lodges. Supports room bookings, reservations, check-in/check-out, and occupancy tracking.',
        'sort_order': 9,
    },
]


class Command(BaseCommand):
    help = 'Seeds the modules table with all ShopKepa business modules.'

    def handle(self, *args, **kwargs):
        created_count = 0
        updated_count = 0

        for module_data in MODULES:
            module, created = Module.objects.update_or_create(
                code=module_data['code'],
                defaults={
                    'name':        module_data['name'],
                    'description': module_data['description'],
                    'sort_order':  module_data['sort_order'],
                    'is_active':   True,
                }
            )
            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'  ✔ Created: {module.name}')
                )
            else:
                updated_count += 1
                self.stdout.write(
                    self.style.WARNING(f'  ↻ Updated: {module.name}')
                )

        self.stdout.write('')
        self.stdout.write(
            self.style.SUCCESS(
                f'Done. {created_count} created, {updated_count} updated.'
            )
        )