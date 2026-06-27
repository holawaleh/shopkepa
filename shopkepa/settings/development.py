from .base import *

DEBUG = True

ALLOWED_HOSTS = ['*']

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.dummy.DummyCache',
    }
}

# Show emails in terminal during development
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'