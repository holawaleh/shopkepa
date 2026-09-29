"""
Idempotency-Key support for money-moving POST endpoints.

A client (the POS, a payment modal) generates one random key per logical
action and sends it as the `Idempotency-Key` header on every attempt of
that action - the first try and any network retry or double-tap. The
server performs the action at most once per key and replays the original
response to every repeat, so a flaky connection can never record the same
sale or payment twice.

Requests without the header behave exactly as before.
"""
from datetime import timedelta
from functools import wraps

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from core.models import IdempotencyRecord

HEADER = 'Idempotency-Key'
MAX_KEY_LENGTH = 100
# A key still marked "in progress" after this long belongs to a request
# that died mid-flight (worker killed at gunicorn's 120s timeout, crash) -
# let the retry through rather than blocking that key forever.
STALE_AFTER = timedelta(seconds=120)


def idempotent(view_method):
    """Decorator for an APIView handler (e.g. `post`). Must run after DRF has
    authenticated the request, which is the case for handler methods."""

    @wraps(view_method)
    def wrapper(self, request, *args, **kwargs):
        key = request.headers.get(HEADER)
        business = getattr(request.user, 'business', None)
        if not key or business is None:
            return view_method(self, request, *args, **kwargs)

        key = key.strip()
        if not key or len(key) > MAX_KEY_LENGTH:
            return Response(
                {'error': f'{HEADER} must be 1-{MAX_KEY_LENGTH} characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        record = _claim(business, key, request)
        if isinstance(record, Response):
            return record  # a replay, or a conflict to report

        try:
            # The action and the stored response commit together: a
            # completed record can never exist for an action that rolled back.
            with transaction.atomic():
                response = view_method(self, request, *args, **kwargs)
                if 200 <= response.status_code < 300:
                    record.status_code = response.status_code
                    record.response_body = response.data
                    record.save(update_fields=['status_code', 'response_body'])
        except Exception:
            record.delete()
            raise

        if not 200 <= response.status_code < 300:
            # Nothing was done (validation error, insufficient stock, ...):
            # free the key so the client can correct the input and retry it.
            record.delete()
        return response

    return wrapper


def _claim(business, key, request):
    """Insert the in-progress marker for this key, or explain why not.

    Returns the new IdempotencyRecord on success, or a Response to send
    back instead (the replayed original, 409 in progress, 422 misuse)."""
    for _ in range(2):
        try:
            with transaction.atomic():
                return IdempotencyRecord.objects.create(
                    business=business, key=key,
                    method=request.method, path=request.path,
                )
        except IntegrityError:
            pass

        existing = IdempotencyRecord.objects.filter(business=business, key=key).first()
        if existing is None:
            continue  # the other request just released it - try again

        if existing.method != request.method or existing.path != request.path:
            return Response(
                {'error': f'This {HEADER} was already used for a different request.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        if existing.status_code is not None:
            return Response(
                existing.response_body,
                status=existing.status_code,
                headers={'Idempotent-Replayed': 'true'},
            )

        if timezone.now() - existing.created_at > STALE_AFTER:
            existing.delete()
            continue

        return Response(
            {'error': 'This request is already being processed. Please wait a moment.'},
            status=status.HTTP_409_CONFLICT,
            headers={'Retry-After': '2'},
        )

    return Response(
        {'error': 'Could not process this request. Please retry.'},
        status=status.HTTP_409_CONFLICT,
        headers={'Retry-After': '2'},
    )
