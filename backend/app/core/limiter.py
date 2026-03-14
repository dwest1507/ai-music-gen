from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

def get_session_id_or_ip(request: Request) -> str:
    """Extract session_id from cookies, falling back to IP address."""
    session_id = request.cookies.get("session_id")
    if session_id:
        return f"session:{session_id}"
    return f"ip:{get_remote_address(request)}"

limiter = Limiter(key_func=get_session_id_or_ip)
