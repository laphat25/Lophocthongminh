"""Classes router: create, join, list students."""
import uuid
import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.storage import class_store, enrollment_store, user_store
from app.auth import get_current_user, require_teacher
from app.utils.helpers import generate_random_code
from app.exceptions import AppError

router = APIRouter(prefix="/classes", tags=["classes"])


class CreateClassRequest(BaseModel):
    class_name: str
    subject: str
    description: str = ""


class JoinClassRequest(BaseModel):
    class_code: str


@router.post("")
def create_class(req: CreateClassRequest, teacher: dict = Depends(require_teacher)):
    # Generate unique class_code
    code = None
    for _ in range(100):
        c = generate_random_code()
        if not class_store.find_one(class_code=c):
            code = c
            break
    if not code:
        raise AppError(500, "Không thể tạo mã lớp học duy nhất. Vui lòng thử lại.")

    class_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    cls = {
        "id": class_id,
        "class_name": req.class_name,
        "subject": req.subject,
        "class_code": code,
        "teacher_id": teacher["id"],
        "teacher_name": teacher["full_name"],
        "description": req.description,
        "is_active": True,
        "created_at": now,
    }
    class_store.set(class_id, cls)
    return cls


@router.get("")
def list_classes(skip: int = 0, limit: int = 50, user: dict = Depends(get_current_user)):
    role = user["role"]
    if role == "teacher":
        classes = class_store.find(teacher_id=user["id"])
    else:
        # student: find via enrollments
        enrollments = enrollment_store.find(student_id=user["id"], status="active")
        class_ids = {e["class_id"] for e in enrollments}
        classes = [c for c in class_store.values() if c["id"] in class_ids]
    
    total = len(classes)
    paginated = classes[skip:skip + limit]
    return {"classes": paginated, "total": total, "skip": skip, "limit": limit}


@router.get("/{class_id}")
def get_class(class_id: str, user: dict = Depends(get_current_user)):
    cls = class_store.get(class_id)
    if not cls:
        raise HTTPException(404, "Không tìm thấy lớp học")
    return cls


@router.post("/join")
def join_class(req: JoinClassRequest, student: dict = Depends(get_current_user)):
    if student["role"] == "teacher":
        raise HTTPException(400, "Giảng viên không cần tham gia lớp")
    cls = class_store.find_one(class_code=req.class_code.upper())
    if not cls:
        raise HTTPException(404, "Mã lớp không tồn tại")
    # Check already enrolled
    existing = enrollment_store.find_one(class_id=cls["id"], student_id=student["id"])
    if existing:
        if existing["status"] == "active":
            raise HTTPException(400, "Bạn đã tham gia lớp này rồi")
        # Re-activate
        enrollment_store.update_by_id(existing["id"], {"status": "active"})
        return {"message": "Đã tham gia lại lớp", "class": cls}

    enrollment = {
        "id": str(uuid.uuid4()),
        "class_id": cls["id"],
        "student_id": student["id"],
        "student_name": student["full_name"],
        "student_email": student["email"],
        "joined_at": datetime.now(timezone.utc).isoformat(),
        "status": "active",
    }
    enrollment_store.add(enrollment)
    return {"message": "Tham gia lớp thành công", "class": cls}


@router.get("/{class_id}/students")
def list_students(class_id: str, teacher: dict = Depends(require_teacher)):
    cls = class_store.get(class_id)
    if not cls:
        raise HTTPException(404, "Không tìm thấy lớp học")
    if cls["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền xem lớp này")
    enrollments = enrollment_store.find(class_id=class_id, status="active")
    return {"students": enrollments, "total": len(enrollments)}


@router.delete("/{class_id}/students/{student_id}")
def remove_student(class_id: str, student_id: str, teacher: dict = Depends(require_teacher)):
    cls = class_store.get(class_id)
    if not cls or cls["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")
    enrollment = enrollment_store.find_one(class_id=class_id, student_id=student_id)
    if not enrollment:
        raise HTTPException(404, "Sinh viên không trong lớp")
    enrollment_store.update_by_id(enrollment["id"], {"status": "removed"})
    return {"message": "Đã xóa sinh viên khỏi lớp"}


@router.delete("/{class_id}")
def delete_class(class_id: str, teacher: dict = Depends(require_teacher)):
    cls = class_store.get(class_id)
    if not cls:
        raise HTTPException(404, "Không tìm thấy lớp học")
    if cls["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền xóa lớp học này")
    class_store.delete(class_id)
    return {"message": "Đã xóa lớp học thành công"}

