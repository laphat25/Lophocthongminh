from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import UPLOADS_DIR



# New MVP routers
from app.routers import auth as auth_router
from app.routers import classes as classes_router
from app.routers import assignments as assignments_router
from app.routers import submissions_v2 as submissions_v2_router
from app.routers import grading_v2 as grading_v2_router
from app.routers import plagiarism_router
from app.routers import rubrics as rubrics_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="AI Assignment Marking System - Phạm Tiến Đạt",
    description="Hệ thống chấm bài tự động theo rubric + kiểm tra đạo văn",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")



# ── New MVP endpoints ──
app.include_router(auth_router.router, prefix="/api")
app.include_router(classes_router.router, prefix="/api")
app.include_router(assignments_router.router, prefix="/api")
app.include_router(submissions_v2_router.router, prefix="/api")
app.include_router(grading_v2_router.router, prefix="/api")
app.include_router(plagiarism_router.router, prefix="/api")
app.include_router(rubrics_router.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}

