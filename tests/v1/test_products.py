from django.test import TestCase

from core.models import Branch, BranchInventory, StockAdjustment

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
