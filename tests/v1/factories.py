"""Small helpers to build a realistic business for API tests."""
from decimal import Decimal
from itertools import count

from rest_framework.test import APIClient

from core.models import (
    Branch, BranchInventory, BusinessModule, Module, Product, Room,
)
from core.services.auth_service import register_business

_seq = count(1)


def make_business(name='Test Shop'):
    """Owner + business + main branch, via the same path as real signup."""
    n = next(_seq)
    owner = register_business({
        'business_name': f'{name} {n}',
        'first_name': 'Owner', 'last_name': str(n),
        'phone': f'0800000{n:04d}',
        'email': f'owner{n}@example.com',
        'password': 'password123',
        'location': '',
    })
    branch = Branch.objects.get(business=owner.business, is_main_branch=True)
    return owner, owner.business, branch


def activate_module(business, code='general_trade'):
    module, _ = Module.objects.get_or_create(code=code, defaults={'name': code})
    BusinessModule.objects.get_or_create(business=business, module=module, defaults={'is_active': True})
    return module


def make_product(business, branch, module, stock=10, price='1000.00', name='Widget'):
    product = Product.objects.create(
        business=business, module=module, name=name,
        retail_price=Decimal(price), wholesale_price=Decimal(price),
    )
    BranchInventory.objects.create(
        business=business, branch=branch, product=product, quantity_in_stock=stock,
    )
    return product


def make_room(business, number='101', price='20000.00'):
    return Room.objects.create(business=business, room_number=number, price_per_night=Decimal(price))


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client
