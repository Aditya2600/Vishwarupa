"""Error taxonomy for retry decisions.

Two questions drive fault tolerance: *should we retry?* and *should we burn an
SQS redelivery?* Both reduce to one classification — is the failure transient
(worth retrying) or permanent (fail fast). `TransientError` / `PermanentError`
carry that verdict explicitly; `classify_exception` infers it for the library
exceptions we can't annotate at the raise site (httpx, botocore).
"""

from __future__ import annotations


class TransientError(RuntimeError):
    """A failure that may succeed on retry (network blip, 429, 5xx, timeout).

    Subclasses RuntimeError so existing `except RuntimeError` / `except Exception`
    handlers keep working and `str(exc)` still yields the friendly message.
    """


class PermanentError(RuntimeError):
    """A failure that will not succeed on retry (insufficient credits, invalid
    avatar/template, malformed request). Retrying only wastes time and credits."""


# botocore error codes that indicate a retryable, server-side/transient condition.
_TRANSIENT_BOTO_CODES = {
    'Throttling',
    'ThrottlingException',
    'RequestThrottled',
    'RequestThrottledException',
    'RequestTimeout',
    'RequestTimeoutException',
    'SlowDown',
    'ServiceUnavailable',
    'InternalError',
    'InternalFailure',
    'ProvisionedThroughputExceededException',
    '503',
    '500',
}


def classify_exception(exc: BaseException) -> bool:
    """Return True if `exc` is transient (worth retrying), False if permanent.

    Defaults to permanent for unknown errors: we would rather surface an unexpected
    failure than silently retry it and burn time/credits on a loop that never heals.
    """
    # Explicit verdicts win.
    if isinstance(exc, TransientError):
        return True
    if isinstance(exc, PermanentError):
        return False

    # Stdlib network/timeout signals.
    if isinstance(exc, (TimeoutError, ConnectionError)):
        return True

    # httpx — imported lazily so this module has no hard dependency on it.
    try:
        import httpx

        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            return status == 429 or status >= 500
        if isinstance(exc, (httpx.TimeoutException, httpx.TransportError)):
            # TransportError covers ConnectError, ReadError, NetworkError, etc.
            return True
    except ImportError:
        pass

    # botocore — S3/SQS client failures.
    try:
        from botocore.exceptions import (
            BotoCoreError,
            ClientError,
            ConnectionError as BotoConnectionError,
            EndpointConnectionError,
        )

        if isinstance(exc, ClientError):
            error = exc.response.get('Error', {}) if hasattr(exc, 'response') else {}
            code = str(error.get('Code') or '')
            if code in _TRANSIENT_BOTO_CODES:
                return True
            status = (
                exc.response.get('ResponseMetadata', {}).get('HTTPStatusCode')
                if hasattr(exc, 'response')
                else None
            )
            if isinstance(status, int) and (status == 429 or status >= 500):
                return True
            return False
        if isinstance(exc, (EndpointConnectionError, BotoConnectionError)):
            return True
        if isinstance(exc, BotoCoreError):
            # ConnectTimeoutError / ReadTimeoutError and friends are BotoCoreErrors.
            name = type(exc).__name__.lower()
            return 'timeout' in name or 'connection' in name
    except ImportError:
        pass

    return False


def is_transient_provider_message(message: str | None) -> bool:
    """Classify a HeyGen failure that arrives as a 200-body status (no HTTP error),
    e.g. a render that finished in state 'failed'. Default permanent."""
    lowered = (message or '').lower()
    if not lowered:
        return False
    if 'insufficient credit' in lowered:
        return False
    if 'not available' in lowered or 'unavailable' in lowered:
        return False
    if 'timed out' in lowered or 'timeout' in lowered or 'longer than expected' in lowered:
        return True
    return False