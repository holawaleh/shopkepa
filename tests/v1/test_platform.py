from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import AuditLog, PasswordResetToken, User

from .factories import activate_module, client_for, make_business, make_product


def make_platform_admin():
    return User.objects.create_superuser(
        username='platformadmin', password='password123', full_name='Platform Admin',
        email='admin@shopkepa.test', phone_number='08099999999',
    )


class PlatformAccessTests(TestCase):
    def setUp(self):
        self.admin = make_platform_admin()
        self.owner, self.business, self.branch = make_business()

    def test_business_owner_cannot_reach_platform_endpoints(self):
        client = client_for(self.owner)
        for url in ['/api/v1/platform/overview/', '/api/v1/platform/businesses/',
                    '/api/v1/platform/users/', '/api/v1/platform/activity/']:
            self.assertEqual(client.get(url).status_code, 403, url)

    def test_anonymous_is_rejected(self):
        self.assertEqual(APIClient().get('/api/v1/platform/overview/').status_code, 401)

    def test_platform_admin_sees_every_business(self):
        make_business('Second')
        res = client_for(self.admin).get('/api/v1/platform/businesses/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['count'], 2)


class PlatformBusinessTests(TestCase):
    def setUp(self):
        self.admin = make_platform_admin()
        self.owner, self.business, self.branch = make_business()
        self.client = client_for(self.admin)

    def test_detail_shows_cost_and_selling_prices_and_profit(self):
        module = activate_module(self.business)
        product = make_product(self.business, self.branch, module, stock=10, price='1000.00')
        product.cost_price = Decimal('600.00')
        product.save()
        client_for(self.owner).post('/api/v1/sales/', {
            'branch_id': str(self.branch.id), 'module_id': str(module.id),
            'items': [{'product_id': str(product.id), 'quantity': 3,
                       'price_type': 'retail', 'unit_price': '1000.00'}],
            'payment_method': 'cash', 'amount_paid': '3000',
        }, format='json')

        data = self.client.get(f'/api/v1/platform/businesses/{self.business.id}/').data
        sales = data['sales']['all_time']
        self.assertEqual(sales['revenue'], Decimal('3000.00'))
        self.assertEqual(sales['cost_of_goods'], Decimal('1800.00'))
        self.assertEqual(sales['gross_profit'], Decimal('1200.00'))
        row = data['products'][0]
        self.assertEqual((row['cost_price'], row['retail_price'], row['margin_pct']),
                         (Decimal('600.00'), Decimal('1000.00'), Decimal('40.0')))
        line = data['recent_sale_lines'][0]
        self.assertEqual((line['sold_unit_price'], line['cost_price']), (Decimal('1000.00'), Decimal('600.00')))

    def test_disabling_a_business_locks_out_its_users_immediately(self):
        owner_client = client_for(self.owner)  # already "logged in"
        self.assertEqual(owner_client.get('/api/v1/auth/me/').status_code, 200)

        res = self.client.patch(f'/api/v1/platform/businesses/{self.business.id}/',
                                {'is_active': False}, format='json')
        self.assertEqual(res.status_code, 200)

        # force_authenticate bypasses auth classes, so use a real token here
        token = str(RefreshToken.for_user(self.owner).access_token)
        real = APIClient()
        real.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(real.get('/api/v1/auth/me/').status_code, 401)

        self.assertTrue(AuditLog.objects.filter(
            table_name='platform:businesses', action='DEACTIVATE', record_id=self.business.id).exists())

    def test_subscription_can_be_changed(self):
        res = self.client.patch(f'/api/v1/platform/businesses/{self.business.id}/',
                                {'subscription_tier': 'pro', 'ai_queries_limit': 500}, format='json')
        self.assertEqual(res.status_code, 200)
        self.business.refresh_from_db()
        self.assertEqual((self.business.subscription_tier, self.business.ai_queries_limit), ('pro', 500))

    def test_empty_update_is_rejected(self):
        res = self.client.patch(f'/api/v1/platform/businesses/{self.business.id}/', {}, format='json')
        self.assertEqual(res.status_code, 400)


class PlatformUserTests(TestCase):
    def setUp(self):
        self.admin = make_platform_admin()
        self.owner, self.business, self.branch = make_business()
        self.client = client_for(self.admin)

    def test_user_list_never_includes_passwords(self):
        row = self.client.get('/api/v1/platform/users/').data['results'][0]
        self.assertFalse({'password', 'password_hash'} & set(row))
        self.assertIn('signed_up_at', row)

    def test_disabling_a_user_blocks_login_refresh_and_existing_tokens(self):
        refresh = RefreshToken.for_user(self.owner)
        res = self.client.patch(f'/api/v1/platform/users/{self.owner.id}/', {'is_active': False}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data['is_active'])

        api = APIClient()
        api.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        self.assertEqual(api.get('/api/v1/auth/me/').status_code, 401)

        login = APIClient().post('/api/v1/auth/login/', {
            'email': self.owner.email, 'password': 'password123'}, format='json')
        self.assertEqual(login.status_code, 403)

        cookie_client = APIClient()
        cookie_client.cookies['shopkepa_refresh'] = str(refresh)
        self.assertIn(cookie_client.post('/api/v1/auth/token/refresh/').status_code, (401, 403))

    def test_re_enabling_restores_login(self):
        self.client.patch(f'/api/v1/platform/users/{self.owner.id}/', {'is_active': False}, format='json')
        self.client.patch(f'/api/v1/platform/users/{self.owner.id}/', {'is_active': True}, format='json')
        login = APIClient().post('/api/v1/auth/login/', {
            'email': self.owner.email, 'password': 'password123'}, format='json')
        self.assertEqual(login.status_code, 200)

    def test_platform_admins_cannot_be_disabled_here(self):
        res = self.client.patch(f'/api/v1/platform/users/{self.admin.id}/', {'is_active': False}, format='json')
        self.assertEqual(res.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_reset_link_is_single_use_token_not_a_password(self):
        res = self.client.post(f'/api/v1/platform/users/{self.owner.id}/reset-link/')
        self.assertEqual(res.status_code, 201)
        self.assertIn('/reset-password?token=', res.data['reset_url'])
        self.assertEqual(PasswordResetToken.objects.filter(user=self.owner, used_at__isnull=True).count(), 1)

        token = res.data['reset_url'].split('token=')[1]
        confirm = APIClient().post('/api/v1/auth/password-reset/confirm/', {
            'token': token, 'new_password': 'BrandNew!Pass1', 'confirm_password': 'BrandNew!Pass1',
        }, format='json')
        self.assertEqual(confirm.status_code, 200, confirm.data)
        self.owner.refresh_from_db()
        self.assertTrue(self.owner.check_password('BrandNew!Pass1'))

    def test_activity_feed_names_the_user_and_business(self):
        APIClient().post('/api/v1/auth/login/', {
            'email': self.owner.email, 'password': 'password123'}, format='json')
        row = self.client.get('/api/v1/platform/activity/', {'action': 'LOGIN'}).data['results'][0]
        self.assertEqual(row['user_name'], self.owner.full_name)
        self.assertEqual(row['business_name'], self.business.name)
