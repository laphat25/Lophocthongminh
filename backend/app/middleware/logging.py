import time
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from jose import jwt
from app.config import JWT_SECRET, JWT_ALGORITHM
from app.logger import logger, request_id_var, user_id_var

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)
            
        # 1. Generate unique request ID
        request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        
        # 2. Extract user ID from token if present
        user_id = ""
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                user_id = payload.get("sub", "")
            except Exception:
                pass

        # 3. Set context variables for logger
        request_id_token = request_id_var.set(request_id)
        user_id_token = user_id_var.set(user_id)

        start_time = time.time()
        logger.info(f"Incoming request: {request.method} {request.url.path}")

        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            logger.info(
                f"Request completed: {request.method} {request.url.path} "
                f"- Status: {response.status_code} - Duration: {process_time:.4f}s"
            )
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"Request failed: {request.method} {request.url.path} "
                f"- Error: {str(e)} - Duration: {process_time:.4f}s",
                exc_info=True
            )
            raise e
        finally:
            request_id_var.reset(request_id_token)
            user_id_var.reset(user_id_token)
