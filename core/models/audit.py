import uuid
from django.db import models
from django.core.serializers.json import DjangoJSONEncoder


class AuditLog(models.Model):
    ACTION_CREATE     = 'CREATE'
    ACTION_UPDATE     = 'UPDATE'
    ACTION_DELETE     = 'DELETE'
    ACTION_LOGIN      = 'LOGIN'
    ACTION_LOGOUT     = 'LOGOUT'
    ACTION_DEACTIVATE = 'DEACTIVATE'
    ACTION_CHOICES    = [
        (ACTION_CREATE,     'Create'),
        (ACTION_UPDATE,     'Update'),
        (ACTION_DELETE,     'Delete'),
        (ACTION_LOGIN,      'Login'),
        (ACTION_LOGOUT,     'Logout'),
        (ACTION_DEACTIVATE, 'Deactivate'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business_id = models.UUIDField()
    user_id     = models.UUIDField()
    action      = models.CharField(max_length=30, choices=ACTION_CHOICES)
    table_name  = models.CharField(max_length=100)
    record_id   = models.UUIDField()
    # DjangoJSONEncoder so UUID/Decimal/date/datetime values already present
    # in a view's validated_data (passed straight through as old/new_values
    # in several call sites) serialize instead of crashing the request with
    # a 500 the moment such a field is touched.
    old_values  = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    new_values  = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    ip_address  = models.CharField(max_length=45, null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table   = 'audit_logs'
        indexes    = [
            models.Index(fields=['business_id', 'created_at']),
            models.Index(fields=['table_name', 'record_id']),
        ]

    def __str__(self):
        return f"{self.action} on {self.table_name} by {self.user_id}"