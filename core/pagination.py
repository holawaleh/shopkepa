from rest_framework.pagination import PageNumberPagination


class ShopKepaPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class SmallPagination(PageNumberPagination):
    """For dropdowns and search results at POS."""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 20


class LargePagination(PageNumberPagination):
    """For reports that need more data per page."""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200