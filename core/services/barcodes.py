"""
Store barcodes for products that don't carry a manufacturer code.

Codes are EAN-13 in the 20-29 prefix range, which GS1 reserves for
in-store use, so they never clash with a real manufacturer barcode and
every scanner (hardware or phone camera) reads them.
"""
import secrets

from django.db.models import Q

from core.models import Product


def ean13_check_digit(first12):
    total = sum(int(d) * (3 if i % 2 else 1) for i, d in enumerate(first12))
    return str((10 - total % 10) % 10)


def _random_code():
    body = '2' + ''.join(secrets.choice('0123456789') for _ in range(11))
    return body + ean13_check_digit(body)


def barcode_in_use(business, barcode, exclude_product_id=None):
    qs = Product.objects.filter(business=business, barcode=barcode, is_deleted=False)
    if exclude_product_id:
        qs = qs.exclude(id=exclude_product_id)
    return qs.exists()


def generate_barcode(business, taken=None):
    """
    A new code unique within the business. Pass `taken` (a set of codes
    already used) when generating many at once to avoid a query per code;
    the new code is added to it.
    """
    while True:
        code = _random_code()
        if taken is not None:
            if code in taken:
                continue
            taken.add(code)
            return code
        if not barcode_in_use(business, code):
            return code


def fill_missing_barcodes(business):
    """Give every product without a barcode a generated one. Returns the count."""
    products = Product.objects.filter(business=business, is_deleted=False)
    taken = set(products.exclude(barcode__isnull=True).exclude(barcode='')
                .values_list('barcode', flat=True))
    missing = list(products.filter(Q(barcode__isnull=True) | Q(barcode='')))
    for product in missing:
        product.barcode = generate_barcode(business, taken)
    Product.objects.bulk_update(missing, ['barcode'], batch_size=500)
    return len(missing)
