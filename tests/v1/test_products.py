from django.test import TestCase

from core.models import Branch, BranchInventory, Module, ProductCategory, StockAdjustment

from .factories import activate_module, client_for, make_business


class OpeningStockTests(TestCase):
    def setUp(self):
        self.owner, self.business, self.main = make_business()
        self.module = activate_module(self.business)
        self.other = Branch.objects.create(business=self.business, name='Annex', created_by=self.owner)
        self.client = client_for(self.owner)

    def add_product(self, **extra):
        return self.client.post('/api/v1/products/', {
            'name': 'Rice 50kg', 'module_id': str(self.module.id),
            'retail_price': '60000', 'wholesale_price': '58000', **extra,
        }, format='json')

    def stock_at(self, product_id, branch):
        return BranchInventory.objects.get(product_id=product_id, branch=branch).quantity_in_stock

    def test_opening_stock_defaults_to_the_main_branch(self):
        res = self.add_product(opening_stock=25)
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(self.stock_at(res.data['id'], self.main), 25)
        self.assertEqual(self.stock_at(res.data['id'], self.other), 0)

        adj = StockAdjustment.objects.get(product_id=res.data['id'])
        self.assertEqual(adj.adjustment_type, StockAdjustment.TYPE_OPENING_STOCK)
        self.assertEqual((adj.quantity_before, adj.quantity_after), (0, 25))

    def test_opening_stock_can_go_to_a_chosen_branch(self):
        res = self.add_product(opening_stock=7, opening_stock_branch_id=str(self.other.id))
        self.assertEqual(self.stock_at(res.data['id'], self.other), 7)
        self.assertEqual(self.stock_at(res.data['id'], self.main), 0)

    def test_no_opening_stock_behaves_as_before(self):
        res = self.add_product()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.stock_at(res.data['id'], self.main), 0)
        self.assertFalse(StockAdjustment.objects.filter(product_id=res.data['id']).exists())

    def test_negative_opening_stock_is_rejected(self):
        self.assertEqual(self.add_product(opening_stock=-3).status_code, 400)

    def test_another_business_branch_is_rejected(self):
        _, other_business, foreign_branch = make_business('Other')
        res = self.add_product(opening_stock=5, opening_stock_branch_id=str(foreign_branch.id))
        self.assertEqual(res.status_code, 400)


class CategoryScopingTests(TestCase):
    """Categories belong to a module; a business only sees the categories of
    modules it has switched on."""

    def setUp(self):
        self.owner, self.business, _ = make_business()
        self.client = client_for(self.owner)

    def list_categories(self, **params):
        res = self.client.get('/api/v1/products/categories/', params)
        self.assertEqual(res.status_code, 200)
        return res.data

    def test_signup_creates_no_product_categories(self):
        self.assertFalse(ProductCategory.objects.filter(business=self.business).exists())

    def test_no_active_modules_means_no_categories(self):
        activate_module(self.business, 'fashion').business_modules.update(is_active=False)
        self.assertEqual(self.list_categories(), [])

    def test_only_active_module_categories_are_returned(self):
        activate_module(self.business, 'electronics')
        Module.objects.get_or_create(code='fashion', defaults={'name': 'Fashion'})  # exists, not active here

        codes = {c['module_code'] for c in self.list_categories()}
        self.assertEqual(codes, {'electronics'})

    def test_deactivating_a_module_hides_its_categories(self):
        activate_module(self.business, 'electronics')
        fashion = activate_module(self.business, 'fashion')
        self.assertIn('fashion', {c['module_code'] for c in self.list_categories()})

        fashion.business_modules.filter(business=self.business).update(is_active=False)
        self.assertNotIn('fashion', {c['module_code'] for c in self.list_categories()})


class BarcodeTests(TestCase):
    def setUp(self):
        self.owner, self.business, self.main = make_business()
        self.module = activate_module(self.business)
        self.client = client_for(self.owner)

    def add_product(self, name='Rice 50kg', **extra):
        return self.client.post('/api/v1/products/', {
            'name': name, 'module_id': str(self.module.id),
            'retail_price': '60000', 'wholesale_price': '58000', **extra,
        }, format='json')

    def assert_valid_store_ean13(self, code):
        from core.services.barcodes import ean13_check_digit
        self.assertRegex(code, r'^2\d{12}$')
        self.assertEqual(code[-1], ean13_check_digit(code[:12]))

    def test_check_digit_matches_a_known_ean13(self):
        from core.services.barcodes import ean13_check_digit
        self.assertEqual(ean13_check_digit('400638133393'), '1')  # 4006381333931

    def test_new_product_gets_a_generated_barcode(self):
        res = self.add_product()
        self.assertEqual(res.status_code, 201, res.data)
        self.assert_valid_store_ean13(res.data['barcode'])

    def test_manufacturer_barcode_is_kept(self):
        res = self.add_product(barcode='5449000000996')
        self.assertEqual(res.data['barcode'], '5449000000996')

    def test_duplicate_barcode_is_rejected(self):
        self.add_product(barcode='5449000000996')
        res = self.add_product(name='Coke 2', barcode='5449000000996')
        self.assertEqual(res.status_code, 400)
        self.assertIn('barcode', res.data)

    def test_product_can_keep_its_own_barcode_on_edit(self):
        pid = self.add_product(barcode='5449000000996').data['id']
        res = self.client.patch(f'/api/v1/products/{pid}/', {'barcode': '5449000000996'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)

    def test_same_barcode_allowed_in_another_business(self):
        self.add_product(barcode='5449000000996')
        other_owner, other_business, _ = make_business('Other')
        other_module = activate_module(other_business)
        res = client_for(other_owner).post('/api/v1/products/', {
            'name': 'Coke', 'module_id': str(other_module.id),
            'retail_price': '500', 'wholesale_price': '450', 'barcode': '5449000000996',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)

    def test_generate_missing_fills_only_blank_barcodes(self):
        from core.models import Product
        from .factories import make_product
        kept = self.add_product(barcode='5449000000996').data['id']
        a = make_product(self.business, self.main, self.module, name='A')
        b = make_product(self.business, self.main, self.module, name='B')
        Product.objects.filter(id__in=[a.id, b.id]).update(barcode='')

        res = self.client.post('/api/v1/products/barcodes/generate-missing/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['generated'], 2)
        codes = list(Product.objects.filter(id__in=[a.id, b.id]).values_list('barcode', flat=True))
        for code in codes:
            self.assert_valid_store_ean13(code)
        self.assertEqual(len(set(codes)), 2)
        self.assertEqual(Product.objects.get(id=kept).barcode, '5449000000996')

        self.assertEqual(self.client.post('/api/v1/products/barcodes/generate-missing/').data['generated'], 0)


class StockDisplayTests(TestCase):
    """Stock shown on Products, POS and reports must match the stock rows."""

    def setUp(self):
        from .factories import make_product
        self.owner, self.business, self.main = make_business()
        self.module = activate_module(self.business)
        self.client = client_for(self.owner)
        self.closed = Branch.objects.create(business=self.business, name='Closed shop', created_by=self.owner)
        self.product = make_product(self.business, self.main, self.module, stock=7, name='Rice')
        BranchInventory.objects.create(business=self.business, branch=self.closed, product=self.product, quantity_in_stock=0)
        self.closed.is_deleted = True
        self.closed.save()

    def test_products_list_ignores_deleted_branches(self):
        row = self.client.get('/api/v1/products/').data[0]
        self.assertEqual([s['branch_name'] for s in row['stock']], [self.main.name])
        self.assertEqual(row['stock'][0]['quantity_in_stock'], 7)

    def test_pos_list_gives_that_branch_stock(self):
        row = self.client.get('/api/v1/products/', {'branch_id': str(self.main.id)}).data[0]
        self.assertEqual(row['stock'], 7)

    def test_product_list_query_count_does_not_grow_with_products(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        from .factories import make_product

        def count():
            with CaptureQueriesContext(connection) as ctx:
                self.client.get('/api/v1/products/', {'branch_id': str(self.main.id)})
            return len(ctx.captured_queries)

        before = count()
        for n in range(8):
            make_product(self.business, self.main, self.module, name=f'Extra {n}')
        self.assertEqual(count(), before)

    def test_inventory_report_names_fields_and_skips_deleted_branches(self):
        self.product.reorder_level = 10
        self.product.save()
        data = self.client.get('/api/v1/reports/inventory/').data
        self.assertEqual(len(data['low_stock_items']), 1)
        item = data['low_stock_items'][0]
        self.assertEqual((item['product_name'], item['branch_name'], item['quantity_in_stock'], item['reorder_level']),
                         ('Rice', self.main.name, 7, 10))
        self.assertEqual(data['out_of_stock_count'], 0)   # the 0 is in the deleted branch

    def test_stock_adjustment_with_same_key_counts_once(self):
        url = f'/api/v1/products/{self.product.id}/adjust-stock/'
        body = {'branch_id': str(self.main.id), 'adjustment_type': 'restock', 'quantity_change': 5}
        for _ in range(2):
            res = self.client.post(url, body, format='json', HTTP_IDEMPOTENCY_KEY='restock-once')
            self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(BranchInventory.objects.get(branch=self.main, product=self.product).quantity_in_stock, 12)

    def test_manual_return_adds_stock(self):
        res = self.client.post(f'/api/v1/products/{self.product.id}/adjust-stock/', {
            'branch_id': str(self.main.id), 'adjustment_type': 'return', 'quantity_change': 2,
        }, format='json')
        self.assertEqual(res.data['quantity_after'], 9)
