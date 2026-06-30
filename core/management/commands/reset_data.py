from django.core.management.base import BaseCommand
from django.db import transaction, connection


class Command(BaseCommand):
    help = 'Delete ALL business data and users. Keeps Module definitions intact. Irreversible.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompt (required for non-interactive use)',
        )

    def handle(self, *args, **options):
        if not options['yes']:
            self.stdout.write(self.style.WARNING(
                '\nWARNING: This will permanently delete ALL users, businesses, customers, sales,\n'
                '   products, job cards, hotel bookings, and all related data.\n'
                '   Module definitions (general_trade, pharmacy, etc.) will be KEPT.\n'
            ))
            confirm = input('Type "DELETE ALL" to confirm: ').strip()
            if confirm != 'DELETE ALL':
                self.stdout.write(self.style.ERROR('Aborted.'))
                return

        with transaction.atomic():
            from core.models import (
                Business, User,
                AuditLog, AIUsageLog,
            )
            from django.contrib.sessions.models import Session
            from rest_framework_simplejwt.token_blacklist.models import (
                BlacklistedToken, OutstandingToken,
            )

            # Clear JWT tokens first (FK to users)
            bt = BlacklistedToken.objects.all().count()
            BlacklistedToken.objects.all().delete()
            ot = OutstandingToken.objects.all().count()
            OutstandingToken.objects.all().delete()
            self.stdout.write(f'  + Cleared {bt} blacklisted tokens, {ot} outstanding tokens')

            # Clear sessions
            sc = Session.objects.all().count()
            Session.objects.all().delete()
            self.stdout.write(f'  + Cleared {sc} sessions')

            # Audit logs (FK to business/user)
            ac = AuditLog.objects.all().count()
            AuditLog.objects.all().delete()
            self.stdout.write(f'  + Cleared {ac} audit log entries')

            # AI usage logs
            ai = AIUsageLog.objects.all().count()
            AIUsageLog.objects.all().delete()
            self.stdout.write(f'  + Cleared {ai} AI usage records')

            # Deleting Business cascades to:
            # Users (those with a business), Branches, BranchInventory, StockAdjustments,
            # Products, Customers, CustomerNotes, Sales, SaleItems, Payments,
            # InstallmentPlans, InstallmentPayments, ExpenseCategories, Expenses,
            # JobCards, JobCardParts, BusinessModules, Rooms, Bookings
            bc = Business.objects.all().count()
            Business.objects.all().delete()
            self.stdout.write(f'  + Deleted {bc} business(es) and all related data')

            # Any remaining users (superusers without a business)
            uc = User.objects.all().count()
            User.objects.all().delete()
            self.stdout.write(f'  + Deleted {uc} remaining user(s)')

        self.stdout.write(self.style.SUCCESS(
            '\nDone. Database cleared. Module definitions are intact.\n'
            '  Run: python manage.py seed_modules   (if needed)\n'
            '  Then register a fresh account via the app.\n'
        ))
