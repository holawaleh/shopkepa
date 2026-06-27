from django.db import transaction
from core.models import (
    Business, BusinessSettings, User,
    Branch, ExpenseCategory
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


@transaction.atomic
def register_business(validated_data):
    # 1. Create Business
    business = Business.objects.create(
        name=validated_data['business_name'],
        owner_name=validated_data['owner_name'],
        phone_number=validated_data['phone_number'],
        email=validated_data.get('email', ''),
        address=validated_data.get('location', ''),
    )

    # 2. Create Owner User
    user = User.objects.create_user(
        username=validated_data['username'],
        password=validated_data['password'],
        full_name=validated_data['owner_name'],
        phone_number=validated_data['phone_number'],
        email=validated_data['email'],
        location=validated_data.get('location', ''),
        business=business,
        role=User.ROLE_OWNER,
    )

    # 3. Create Default Branch
    Branch.objects.create(
        business=business,
        name='Main Store',
        address=validated_data.get('location', ''),
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