class BusinessScopedMixin:
    """
    Automatically filters all querysets to the
    authenticated user's business. Add this mixin
    to any ViewSet or APIView to enforce tenant isolation.
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(
            business=self.request.user.business,
            is_deleted=False
        )

    def perform_create(self, serializer):
        serializer.save(
            business=self.request.user.business,
            created_by=self.request.user
        )