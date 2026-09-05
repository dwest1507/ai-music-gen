"""Process-local memory of recent GPU wakes.

Prewarm is a public endpoint that spends money, so repeat calls arriving inside one
warm window are collapsed into a single upstream wake. See ADR 0001 for why this
state lives in process memory, and for the single-instance constraint that follows
from that choice.

Two clocks are injected so both behaviours can be tested without sleeping. They are
deliberately different clocks: the dedupe window measures an elapsed duration and
must not move when the wall clock is adjusted, while the budget period is a calendar
month and can only be read off the wall clock.
"""

import time
from datetime import datetime, timezone
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


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class WarmState:
    """Tracks whether a wake was dispatched recently enough to still be in effect."""

    def __init__(
        self,
        clock: Callable[[], float] = time.monotonic,
        dedupe_window: float = WARM_DEDUPE_WINDOW_SECONDS,
        monthly_budget: int = MONTHLY_WARM_BUDGET,
        calendar_clock: Callable[[], datetime] = _utc_now,
    ):
        self._clock = clock
        self._calendar_clock = calendar_clock
        self._dedupe_window = dedupe_window
        self._monthly_budget = monthly_budget
        self._last_dispatch_at: Optional[float] = None
        self._last_known_warm = False
        self._spent = 0
        self._in_flight = 0
        self._period = self._current_period()

    def _current_period(self) -> tuple[int, int]:
        now = self._calendar_clock()
        return (now.year, now.month)

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
        """False once this period's wakes are spent. Rolls over lazily.

        The period is the calendar month in UTC, not a rolling thirty days from
        first use. Modal bills by calendar month, so a rolling window is the wrong
        shape of protection: two adjacent windows can both spend their full
        allowance inside a single bill.
        """
        period = self._current_period()
        if period != self._period:
            self._period = period
            self._spent = 0
        return self._spent < self._monthly_budget

    def begin_dispatch(self) -> None:
        """Reserve a wake, before contacting upstream rather than after.

        A wake takes as long as a cold container takes to answer, and prewarm is
        a public endpoint: reserving on completion would let every request that
        arrived during that window pass both the dedupe and budget checks and
        wake upstream in parallel, which is the burst this class exists to
        collapse. Charging the budget up front means an in-flight wake is one the
        next caller can see.
        """
        self._last_dispatch_at = self._clock()
        self._spent += 1
        self._in_flight += 1

    def complete_dispatch(self, *, warm: bool) -> None:
        """Record what the wake we reserved learned about the GPU.

        The dedupe window restarts here as well as at reservation, so that it
        measures time since we last *knew* something rather than time since we
        started asking.
        """
        self._last_dispatch_at = self._clock()
        self._last_known_warm = warm
        self._in_flight = max(0, self._in_flight - 1)

    @property
    def last_known_warm(self) -> bool:
        """The most recent answer from upstream.

        Reported to callers whose request was deduped, so that skipping the
        upstream call does not read as a cold GPU — nor as a warm one while a
        wake we dispatched is still in progress. A wake being in flight is itself
        evidence the GPU was cold enough to need one, so it reads as cold until
        that wake answers.
        """
        if self._in_flight:
            return False
        return self._last_known_warm
