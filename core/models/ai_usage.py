import uuid
from django.db import models
from .business import Business


class AIUsageLog(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business         = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='ai_logs')
    user             = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True)
    query_text       = models.TextField()
    response_summary = models.TextField(null=True, blank=True)
    tokens_used      = models.IntegerField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_usage_logs'
        indexes  = [
            models.Index(fields=['business', 'created_at']),
        ]

    def __str__(self):
        return f"AI query by {self.business.name} at {self.created_at}"