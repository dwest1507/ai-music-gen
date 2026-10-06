---
status: accepted
---

# Run the GPU service as exactly one container

A Task can only be answered by the GPU container that accepted it. ACE-Step's
`/release_task` puts the job on an in-process queue and returns at once; a background
worker runs the inference, and `/query_result` reads the same in-process store. Nothing
is shared between containers.

The Modal deployment did not account for this, and a Task was lost in production. Modal
defaults to one HTTP request per container. During a Modal wake the `/release_task` call
is held open for minutes while `/health`, warmup calls and status polls queue behind it,
so the autoscaler booted an H100 for each waiting request. Four containers ran for one
song. Once the burst cleared, the app was overprovisioned, and Modal is allowed to stop
idle containers before `scaledown_window` elapses in that case. It counts only in-flight
requests as work, so it treated the container running the Task in its background worker
as idle and stopped it mid-inference. Every later poll reached a container with no such
Task. ACE-Step answers an unknown id with `status: 0, result: "[]"`, and the backend
read that as "processing", so the visitor waited out the full ten-minute timeout.

## Decision

- `modal_app.py` (the ACE-Step fork) sets `max_containers=1` and
  `@modal.concurrent(max_inputs=100)`. One container serves every request: a poll always
  reaches the store that holds the Task, and there are no surplus containers for the
  autoscaler to stop. ACE-Step's own job queue still runs GPU work one job at a time.
- The backend treats `status: 0, result: "[]"` as a lost Task and reports it as
  `failed`. A Task that ACE-Step does hold always has at least one result item, even
  while queued.

## Consequences

- Throughput is capped at one GPU. Concurrent visitors queue for it instead of each
  waking their own GPU. At this project's traffic and budget that trade is correct (see
  ADR 0001).
- **The backend's lost-Task check is only correct with a single container.** If a second
  container exists, a poll that reaches it fails a Task that is still running somewhere
  else. Scaling out requires moving Task state to a shared store first. This is the
  GPU-side counterpart of the single-instance caveat in ADR 0001.
- Deploy order matters. Deploy the Modal change before the backend change. If the backend
  ships first, polls that reach sibling containers start failing live Tasks.
- A Modal wake can outlast Modal's 150 s web-request limit, and Modal answers that with a
  303 to a URL that waits for the result. The backend's client did not follow redirects,
  so a long wake reached the visitor as a 502 while the request still ran on the GPU. It
  now follows them. Long wakes come from snapshot rebuilds, and those are frequent:
  snapshots are tied to the GPU type, and Modal may run a `gpu="H100"` request on an H200.
  A production test on 2026-10-06 saw consecutive cold starts land on an H200 and then an
  H100, and the second rebuilt its snapshot in about 6 minutes. The fork now pins
  `gpu="H100!"`, which halves the snapshots to build but cannot stop rebuilds: Modal
  still needs two or three per GPU type and recaptures them after every deploy.
- **The browser must never wait on a Modal wake in a single request.** Following the 303
  let the backend wait out a long wake, but Railway closes any request that sends no data
  for five minutes. On 2026-10-06 a five-and-a-half-minute rebuild outlasted that: the
  song was made, but the browser got Railway's error page, with no CORS header, instead of
  the task id. So the frontend now polls `GET /api/gpu-ready` before submitting. Each
  probe returns within the health check's ten seconds, and `/api/generate` goes out only
  once the GPU answers. Unlike `/api/warmup`, the probe asks the GPU every time and
  ignores the warm budget. Prewarm's dedupe would report a stale "cold", and a visitor
  who has asked for a song must not be blocked by a budget meant for speculative wakes.
  Following redirects stays as the safety net for a GPU that goes cold between the probe
  and the submit.
- A Task can still be lost if nothing polls for `scaledown_window` (300 s) while it runs,
  for example when the visitor closes the tab. Nobody is waiting for that Task, so the
  loss does not matter.
