from slowapi import Limiter
from slowapi.util import get_remote_address

# Configure rate limiter
# We use get_remote_address as default key, but for generation we might want session_id
limiter = Limiter(key_func=get_remote_address)
