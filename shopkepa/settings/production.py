from .base import *
import dj_database_url

DEBUG = False

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['*'])

# Override the database from base.py completely
# Uses DATABASE_URL from Render environment variables
DATABASES = {
    'default': dj_database_url.config(
        default=env('DATABASE_URL'),
        conn_max_age=600,
    )
}

# Redis — optional, skip if not set
REDIS_URL = env('REDIS_URL', default=None)
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            }
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        }
    }

# CORS — allow production URL + all Vercel preview deployments for this project
_cors_env = env.list('CORS_ALLOWED_ORIGINS', default=[])
CORS_ALLOWED_ORIGINS = list(set(_cors_env + [
    'https://shopkepa.vercel.app',
]))

# Covers preview URLs like shopkepa-abc123-holawalehs-projects.vercel.app
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^https://shopkepa[a-z0-9-]*\.vercel\.app$',
]

# Security
SECURE_BROWSER_XSS_FILTER   = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS             = 'DENY'

# Static files
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = BASE_DIR / 'staticfiles'