from slowapi import Limiter
from slowapi.util import get_remote_address

# Keyed on the client IP, deliberately not on the `session_id` cookie.
#
# The cookie is generated with `secrets.token_urlsafe`, but it is *supplied by the
# client* on every request, which makes it an attacker-chosen bucket key: rotating
# the value mints a fresh allowance each time. That left both endpoints that spend
# money — `POST /api/generate`, which starts GPU inference, and `POST /api/warmup`,
# which wakes the GPU — effectively unlimited.
#
# Keying on IP costs some fairness on NAT-shared networks, where visitors behind
# one address share a budget. That is the right trade here: cost control outranks
# NAT fairness on a personal project with a hard monthly spend ceiling.
#
# This depends on the app seeing real client addresses. Behind Railway's proxy the
# peer address is the proxy itself, so uvicorn is run with --proxy-headers and
# trusts X-Forwarded-For (see the Dockerfile). Without that, every visitor would
# share a single bucket.
limiter = Limiter(key_func=get_remote_address)
