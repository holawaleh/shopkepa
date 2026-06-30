from django.core.management.base import BaseCommand
from core.models import Business, ServiceType

DEFAULT_SERVICES = [
    # Smartphone
    ('Smartphone', 'Screen Replacement',        15000, 'LCD/AMOLED screen replacement including digitizer'),
    ('Smartphone', 'Battery Replacement',        5000, 'OEM or compatible battery swap'),
    ('Smartphone', 'Charging Port Repair',       5000, 'USB-C / micro-USB port repair or replacement'),
    ('Smartphone', 'Speaker / Earpiece Repair',  4000, 'Speaker or earpiece module replacement'),
    ('Smartphone', 'Software Flash / Unlock',    5000, 'Firmware flash, unlock, or factory reset'),
    ('Smartphone', 'Water Damage Treatment',    10000, 'Board cleaning and component drying'),
    ('Smartphone', 'Camera Repair',              8000, 'Front or rear camera module replacement'),
    # Laptop
    ('Laptop', 'Screen Replacement',            35000, 'LCD screen panel replacement'),
    ('Laptop', 'Keyboard Replacement',          20000, 'Full keyboard deck replacement'),
    ('Laptop', 'Fan Cleaning & Servicing',       8000, 'Thermal paste + fan cleaning'),
    ('Laptop', 'OS Installation',               10000, 'Windows / Linux installation with drivers'),
    ('Laptop', 'Battery Replacement',           25000, 'Laptop battery replacement'),
    ('Laptop', 'Motherboard Repair',            50000, 'Board-level repair for common faults'),
    # TV
    ('TV', 'Power Supply Repair',               15000, 'PSU board repair or component replacement'),
    ('TV', 'Screen / Panel Repair',             40000, 'LED/LCD panel replacement'),
    ('TV', 'Software / Firmware Update',         5000, 'Smart TV firmware flashing'),
    # Air Conditioner
    ('Air Conditioner', 'Gas Refill (R22/R410)', 20000, 'Refrigerant top-up'),
    ('Air Conditioner', 'Full Service',          10000, 'Wash, clean filters, check gas level'),
    ('Air Conditioner', 'PCB / Board Repair',    30000, 'Control board component-level repair'),
    # Refrigerator
    ('Refrigerator', 'Gas Refill',              15000, 'Refrigerant recharge'),
    ('Refrigerator', 'Compressor Replacement',  45000, 'Compressor swap with warranty'),
    ('Refrigerator', 'Thermostat Repair',        8000, 'Thermostat or start relay replacement'),
    # Generator
    ('Generator', 'Full Service / Maintenance', 15000, 'Oil change, plug, air filter, carb clean'),
    ('Generator', 'Carburetor Cleaning',         8000, 'Carb disassembly and ultrasonic clean'),
    ('Generator', 'AVR Replacement',            20000, 'Automatic Voltage Regulator swap'),
    # General
    ('General', 'Diagnostics / Assessment',      2000, 'Fault finding and written report'),
    ('General', 'Custom / Other Repair',         5000, 'Bespoke repair not listed above'),
]


class Command(BaseCommand):
    help = 'Seed default service types for all businesses that have no service types yet.'

    def add_arguments(self, parser):
        parser.add_argument('--all', action='store_true',
                            help='Seed even if the business already has service types (adds missing ones only)')

    def handle(self, *args, **options):
        businesses = Business.objects.all()
        if not businesses.exists():
            self.stdout.write(self.style.WARNING('No businesses found. Register a business first.'))
            return

        seeded = 0
        for biz in businesses:
            existing_names = set(
                ServiceType.objects.filter(business=biz).values_list('name', 'category')
            )
            to_create = []
            for cat, name, price, desc in DEFAULT_SERVICES:
                if (name, cat) not in existing_names:
                    to_create.append(ServiceType(
                        business=biz,
                        category=cat,
                        name=name,
                        base_price=price,
                        description=desc,
                    ))
            if to_create:
                ServiceType.objects.bulk_create(to_create)
                seeded += len(to_create)
                self.stdout.write(f'  + {biz.name}: {len(to_create)} service types added')
            else:
                self.stdout.write(f'  = {biz.name}: already has all default services')

        self.stdout.write(self.style.SUCCESS(f'\nDone. {seeded} service types seeded.'))
