---
status: accepted
---

# Speculatively prewarm the GPU before the user asks for a song

Modal wake dominates the wait for a first song, and it cannot overlap with anything
because nothing contacts the GPU until the user submits a Task. We now trigger a wake
from the browser on the visitor's first genuine interaction, so the wake overlaps the
time they spend reading the page and filling the form. This means **landing on the site
and doing nothing else can cost GPU money**, which is the surprising part and the reason
this record exists.

## Considered Options

- **Trigger on page mount** — biggest overlap window, but every crawler hit pays for a
  wake, and that cost scales with bot traffic we do not control.
- **Trigger on "Try an Example" click or first keystroke** — cannot be triggered by a
  bot, but collapses the window to a few seconds, because loading an Example fills the
  form instantly and a hurried visitor submits immediately afterward.
- **Trigger on first interaction** (chosen) — `pointermove` / `keydown` / `touchstart` /
  `scroll`, once per session. Keeps nearly the whole mount-sized window, while headless
  crawlers emit none of these events.
- **Keep a container permanently warm** — rejected outright; a always-on GPU costs
  roughly two orders of magnitude more per month than this project's entire budget.

Railway is a separate case and is not speculative: the backend is always-on, so its
warm ping is free insurance that keeps scaling to zero available as a future option.

## Consequences

A public endpoint now spends money on behalf of anonymous callers, so it is defended in
depth: an in-memory dedupe collapses repeat calls inside one warm window, the client
heartbeat is visibility-gated and capped so a forgotten open tab cannot hold a GPU
indefinitely, and a global daily budget bounds the worst case. Modal's own spend limit
sits underneath as an independent backstop — but note its failure mode is that all
workloads *stop*, so exhausting it takes the site down rather than degrading it. The
application-layer defences, not the spend limit, are what protect availability.

The dedupe counter and the daily budget live in process memory. This is a deliberate
reading of NFR-7 ("backend stateless — no filesystem state"): no filesystem is touched,
but the backend is no longer strictly stateless. **It is therefore only correct while
the backend runs as a single instance.** Adding a second Railway replica silently halves
the effectiveness of both the dedupe and the budget, with no error to warn us. Scaling
out requires moving this state to a shared store first.
