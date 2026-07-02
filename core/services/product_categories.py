DEFAULT_PRODUCT_CATEGORIES = {
    'general_trade': [
        'Foodstuff', 'Beverages', 'Snacks', 'Toiletries', 'Household Items',
        'Baby Products', 'Cleaning Supplies', 'Frozen Foods', 'Stationery',
        'Health & Personal Care',
    ],
    'fashion': [
        "Men's Wear", "Women's Wear", "Children's Wear", 'Shoes', 'Bags',
        'Accessories', 'Fabrics', 'Native Wear', 'Corporate Wear', 'Sportswear',
    ],
    'electronics': [
        'Phones', 'Laptops', 'Tablets', 'TVs', 'Audio Devices', 'Chargers',
        'Cables', 'Accessories', 'Gaming Devices', 'Used / Refurbished',
    ],
    'food': [
        'Grains', 'Oils', 'Spices', 'Fresh Produce', 'Frozen Foods', 'Dairy',
        'Meat & Fish', 'Packaged Foods', 'Drinks', 'Household Essentials',
    ],
    'pharmacy': [
        'Prescription Drugs', 'Over-the-Counter Drugs', 'Supplements', 'First Aid',
        'Medical Devices', 'Skincare', 'Baby Care', 'Hygiene Products',
        'Lab / Diagnostic Items', 'Controlled Drugs',
    ],
    'building_materials': [
        'Cement', 'Iron Rods', 'Roofing Sheets', 'Plumbing Materials',
        'Electrical Fittings', 'Paints', 'Tiles', 'Tools', 'Timber & Boards',
        'Sand & Aggregates',
    ],
    'stationery': [
        'Exercise Books', 'Textbooks', 'Writing Materials', 'Office Supplies',
        'Art Supplies', 'School Bags', 'Files & Folders', 'Printing Supplies',
        'Uniform Accessories',
    ],
    'technical_services': [
        'Spare Parts', 'Screens', 'Batteries', 'Charging Ports', 'Speakers & Mics',
        'Tools', 'Accessories', 'Software Services', 'Diagnostic Fees', 'Labour',
    ],
    'hotel': [
        'Rooms', 'Food & Drinks', 'Mini Bar Items', 'Laundry', 'Event Hall',
        'Add-on Services', 'Tour Packages', 'Housekeeping Supplies',
    ],
}


def seed_default_product_categories(business, module_codes=None):
    from core.models import Module, ProductCategory

    modules = Module.objects.filter(is_active=True)
    if module_codes:
        modules = modules.filter(code__in=module_codes)

    created = []
    for module in modules:
        for name in DEFAULT_PRODUCT_CATEGORIES.get(module.code, []):
            category, was_created = ProductCategory.objects.get_or_create(
                business=business,
                module=module,
                name=name,
                defaults={'is_custom': False},
            )
            if was_created:
                created.append(category)
    return created