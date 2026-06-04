"""Assignments router: CRUD + rubric builder."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.storage import assignment_store, class_store, enrollment_store
from app.auth import get_current_user, require_teacher

router = APIRouter(prefix="/assignments", tags=["assignments"])


class RubricLevel(BaseModel):
    score: float
    description: str


class RubricCriteria(BaseModel):
    criteria_name: str
    max_score: float
    weight: float
    keywords: list[str] = []
    levels: list[RubricLevel] = []


class CreateAssignmentRequest(BaseModel):
    class_id: str
    title: str
    description: str = ""
    submission_type: str = "both"   # "text" | "file" | "both"
    allow_resubmit: bool = False
    open_at: Optional[str] = None
    deadline: Optional[str] = None
    pass_threshold: float = 50.0
    rubric: list[RubricCriteria] = []


class UpdateAssignmentRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    submission_type: Optional[str] = None
    allow_resubmit: Optional[bool] = None
    open_at: Optional[str] = None
    deadline: Optional[str] = None
    pass_threshold: Optional[float] = None
    rubric: Optional[list[RubricCriteria]] = None


def _serialize_rubric(rubric: list[RubricCriteria]) -> list[dict]:
    result = []
    for c in rubric:
        result.append({
            "criteria_id": str(uuid.uuid4()),
            "criteria_name": c.criteria_name,
            "max_score": c.max_score,
            "weight": c.weight,
            "keywords": c.keywords,
            "levels": [{"score": lv.score, "description": lv.description} for lv in c.levels],
        })
    return result


@router.post("")
def create_assignment(req: CreateAssignmentRequest, teacher: dict = Depends(require_teacher)):
    cls = class_store.get(req.class_id)
    if not cls:
        raise HTTPException(404, "Không tìm thấy lớp học")
    if cls["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không phải lớp của bạn")

    total_weight = sum(c.weight for c in req.rubric)
    if req.rubric and abs(total_weight - 100) > 0.01:
        raise HTTPException(400, f"Tổng trọng số phải bằng 100% (hiện tại: {total_weight}%)")

    assignment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    assignment = {
        "id": assignment_id,
        "class_id": req.class_id,
        "class_name": cls.get("class_name", ""),
        "teacher_id": teacher["id"],
        "teacher_name": teacher["full_name"],
        "title": req.title,
        "description": req.description,
        "submission_type": req.submission_type,
        "allow_resubmit": req.allow_resubmit,
        "open_at": req.open_at or now,
        "deadline": req.deadline,
        "status": "draft",
        "pass_threshold": req.pass_threshold,
        "rubric": _serialize_rubric(req.rubric),
        "created_at": now,
        "updated_at": now,
    }
    assignment_store.set(assignment_id, assignment)
    return assignment


@router.get("")
def list_assignments(class_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    all_assignments = assignment_store.values()
    role = user["role"]

    if role == "teacher":
        if class_id:
            result = [a for a in all_assignments if a["class_id"] == class_id and a["teacher_id"] == user["id"]]
        else:
            result = [a for a in all_assignments if a["teacher_id"] == user["id"]]
    else:
        # Student: only published assignments in enrolled classes
        enrollments = enrollment_store.find(student_id=user["id"], status="active")
        enrolled_class_ids = {e["class_id"] for e in enrollments}
        if class_id:
            enrolled_class_ids = enrolled_class_ids & {class_id}
        result = [
            a for a in all_assignments
            if a["class_id"] in enrolled_class_ids and a["status"] == "published"
        ]

    return {"assignments": result, "total": len(result)}


@router.get("/{assignment_id}")
def get_assignment(assignment_id: str, user: dict = Depends(get_current_user)):
    assignment = assignment_store.get(assignment_id)
    if not assignment:
        raise HTTPException(404, "Không tìm thấy đề bài")
    return assignment


@router.put("/{assignment_id}")
def update_assignment(
    assignment_id: str,
    req: UpdateAssignmentRequest,
    teacher: dict = Depends(require_teacher),
):
    assignment = assignment_store.get(assignment_id)
    if not assignment:
        raise HTTPException(404, "Không tìm thấy đề bài")
    if assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền chỉnh sửa")
    if assignment["status"] != "draft":
        raise HTTPException(400, "Chỉ có thể chỉnh sửa đề bài ở trạng thái draft")

    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    for field in ["title", "description", "submission_type", "allow_resubmit",
                  "open_at", "deadline", "pass_threshold"]:
        val = getattr(req, field, None)
        if val is not None:
            updates[field] = val
    if req.rubric is not None:
        total_weight = sum(c.weight for c in req.rubric)
        if req.rubric and abs(total_weight - 100) > 0.01:
            raise HTTPException(400, f"Tổng trọng số phải bằng 100% (hiện tại: {total_weight}%)")
        updates["rubric"] = _serialize_rubric(req.rubric)

    assignment.update(updates)
    assignment_store.set(assignment_id, assignment)
    return assignment


@router.patch("/{assignment_id}/publish")
def publish_assignment(assignment_id: str, teacher: dict = Depends(require_teacher)):
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")
    assignment["status"] = "published"
    assignment["updated_at"] = datetime.now(timezone.utc).isoformat()
    assignment_store.set(assignment_id, assignment)
    return {"message": "Đã phát hành đề bài", "status": "published"}


@router.patch("/{assignment_id}/close")
def close_assignment(assignment_id: str, teacher: dict = Depends(require_teacher)):
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")
    assignment["status"] = "closed"
    assignment["updated_at"] = datetime.now(timezone.utc).isoformat()
    assignment_store.set(assignment_id, assignment)
    return {"message": "Đã đóng đề bài", "status": "closed"}
