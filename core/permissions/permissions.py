from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """
    Business owner or admin can access this endpoint.
    """
    message = 'Only the business owner can perform this action.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ('owner', 'admin')
        )


class IsManagerOrAbove(BasePermission):
    """
    Manager or Owner can access this endpoint.
    """
    message = 'Only managers or owners can perform this action.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ('owner', 'manager', 'admin')
        )


class IsCashierOrAbove(BasePermission):
    """
    Any authenticated staff member can access this endpoint.
    """
    message = 'Authentication required.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ('owner', 'manager', 'cashier')
        )


class IsBusinessActive(BasePermission):
    """
    Blocks access if the business account has been deactivated.
    """
    message = 'Your business account is inactive. Contact support.'

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            hasattr(request.user, 'business') and
            request.user.business is not None and
            request.user.business.is_active
        )


class IsSameBusiness(BasePermission):
    """
    Object-level permission — ensures user can only
    access records belonging to their own business.
    """
    message = 'You do not have permission to access this resource.'

    def has_object_permission(self, request, view, obj):
        business_id = getattr(obj, 'business_id', None)
        if business_id is None:
            business = getattr(obj, 'business', None)
            business_id = business.id if business else None
        return str(business_id) == str(request.user.business_id)