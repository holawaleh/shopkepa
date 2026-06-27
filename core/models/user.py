import uuid
import re
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.core.exceptions import ValidationError


def validate_username(value):
    if len(value) < 4:
        raise ValidationError('Username must be at least 4 characters.')
    if not re.match(r'^[a-z0-9_]+$', value):
        raise ValidationError(
            'Username may only contain lowercase letters, numbers, and underscores.'
        )


class UserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('Username is required')
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    ROLE_OWNER   = 'owner'
    ROLE_MANAGER = 'manager'
    ROLE_CASHIER = 'cashier'
    ROLE_CHOICES = [
        (ROLE_OWNER,   'Owner'),
        (ROLE_MANAGER, 'Manager'),
        (ROLE_CASHIER, 'Cashier'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    business     = models.ForeignKey('core.Business', on_delete=models.CASCADE, related_name='users', null=True, blank=True)
    full_name    = models.CharField(max_length=150)
    username     = models.CharField(max_length=50, unique=True, validators=[validate_username])
    phone_number = models.CharField(max_length=20, unique=True)
    email        = models.EmailField(unique=True)
    location     = models.TextField(null=True, blank=True)
    role         = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_CASHIER)
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    last_login_at = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    is_deleted   = models.BooleanField(default=False)
    deleted_at   = models.DateTimeField(null=True, blank=True)
    created_by   = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True)

    USERNAME_FIELD  = 'username'
    REQUIRED_FIELDS = ['full_name', 'phone_number', 'email']

    objects = UserManager()

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.username} ({self.full_name})"