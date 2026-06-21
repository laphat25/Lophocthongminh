"""Feedbacks router: CRUD endpoints for anchored feedback items."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from app.storage import feedback_store, submission_store, grading_store
from app.auth import get_current_user, require_teacher
from app.services.feedback_anchoring import create_manual_feedback

router = APIRouter(tags=["feedbacks"])


# ── Request Models ──

class CreateFeedbackRequest(BaseModel):
    char_offset_start: int
    char_offset_end: int
    severity: str = "info"
    category: str = "other"
    criteria_id: str = ""
    comment: str
    suggested_fix: Optional[dict] = None


class UpdateFeedbackRequest(BaseModel):
    severity: Optional[str] = None
    category: Optional[str] = None
    comment: Optional[str] = None
    evidence: Optional[str] = None


# ── GET feedbacks for a submission ──

@router.get("/submissions/{submission_id}/feedbacks")
def get_feedbacks(
    submission_id: str,
    severity: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    criteria_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Get all feedbacks for a submission with optional filters."""
    sub = submission_store.get(submission_id)
    if not sub:
        raise HTTPException(404, "Không tìm thấy bài nộp")

    # Students can only see feedbacks for published grades
    if user["role"] == "student":
        if sub["student_id"] != user["id"]:
            raise HTTPException(403, "Không có quyền")
        grading = grading_store.get(submission_id)
        if not grading or grading.get("status") != "published":
            raise HTTPException(404, "Điểm chưa được công bố")

    # Get all feedbacks for this submission
    all_feedbacks = [
        fb for fb in feedback_store.values()
        if fb.get("submission_id") == submission_id
    ]

    # Apply filters
    if severity:
        all_feedbacks = [fb for fb in all_feedbacks if fb.get("severity") == severity]
    if category:
        all_feedbacks = [fb for fb in all_feedbacks if fb.get("category") == category]
    if status:
        all_feedbacks = [fb for fb in all_feedbacks if fb.get("status") == status]
    if criteria_id:
        all_feedbacks = [fb for fb in all_feedbacks if fb.get("criteria_id") == criteria_id]

    # Sort by position in text
    all_feedbacks.sort(key=lambda fb: fb.get("anchor", {}).get("char_offset_start", 0))

    # Build summary
    all_for_summary = [
        fb for fb in feedback_store.values()
        if fb.get("submission_id") == submission_id
    ]
    summary = {
        "error_count": sum(1 for fb in all_for_summary if fb.get("severity") == "error"),
        "warning_count": sum(1 for fb in all_for_summary if fb.get("severity") == "warning"),
        "info_count": sum(1 for fb in all_for_summary if fb.get("severity") == "info"),
        "praise_count": sum(1 for fb in all_for_summary if fb.get("severity") == "praise"),
        "resolved_count": sum(1 for fb in all_for_summary if fb.get("status") == "resolved"),
    }

    return {
        "feedbacks": all_feedbacks,
        "total": len(all_feedbacks),
        "summary": summary,
    }


# ── POST create manual feedback ──

@router.post("/submissions/{submission_id}/feedbacks")
def add_feedback(
    submission_id: str,
    req: CreateFeedbackRequest,
    teacher: dict = Depends(require_teacher),
):
    """Add a manual feedback (teacher-created)."""
    sub = submission_store.get(submission_id)
    if not sub:
        raise HTTPException(404, "Không tìm thấy bài nộp")

    content_text = sub.get("content_text", "")
    if not content_text:
        raise HTTPException(400, "Bài nộp không có nội dung text")

    if req.char_offset_start < 0 or req.char_offset_end > len(content_text):
        raise HTTPException(400, "Vị trí anchor không hợp lệ")

    feedback = create_manual_feedback(
        submission_text=content_text,
        submission_id=submission_id,
        char_offset_start=req.char_offset_start,
        char_offset_end=req.char_offset_end,
        severity=req.severity,
        category=req.category,
        comment=req.comment,
        criteria_id=req.criteria_id,
        suggested_fix=req.suggested_fix,
    )

    feedback_store.set(feedback["id"], feedback)
    return feedback


# ── GET single feedback ──

@router.get("/feedbacks/{feedback_id}")
def get_feedback(feedback_id: str, user: dict = Depends(get_current_user)):
    fb = feedback_store.get(feedback_id)
    if not fb:
        raise HTTPException(404, "Không tìm thấy feedback")
    return fb


# ── PUT update feedback ──

@router.put("/feedbacks/{feedback_id}")
def update_feedback(
    feedback_id: str,
    req: UpdateFeedbackRequest,
    teacher: dict = Depends(require_teacher),
):
    fb = feedback_store.get(feedback_id)
    if not fb:
        raise HTTPException(404, "Không tìm thấy feedback")

    now = datetime.now(timezone.utc).isoformat()

    if req.severity is not None:
        if req.severity in ("error", "warning", "info", "praise"):
            fb["severity"] = req.severity
    if req.category is not None:
        fb["category"] = req.category
    if req.comment is not None:
        fb["comment"] = req.comment
    if req.evidence is not None:
        fb["evidence"] = req.evidence

    fb["updated_at"] = now
    feedback_store.set(feedback_id, fb)
    return fb


# ── DELETE feedback ──

@router.delete("/feedbacks/{feedback_id}")
def delete_feedback(feedback_id: str, teacher: dict = Depends(require_teacher)):
    fb = feedback_store.get(feedback_id)
    if not fb:
        raise HTTPException(404, "Không tìm thấy feedback")
    feedback_store.delete(feedback_id)
    return {"message": "Đã xóa feedback"}


# ── PUT resolve feedback ──

@router.put("/feedbacks/{feedback_id}/resolve")
def resolve_feedback(feedback_id: str, teacher: dict = Depends(require_teacher)):
    fb = feedback_store.get(feedback_id)
    if not fb:
        raise HTTPException(404, "Không tìm thấy feedback")

    fb["status"] = "resolved"
    fb["updated_at"] = datetime.now(timezone.utc).isoformat()
    feedback_store.set(feedback_id, fb)
    return fb


# ── PUT dismiss feedback ──

@router.put("/feedbacks/{feedback_id}/dismiss")
def dismiss_feedback(feedback_id: str, teacher: dict = Depends(require_teacher)):
    fb = feedback_store.get(feedback_id)
    if not fb:
        raise HTTPException(404, "Không tìm thấy feedback")

    fb["status"] = "dismissed"
    fb["updated_at"] = datetime.now(timezone.utc).isoformat()
    feedback_store.set(feedback_id, fb)
    return fb


# ── PUT accept suggested fix ──

@router.put("/feedbacks/{feedback_id}/fix/accept")
def accept_fix(feedback_id: str, teacher: dict = Depends(require_teacher)):
    fb = feedback_store.get(feedback_id)
    if not fb:
        raise HTTPException(404, "Không tìm thấy feedback")

    if not fb.get("suggested_fix"):
        raise HTTPException(400, "Feedback này không có gợi ý sửa")

    fb["suggested_fix"]["fix_status"] = "accepted"
    fb["status"] = "accepted"
    fb["updated_at"] = datetime.now(timezone.utc).isoformat()
    feedback_store.set(feedback_id, fb)
    return fb


# ── PUT reject suggested fix ──

@router.put("/feedbacks/{feedback_id}/fix/reject")
def reject_fix(feedback_id: str, teacher: dict = Depends(require_teacher)):
    fb = feedback_store.get(feedback_id)
    if not fb:
        raise HTTPException(404, "Không tìm thấy feedback")

    if not fb.get("suggested_fix"):
        raise HTTPException(400, "Feedback này không có gợi ý sửa")

    fb["suggested_fix"]["fix_status"] = "rejected"
    fb["updated_at"] = datetime.now(timezone.utc).isoformat()
    feedback_store.set(feedback_id, fb)
    return fb
