"""Auth router: register, login."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi import HTTPException
from pydantic import BaseModel
from app.storage import user_store
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "student"
    student_id: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    if req.role not in ("teacher", "student"):
        raise HTTPException(400, "Role phải là 'teacher' hoặc 'student'")
    existing = user_store.find_one(email=req.email)
    if existing:
        raise HTTPException(400, "Email đã được đăng ký")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user = {
        "id": user_id,
        "email": req.email,
        "password_hash": hash_password(req.password),
        "full_name": req.full_name,
        "role": req.role,
        "student_id": req.student_id,
        "is_active": True,
        "created_at": now,
        "updated_at": now,
    }
    user_store.set(user_id, user)
    token = create_access_token({"sub": user_id, "role": req.role})
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return AuthResponse(access_token=token, user=safe_user)


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    user = user_store.find_one(email=req.email)
    if not user:
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    if not user.get("is_active", True):
        raise HTTPException(401, "Tài khoản bị khóa")
    if not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")

    token = create_access_token({"sub": user["id"], "role": user["role"]})
    safe_user = {k: v for k, v in user.items() if k != "password_hash"}
    return AuthResponse(access_token=token, user=safe_user)


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return {k: v for k, v in user.items() if k != "password_hash"}


class UpdateSettingsRequest(BaseModel):
    gemini_api_key: str = ""


@router.put("/settings")
def update_settings(req: UpdateSettingsRequest, user: dict = Depends(get_current_user)):
    user["gemini_api_key"] = req.gemini_api_key.strip()
    user["updated_at"] = datetime.now(timezone.utc).isoformat()
    user_store.set(user["id"], user)
    return {
        "message": "Cập nhật cài đặt thành công",
        "user": {k: v for k, v in user.items() if k != "password_hash"},
    }
