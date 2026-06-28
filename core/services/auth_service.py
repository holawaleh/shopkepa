import re
import random
from django.db import transaction
from core.models import (
    Business, BusinessSettings, User,
    Branch, ExpenseCategory,
)

DEFAULT_EXPENSE_CATEGORIES = [
    'Generator Fuel',
    'Rent',
    'Staff Salary',
    'Transport',
    'Utilities',
    'Stock Purchase',
    'Miscellaneous',
]


def _generate_username(first_name, email):
    """Derive a unique username from first_name, falling back to email prefix."""
    base = re.sub(r'[^a-z0-9_]', '', first_name.lower())
    if len(base) < 4:
        base = re.sub(r'[^a-z0-9_]', '', email.split('@')[0].lower())
    if len(base) < 4:
        base = 'user'

    candidate = base
    for _ in range(20):
        if not User.objects.filter(username=candidate).exists():
            return candidate
        candidate = f"{base}{random.randint(100, 9999)}"

    # Fallback: guaranteed unique
    return f"user{random.randint(100000, 999999)}"


@transaction.atomic
def register_business(validated_data):
    first_name = validated_data['first_name'].strip()
    last_name  = validated_data.get('last_name', '').strip()
    owner_name = f"{first_name} {last_name}".strip()
    phone      = validated_data['phone']
    email      = validated_data['email']
    location   = validated_data.get('location', '')
    username   = _generate_username(first_name, email)

    # 1. Create Business
    business = Business.objects.create(
        name=validated_data['business_name'],
        owner_name=owner_name,
        phone_number=phone,
        email=email,
        address=location,
    )

    # 2. Create Owner User
    user = User.objects.create_user(
        username=username,
        password=validated_data['password'],
        full_name=owner_name,
        phone_number=phone,
        email=email,
        location=location,
        business=business,
        role=User.ROLE_OWNER,
    )

    # 3. Create Default Branch
    Branch.objects.create(
        business=business,
        name='Main Store',
        address=location,
        is_main_branch=True,
        created_by=user,
    )

    # 4. Create Business Settings
    BusinessSettings.objects.create(business=business)

    # 5. Seed Default Expense Categories
    for category_name in DEFAULT_EXPENSE_CATEGORIES:
        ExpenseCategory.objects.create(
            business=business,
            name=category_name,
            is_custom=False,
        )

    return user
