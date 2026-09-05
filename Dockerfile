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

# --proxy-headers with a permissive --forwarded-allow-ips is load-bearing, not
# incidental: the rate limiter keys on the client IP, and behind Railway's proxy
# the peer address is the proxy itself. Without trusting X-Forwarded-For every
# visitor would share one rate-limit bucket. Trusting any peer is safe here only
# because the container is reachable solely through Railway's edge, which sets
# the header itself.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
