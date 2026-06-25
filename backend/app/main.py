from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from app.config import UPLOADS_DIR
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.logging import LoggingMiddleware
from app.exceptions import AppError
from app.logger import logger


# New MVP routers
from app.routers import auth as auth_router
from app.routers import classes as classes_router
from app.routers import assignments as assignments_router
from app.routers import submissions_v2 as submissions_v2_router
from app.routers import grading_v2 as grading_v2_router
from app.routers import plagiarism_router
from app.routers import rubrics as rubrics_router
from app.routers import feedbacks as feedbacks_router
from app.routers import questions as questions_router
from app.routers import ws as ws_router
from app.routers import quick_grading as quick_grading_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(
    title="AI Assignment Marking System - Phạm Tiến Đạt",
    description="Hệ thống chấm bài tự động theo rubric + kiểm tra đạo văn",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
CORS_ORIGINS_ENV = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000")
CORS_ORIGINS = [origin.strip() for origin in CORS_ORIGINS_ENV.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)

# Rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Logging middleware (outermost)
app.add_middleware(LoggingMiddleware)


# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

@app.exception_handler(AppError)
async def app_error_handler(request, exc: AppError):
    logger.error(f"AppError handler: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# ── New MVP endpoints ──
app.include_router(auth_router.router, prefix="/api")
app.include_router(classes_router.router, prefix="/api")
app.include_router(assignments_router.router, prefix="/api")
app.include_router(submissions_v2_router.router, prefix="/api")
app.include_router(grading_v2_router.router, prefix="/api")
app.include_router(plagiarism_router.router, prefix="/api")
app.include_router(rubrics_router.router, prefix="/api")
app.include_router(feedbacks_router.router, prefix="/api")
app.include_router(questions_router.router, prefix="/api")
app.include_router(quick_grading_router.router, prefix="/api")
app.include_router(ws_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
