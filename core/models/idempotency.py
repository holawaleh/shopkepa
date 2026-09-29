import uuid
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from .business import Business


class IdempotencyRecord(models.Model):
    """
    One row per client-supplied Idempotency-Key on a money-moving POST.

    Created *before* the request is processed (status_code NULL = still in
    progress) so a concurrent duplicate sees it and backs off; once the
    request succeeds, the response is stored so any retry of the same key
    gets that exact response replayed instead of repeating the action.
    See core.idempotency.idempotent.
    """
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business      = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='idempotency_records')
    key           = models.CharField(max_length=100)
    method        = models.CharField(max_length=10)
    path          = models.CharField(max_length=255)
    status_code   = models.PositiveSmallIntegerField(null=True, blank=True)
    response_body = models.JSONField(null=True, blank=True, encoder=DjangoJSONEncoder)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'idempotency_records'
        constraints = [
            models.UniqueConstraint(fields=['business', 'key'], name='unique_idempotency_key_per_business'),
        ]
        indexes = [
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.method} {self.path} [{self.key}]"
