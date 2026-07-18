"""Exponential backoff with jitter for transient failures.

Retries only failures `classify_exception` deems transient; permanent failures
re-raise immediately so callers fail fast. Jitter (full jitter) spreads retries so
a fleet of workers recovering from the same blip doesn't stampede the dependency.
"""

from __future__ import annotations

import logging
import random
import time
from typing import Callable, TypeVar

from app.services.errors import classify_exception

logger = logging.getLogger(__name__)

T = TypeVar('T')


def retry_sync(
    fn: Callable[[], T],
    *,
    attempts: int = 4,
    base_delay: float = 0.5,
    max_delay: float = 8.0,
    label: str = 'operation',
) -> T:
    """Call `fn` with exponential backoff + full jitter on transient errors.

    `attempts` is the total number of tries (not retries). Permanent errors raise
    on the first occurrence; transient errors raise after the final attempt.
    """
    last_exc: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except BaseException as exc:  # noqa: BLE001 - re-raised below after classify
            last_exc = exc
            transient = classify_exception(exc)
            if not transient or attempt >= attempts:
                if not transient:
                    logger.info('%s failed permanently (no retry): %s', label, exc)
                else:
                    logger.warning('%s exhausted %d attempts: %s', label, attempts, exc)
                raise
            # Full jitter: sleep in [0, min(max_delay, base * 2^(attempt-1))].
            ceiling = min(max_delay, base_delay * (2 ** (attempt - 1)))
            delay = random.uniform(0, ceiling)
            logger.warning(
                '%s failed (attempt %d/%d), retrying in %.2fs: %s',
                label, attempt, attempts, delay, exc,
            )
            time.sleep(delay)
    # Unreachable: the loop either returns or raises. Satisfy type checkers.
    assert last_exc is not None
    raise last_exc