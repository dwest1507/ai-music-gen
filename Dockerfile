FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

# Security: Run as non-root user
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy requirements from backend directory
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/ .

# Security: Switch to non-root user
USER appuser

# The rate limiter keys on the client IP, and behind Railway's proxy the peer
# address is the proxy itself, so X-Forwarded-For has to be trusted for visitors
# not to share one bucket. It is trusted by *range*, never with "*": under
# --forwarded-allow-ips "*" uvicorn takes the LEFTMOST X-Forwarded-For entry,
# and Railway's edge appends rather than replaces, so a client-sent header lands
# leftmost and becomes the rate-limit key — reinstating the very bypass that
# moving the key off the session cookie closed. Given an explicit range, uvicorn
# instead walks the list from the right and takes the first address outside it:
# the one Railway appended, which the client cannot forge. The default below is
# the private space Railway's edge occupies; override it for another host.
ENV FORWARDED_ALLOW_IPS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,100.64.0.0/10,127.0.0.1,::1"

# Shell form so FORWARDED_ALLOW_IPS is expanded, and exec so uvicorn keeps PID 1
# and still receives the platform's stop signal.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips \"$FORWARDED_ALLOW_IPS\""]
