import uuid
from django.db import models
from .business import Business


class Branch(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business       = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='branches')
    name           = models.CharField(max_length=150)
    address        = models.TextField(null=True, blank=True)
    phone_number   = models.CharField(max_length=20, null=True, blank=True)
    is_main_branch = models.BooleanField(default=False)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)
    is_deleted     = models.BooleanField(default=False)
    deleted_at     = models.DateTimeField(null=True, blank=True)
    created_by     = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'branches'
        verbose_name_plural = 'branches'

    def __str__(self):
        return f"{self.name} — {self.business.name}"


class UserBranch(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='user_branches')
    branch     = models.ForeignKey(Branch, on_delete=models.CASCADE, related_name='user_branches')
    business   = models.ForeignKey(Business, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='granted_branch_access')

    class Meta:
        db_table = 'user_branches'
        unique_together = ('user', 'branch')

    def __str__(self):
        return f"{self.user.full_name} → {self.branch.name}"