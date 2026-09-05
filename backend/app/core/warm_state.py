"""Process-local memory of recent GPU wakes.

Prewarm is a public endpoint that spends money, so repeat calls arriving inside one
warm window are collapsed into a single upstream wake. See ADR 0001 for why this
state lives in process memory, and for the single-instance constraint that follows
from that choice.

The clock is injected so warm-window behaviour can be tested without sleeping.
"""

import time
from typing import Callable, Optional

# Must stay comfortably below the frontend's heartbeat interval. If the dedupe
# window were the longer of the two, every heartbeat would be swallowed here and
# the container would scale to zero underneath a visitor who was still present —
# the exact failure the heartbeat exists to prevent.
WARM_DEDUPE_WINDOW_SECONDS = 120.0

# Sized against Modal's monthly spend limit rather than expected traffic, leaving
# headroom for the inference the wakes exist to serve. Deliberately monthly: a
# daily budget cannot protect a monthly ceiling, because a day's worth of
# authorised wakes can exceed the whole month's allowance.
MONTHLY_WARM_BUDGET = 100

_MONTH_SECONDS = 30 * 24 * 60 * 60


class WarmState:
    """Tracks whether a wake was dispatched recently enough to still be in effect."""

    def __init__(
        self,
        clock: Callable[[], float] = time.monotonic,
        dedupe_window: float = WARM_DEDUPE_WINDOW_SECONDS,
        monthly_budget: int = MONTHLY_WARM_BUDGET,
    ):
        self._clock = clock
        self._dedupe_window = dedupe_window
        self._monthly_budget = monthly_budget
        self._last_dispatch_at: Optional[float] = None
        self._last_known_warm = False
        self._spent = 0
        self._period_started_at = clock()

    def is_within_dedupe_window(self) -> bool:
        """True while a recent wake makes another one redundant.

        Kept separate from the budget check because the two declines mean
        different things: here our knowledge of the GPU is fresh, so the last
        answer can be reported as-is.
        """
        if self._last_dispatch_at is None:
            return False
        return (self._clock() - self._last_dispatch_at) <= self._dedupe_window

    def has_budget_remaining(self) -> bool:
        """False once this period's wakes are spent. Rolls over lazily."""
        if (self._clock() - self._period_started_at) >= _MONTH_SECONDS:
            self._period_started_at = self._clock()
            self._spent = 0
        return self._spent < self._monthly_budget

    def record_dispatch(self, *, warm: bool) -> None:
        """Note that a wake was just sent, and what it told us about the GPU."""
        self._last_dispatch_at = self._clock()
        self._last_known_warm = warm
        self._spent += 1

    @property
    def last_known_warm(self) -> bool:
        """The most recent answer from upstream.

        Reported to callers whose request was deduped, so that skipping the
        upstream call does not read as a cold GPU — nor as a warm one while a
        wake we dispatched is still in progress.
        """
        return self._last_known_warm
