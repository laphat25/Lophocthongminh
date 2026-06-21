"""Auth router: register, login."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi import HTTPException
from pydantic import BaseModel
from app.storage import user_store
from app.auth import hash_password, verify_password, create_access_token, get_current_user, require_teacher
from app.config import encrypt_api_key, decrypt_api_key

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


def make_safe_user(user: dict) -> dict:
    safe = {k: v for k, v in user.items() if k not in ("password_hash", "gemini_api_key")}
    raw_key = decrypt_api_key(user.get("gemini_api_key", ""))
    safe["has_gemini_key"] = bool(raw_key.strip() and (raw_key.startswith("AIzaSy") or raw_key.startswith("AQ.")))
    return safe


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
    return AuthResponse(access_token=token, user=make_safe_user(user))


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
    return AuthResponse(access_token=token, user=make_safe_user(user))


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return make_safe_user(user)


class UpdateSettingsRequest(BaseModel):
    gemini_api_key: str = ""


@router.put("/settings")
def update_settings(req: UpdateSettingsRequest, user: dict = Depends(get_current_user)):
    raw_key = req.gemini_api_key.strip()
    user["gemini_api_key"] = encrypt_api_key(raw_key) if raw_key else ""
    user["updated_at"] = datetime.now(timezone.utc).isoformat()
    user_store.set(user["id"], user)
    return {
        "message": "Cập nhật cài đặt thành công",
        "user": make_safe_user(user),
    }


class ResetPasswordRequest(BaseModel):
    new_password: str


@router.post("/users/{user_id}/reset-password")
def reset_student_password(
    user_id: str,
    req: ResetPasswordRequest,
    teacher: dict = Depends(require_teacher)
):
    target_user = user_store.get(user_id)
    if not target_user:
        raise HTTPException(404, "Không tìm thấy người dùng")
    if target_user["role"] != "student":
        raise HTTPException(403, "Chỉ có thể đặt lại mật khẩu cho sinh viên")
    
    target_user["password_hash"] = hash_password(req.new_password)
    target_user["updated_at"] = datetime.now(timezone.utc).isoformat()
    user_store.set(user_id, target_user)
    return {"message": f"Đặt lại mật khẩu thành công cho sinh viên {target_user['full_name']}"}
