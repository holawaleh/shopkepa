from .base import *
import dj_database_url

DEBUG = False

# Password reset email delivery. Set these on the production platform.
EMAIL_HOST = env('EMAIL_HOST', default='')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
if EMAIL_HOST:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# Never fall back to '*' (accepts any Host header - enables host-header
# poisoning of password-reset links etc.). Render sets
# RENDER_EXTERNAL_HOSTNAME automatically; add custom domains via
# ALLOWED_HOSTS in the Render dashboard.
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[]) + [
    h for h in [env('RENDER_EXTERNAL_HOSTNAME', default=''), 'shopkepa-backend.onrender.com'] if h
]

# Override the database from base.py completely
# Uses DATABASE_URL from Render environment variables
DATABASES = {
    'default': dj_database_url.config(
        default=env('DATABASE_URL'),
        conn_max_age=600,
        conn_health_checks=True,
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

# HTTPS. Render terminates TLS at its proxy and forwards plain HTTP with
# X-Forwarded-Proto, so trust that header to know the original scheme -
# without it Django thinks every request is HTTP and SSL redirect loops.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT     = env.bool('SECURE_SSL_REDIRECT', default=True)
SECURE_REDIRECT_EXEMPT  = [r'^$', r'^health/$']  # plain-HTTP health probes

# HSTS: browsers refuse plain HTTP to this host for a year. Scoped to this
# exact host only (no subdomains, no preload list) so it's easy to back out.
SECURE_HSTS_SECONDS            = env.int('SECURE_HSTS_SECONDS', default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD            = False

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE    = True

# Static files
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'
STATIC_ROOT = BASE_DIR / 'staticfiles'