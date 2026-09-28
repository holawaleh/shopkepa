# Adds the new 'daily_summary' privilege to existing managers/cashiers so
# they get the new "my sales today" widget without the owner having to
# manually re-check a box for every existing staff member.

from django.db import migrations


def backfill(apps, schema_editor):
    User = apps.get_model('core', 'User')
    for user in User.objects.filter(role__in=['manager', 'cashier']):
        perms = user.permissions or []
        if 'daily_summary' not in perms:
            user.permissions = perms + ['daily_summary']
            user.save(update_fields=['permissions'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_backfill_staff_permissions'),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
