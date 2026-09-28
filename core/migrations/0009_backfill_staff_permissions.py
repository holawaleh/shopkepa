# Existing managers/cashiers previously had full role-based access with no
# concept of granular permissions. Give them every privilege their role can
# hold so this feature launches as opt-out (owner narrows it down later from
# Settings > Team) rather than silently locking anyone out of what they
# already had access to.

from django.db import migrations


ALL_PRIVILEGES = ['pos', 'products', 'customers', 'job_cards', 'hotel', 'expenses', 'reports', 'void_sales']


def backfill_permissions(apps, schema_editor):
    User = apps.get_model('core', 'User')
    User.objects.filter(role__in=['manager', 'cashier'], permissions=[]).update(permissions=ALL_PRIVILEGES)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_user_permissions'),
    ]

    operations = [
        migrations.RunPython(backfill_permissions, noop),
    ]
