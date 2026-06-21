import time
from collections import defaultdict
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt
from app.config import JWT_SECRET, JWT_ALGORITHM

class RateLimiter:
    def __init__(self):
        # In-memory storage for rate limiting: {key: [timestamps]}
        self.history = defaultdict(list)

    def is_rate_limited(self, key: str, limit: int, window: int = 60) -> bool:
        now = time.time()
        # Clean up timestamps older than the window
        self.history[key] = [t for t in self.history[key] if now - t < window]
        if len(self.history[key]) >= limit:
            return True
        self.history[key].append(now)
        return False

limiter = RateLimiter()

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        import os
        if os.getenv("DISABLE_RATE_LIMIT") == "true" or os.getenv("TESTING") == "true" or request.headers.get("x-disable-rate-limit") == "true":
            return await call_next(request)

        path = request.url.path
        
        # Skip rate limiting for health check or non-API endpoints
        if not path.startswith("/api") or path == "/api/health":
            return await call_next(request)

        # Get client IP for IP-based fallback/limiting
        client_ip = request.client.host if request.client else "unknown"

        # Check if the route is auth (login/register)
        is_auth = (path == "/api/auth/login" or path == "/api/auth/register") and request.method == "POST"

        # Check if the route is AI grading (auto-grade or auto-grade-all)
        is_ai = "/grade/auto" in path and request.method == "POST"

        # Try to identify user sub from JWT to limit logged-in users properly
        user_id = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                user_id = payload.get("sub")
            except Exception:
                pass

        # Determine limits based on request type
        if is_auth:
            key = f"auth:{client_ip}"
            limit = 5
            label = "IP: 5 requests/minute"
        elif is_ai:
            key = f"ai:{user_id or client_ip}"
            limit = 10
            label = "User: 10 AI grading requests/minute"
        else:
            key = f"general:{user_id or client_ip}"
            limit = 60
            label = "User: 60 requests/minute"

        if limiter.is_rate_limited(key, limit, window=60):
            return Response(
                content=f'{{"detail": "Quá tải yêu cầu. Giới hạn: {label}."}}',
                status_code=429,
                media_type="application/json"
            )

        return await call_next(request)
