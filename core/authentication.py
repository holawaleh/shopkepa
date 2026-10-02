from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class ActiveAccountJWTAuthentication(JWTAuthentication):
    """
    JWT auth that also re-checks the account on every request, not just at
    login. simplejwt already rejects users whose own is_active is False; this
    adds the business: when the platform admin disables a business, everyone
    in it is locked out immediately instead of keeping access until their
    (24h) access token expires. Platform superusers are never blocked by
    their own business's status.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user.is_deleted:
            raise AuthenticationFailed('This account no longer exists.', code='user_deleted')
        if not user.is_superuser and user.business_id and not user.business.is_active:
            raise AuthenticationFailed(
                'Your business account is inactive. Contact ShopKepa support.',
                code='business_inactive',
            )
        return user


def account_block_reason(user):
    """Why `user` may not get new tokens (login / refresh), or None if fine."""
    if not user.is_active:
        return 'Your account has been deactivated. Contact your business owner.'
    if user.is_deleted:
        return 'This account no longer exists.'
    if not user.is_superuser and user.business_id and not user.business.is_active:
        return 'Your business account is inactive. Contact ShopKepa support.'
    return None
