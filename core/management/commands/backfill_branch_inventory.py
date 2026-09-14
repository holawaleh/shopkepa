from django.core.management.base import BaseCommand
from django.db import transaction

from core.models import Business, Product, BranchInventory


class Command(BaseCommand):
    help = (
        'Creates missing BranchInventory rows (quantity_in_stock=0) for every '
        'product/branch combination. Fixes products that read as "out of stock" '
        'in POS at a branch (usually one created after the product already '
        'existed) even though they have stock at another branch.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--business', dest='business_id', default=None,
            help='Limit the backfill to a single business ID (default: all businesses).',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Report how many rows would be created without writing anything.',
        )

    def handle(self, *args, **options):
        businesses = Business.objects.all()
        if options['business_id']:
            businesses = businesses.filter(id=options['business_id'])

        total_created = 0
        for business in businesses:
            existing = set(
                BranchInventory.objects.filter(business=business)
                .values_list('branch_id', 'product_id')
            )
            branch_ids = list(
                business.branches.filter(is_deleted=False).values_list('id', flat=True)
            )
            product_ids = list(
                Product.objects.filter(business=business, is_deleted=False).values_list('id', flat=True)
            )

            missing = [
                BranchInventory(business=business, branch_id=branch_id, product_id=product_id, quantity_in_stock=0)
                for branch_id in branch_ids
                for product_id in product_ids
                if (branch_id, product_id) not in existing
            ]

            if missing:
                self.stdout.write(f'{business.name}: {len(missing)} missing inventory row(s)')
                if not options['dry_run']:
                    with transaction.atomic():
                        BranchInventory.objects.bulk_create(missing)
                total_created += len(missing)

        if options['dry_run']:
            self.stdout.write(self.style.WARNING(f'Dry run - {total_created} row(s) would be created.'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Done - {total_created} row(s) created.'))
