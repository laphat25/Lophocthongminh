"""Auth router: register, login."""
import uuid
import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from fastapi import HTTPException
from pydantic import BaseModel
from app.storage import user_store
from app.auth import hash_password, verify_password, create_access_token, get_current_user, require_teacher
from app.config import encrypt_api_key, decrypt_api_key
from app.exceptions import ValidationError

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
    safe["ai_provider"] = user.get("ai_provider", "default")
    return safe


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    if req.role not in ("teacher", "student"):
        raise ValidationError("Role phải là 'teacher' hoặc 'student'")
    
    # Email format validation
    email_regex = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    if not re.match(email_regex, req.email):
        raise ValidationError("Định dạng email không hợp lệ")

    # Password strength validation
    if len(req.password) < 6:
        raise ValidationError("Mật khẩu phải có ít nhất 6 ký tự")

    existing = user_store.find_one(email=req.email)
    if existing:
        raise ValidationError("Email đã được đăng ký")

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

    # Clear Gemini API key and reset provider to default on new login session
    user["gemini_api_key"] = ""
    user["ai_provider"] = "default"
    user["updated_at"] = datetime.now(timezone.utc).isoformat()
    user_store.set(user["id"], user)

    token = create_access_token({"sub": user["id"], "role": user["role"]})
    return AuthResponse(access_token=token, user=make_safe_user(user))


@router.post("/logout")
def logout(user: dict = Depends(get_current_user)):
    # Clear Gemini API key and reset provider to default on explicit logout
    user["gemini_api_key"] = ""
    user["ai_provider"] = "default"
    user["updated_at"] = datetime.now(timezone.utc).isoformat()
    user_store.set(user["id"], user)
    return {"message": "Đăng xuất thành công"}


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    return make_safe_user(user)


class UpdateSettingsRequest(BaseModel):
    gemini_api_key: str = ""
    ai_provider: str = "default"


@router.put("/settings")
def update_settings(req: UpdateSettingsRequest, user: dict = Depends(get_current_user)):
    raw_key = req.gemini_api_key.strip()
    
    if req.ai_provider == "gemini":
        # Check if they have an existing key or a new key is provided
        existing_key = decrypt_api_key(user.get("gemini_api_key", ""))
        effective_key = raw_key if raw_key else existing_key
        
        if not effective_key or not effective_key.strip():
            raise HTTPException(400, "Vui lòng nhập Gemini API Key khi chọn nhà cung cấp Gemini.")
        
        if raw_key: # If new key is provided, validate it
            if not (raw_key.startswith("AIzaSy") or raw_key.startswith("AQ.")):
                raise HTTPException(400, "Gemini API Key không hợp lệ. Khóa API phải bắt đầu bằng 'AIzaSy' hoặc 'AQ.'.")
            if len(raw_key) < 20:
                raise HTTPException(400, "Gemini API Key quá ngắn. Vui lòng kiểm tra lại khóa API của bạn.")
            user["gemini_api_key"] = encrypt_api_key(raw_key)
    else:
        # For default provider, if they provided a key, we save it, otherwise keep existing
        if raw_key:
            if not (raw_key.startswith("AIzaSy") or raw_key.startswith("AQ.")):
                raise HTTPException(400, "Gemini API Key không hợp lệ. Khóa API phải bắt đầu bằng 'AIzaSy' hoặc 'AQ.'.")
            if len(raw_key) < 20:
                raise HTTPException(400, "Gemini API Key quá ngắn. Vui lòng kiểm tra lại khóa API của bạn.")
            user["gemini_api_key"] = encrypt_api_key(raw_key)

    user["ai_provider"] = req.ai_provider
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
