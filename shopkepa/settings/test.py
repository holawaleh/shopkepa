"""Test settings: in-memory SQLite so the suite runs fast, offline, and never
touches the real (Neon) database. Run with:

    python manage.py test --settings=shopkepa.settings.test

Note SQLite ignores select_for_update(); row-locking behaviour is covered
in production by Postgres, and tests here exercise the logic around it.
"""
from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = ['testserver', 'localhost']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']  # speed

# Don't let auth-endpoint throttles bleed between test cases.
REST_FRAMEWORK = {**REST_FRAMEWORK, 'DEFAULT_THROTTLE_CLASSES': []}

CELERY_TASK_ALWAYS_EAGER = True
