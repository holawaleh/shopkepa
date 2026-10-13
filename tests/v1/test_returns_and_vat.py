from decimal import Decimal

from django.test import TestCase

from core.models import (
    BranchInventory, BusinessSettings, Customer, Payment, Sale, SaleReturn,
    StockAdjustment, User,
)

from .factories import activate_module, client_for, make_business, make_product


class ReturnTestBase(TestCase):
    def setUp(self):
        self.owner, self.business, self.branch = make_business()
        self.module = activate_module(self.business)
        self.product = make_product(self.business, self.branch, self.module, stock=10, price='1000.00')
        self.client = client_for(self.owner)
        self.customer = Customer.objects.create(business=self.business, full_name='Bisi')

    def sell(self, qty=4, paid=None, discount='0', customer=True):
        res = self.client.post('/api/v1/sales/', {
            'branch_id': str(self.branch.id), 'module_id': str(self.module.id),
            'items': [{'product_id': str(self.product.id), 'quantity': qty,
                       'price_type': 'retail', 'unit_price': '1000.00'}],
            'payment_method': 'cash', 'discount_amount': discount,
            'amount_paid': str(qty * 1000 - Decimal(discount) if paid is None else paid),
            **({'customer_id': str(self.customer.id)} if customer else {}),
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        return Sale.objects.get(id=res.data['id'] if 'id' in res.data else res.data['sale']['id'])

    def give_back(self, sale, qty, restock=True, client=None, **extra):
        item = sale.items.get()
        return (client or self.client).post(f'/api/v1/sales/{sale.id}/returns/', {
            'items': [{'sale_item_id': str(item.id), 'quantity': qty, 'restock': restock}],
            **extra,
        }, format='json')

    def stock(self):
        return BranchInventory.objects.get(branch=self.branch, product=self.product).quantity_in_stock


class ReturnTests(ReturnTestBase):
    def test_paid_sale_return_restocks_and_refunds(self):
        sale = self.sell(qty=4)
        self.assertEqual(self.stock(), 6)
        res = self.give_back(sale, 1, refund_method='cash', reason='Wrong size')
        self.assertEqual(res.status_code, 201, res.data)

        sale.refresh_from_db()
        self.assertEqual(self.stock(), 7)
        self.assertEqual((sale.total_amount, sale.amount_paid, sale.returned_amount),
                         (Decimal('3000'), Decimal('3000'), Decimal('1000')))
        self.assertEqual(sale.items.get().returned_quantity, 1)
        refund = Payment.objects.get(sale=sale, amount__lt=0)
        self.assertEqual((refund.amount, refund.payment_method), (Decimal('-1000'), 'cash'))
        ret = SaleReturn.objects.get()
        self.assertEqual((ret.value, ret.refund_amount, ret.debt_reduction), (Decimal('1000'), Decimal('1000'), 0))
        self.assertTrue(ret.return_number.startswith('RT-'))
        self.assertTrue(StockAdjustment.objects.filter(reference_id=ret.id, adjustment_type='return').exists())
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.lifetime_spend, Decimal('3000'))

    def test_credit_sale_return_reduces_debt_without_refund(self):
        sale = self.sell(qty=4, paid='0')
        res = self.give_back(sale, 2)
        self.assertEqual(res.status_code, 201, res.data)
        sale.refresh_from_db()
        self.customer.refresh_from_db()
        self.assertEqual((sale.total_amount, sale.balance_due, sale.amount_paid), (Decimal('2000'), Decimal('2000'), 0))
        self.assertEqual(self.customer.total_outstanding_debt, Decimal('2000'))
        self.assertEqual(sale.installment_plan.current_balance, Decimal('2000'))
        self.assertFalse(Payment.objects.filter(amount__lt=0).exists())

    def test_part_paid_sale_clears_debt_first_then_refunds_the_rest(self):
        sale = self.sell(qty=4, paid='3000')          # owes 1000
        res = self.give_back(sale, 2, refund_method='transfer')
        self.assertEqual(res.status_code, 201, res.data)
        ret = SaleReturn.objects.get()
        self.assertEqual((ret.debt_reduction, ret.refund_amount), (Decimal('1000'), Decimal('1000')))
        sale.refresh_from_db()
        self.assertEqual((sale.balance_due, sale.amount_paid, sale.payment_status), (0, Decimal('2000'), 'paid'))
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.total_outstanding_debt, 0)

    def test_refund_needs_a_method(self):
        sale = self.sell(qty=2)
        res = self.give_back(sale, 1)
        self.assertEqual(res.status_code, 400)
        self.assertFalse(SaleReturn.objects.exists())

    def test_cannot_return_more_than_was_sold(self):
        sale = self.sell(qty=2)
        self.assertEqual(self.give_back(sale, 1, refund_method='cash').status_code, 201)
        res = self.give_back(sale, 2, refund_method='cash')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Only 1', res.data['error'])

    def test_damaged_goods_are_not_restocked(self):
        sale = self.sell(qty=2)
        self.give_back(sale, 1, restock=False, refund_method='cash')
        self.assertEqual(self.stock(), 8)
        self.assertFalse(SaleReturn.objects.get().items.get().restocked)

    def test_whole_sale_discount_is_shared_across_returned_units(self):
        sale = self.sell(qty=4, discount='400')       # 3600 for 4 -> 900 each
        self.give_back(sale, 1, refund_method='cash')
        self.assertEqual(SaleReturn.objects.get().value, Decimal('900'))

    def test_full_return_brings_everything_to_zero(self):
        sale = self.sell(qty=3, discount='100')       # 2900, 966.67 each
        self.give_back(sale, 2, refund_method='cash')
        self.give_back(sale, 1, refund_method='cash')
        sale.refresh_from_db()
        self.assertEqual((sale.total_amount, sale.amount_paid, sale.returned_amount),
                         (0, 0, Decimal('2900')))
        self.assertEqual(self.stock(), 10)

    def test_cashier_cannot_record_returns(self):
        sale = self.sell(qty=2)
        cashier = User.objects.create_user('cash1', 'pw', business=self.business, role='cashier',
                                           full_name='Cashier', phone_number='0811')
        res = self.give_back(sale, 1, client=client_for(cashier), refund_method='cash')
        self.assertEqual(res.status_code, 403)

    def test_sale_detail_lists_returns(self):
        sale = self.sell(qty=2)
        self.give_back(sale, 1, refund_method='pos')
        data = self.client.get(f'/api/v1/sales/{sale.id}/').data
        self.assertEqual(len(data['returns']), 1)
        self.assertEqual(data['items'][0]['returned_quantity'], 1)
        listed = self.client.get('/api/v1/sales/returns/').data
        self.assertEqual(listed[0]['sale_number'], sale.sale_number)


class VoidTests(ReturnTestBase):
    def test_void_puts_stock_back_and_clears_customer_debt(self):
        sale = self.sell(qty=3, paid='0')
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.total_outstanding_debt, Decimal('3000'))
        self.assertEqual(self.client.delete(f'/api/v1/sales/{sale.id}/').status_code, 204)
        self.assertEqual(self.stock(), 10)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.total_outstanding_debt, 0)


class VatTests(ReturnTestBase):
    def enable_vat(self, rate='7.5'):
        BusinessSettings.objects.filter(business=self.business).update(vat_enabled=True, vat_rate=Decimal(rate))

    def test_no_vat_when_switched_off(self):
        sale = self.sell(qty=1)
        self.assertEqual((sale.tax_rate, sale.tax_amount), (0, 0))

    def test_vat_is_the_inclusive_share_of_the_total(self):
        self.enable_vat()
        sale = self.sell(qty=4, discount='0', paid='4000')   # 4000 incl. VAT
        self.assertEqual(sale.tax_rate, Decimal('7.50'))
        self.assertEqual(sale.tax_amount, Decimal('279.07'))  # 4000 * 7.5 / 107.5

    def test_return_takes_its_vat_off_the_sale(self):
        self.enable_vat()
        sale = self.sell(qty=4)
        self.give_back(sale, 4, refund_method='cash')
        sale.refresh_from_db()
        self.assertEqual(sale.tax_amount, 0)

    def test_settings_api_saves_vat(self):
        res = self.client.patch('/api/v1/business/settings/', {
            'vat_enabled': True, 'vat_rate': '7.50', 'tax_id_number': '12345678-0001'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data['vat_enabled'])
        self.assertEqual(res.data['tax_id_number'], '12345678-0001')

    def test_tax_report_totals(self):
        self.sell(qty=2)                      # before VAT: 2000, no VAT
        self.enable_vat()
        sale = self.sell(qty=4)               # 4000 incl. 279.07 VAT
        self.give_back(sale, 1, refund_method='cash')   # -1000, VAT 69.77
        data = self.client.get('/api/v1/reports/tax/').data
        t = data['totals']
        self.assertEqual(Decimal(t['gross_sales']), Decimal('6000'))
        self.assertEqual(Decimal(t['returns']), Decimal('1000'))
        self.assertEqual(Decimal(t['net_sales']), Decimal('5000'))
        self.assertEqual(Decimal(t['vatable_sales']), Decimal('3000'))
        self.assertEqual(Decimal(t['non_vat_sales']), Decimal('2000'))
        self.assertEqual(Decimal(t['vat_collected']), Decimal('209.30'))
        self.assertTrue(data['vat_enabled'])
        self.assertEqual(len(data['months']), 1)
