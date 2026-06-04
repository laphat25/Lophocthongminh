"""Submissions router (v2): submit text/file, list, get."""
import uuid
import re
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from app.storage import submission_store, assignment_store, enrollment_store, user_store
from app.auth import get_current_user, require_teacher
from app.services.pdf_parser import extract_text_from_file
from app.services.plagiarism import check_plagiarism
from app.config import UPLOADS_DIR

router = APIRouter(tags=["submissions_v2"])


class TextSubmitRequest(BaseModel):
    assignment_id: str
    content_text: str


def _word_count(text: str) -> int:
    return len(re.findall(r"\S+", text))


def _can_submit(assignment: dict, student_id: str) -> None:
    """Raise if submission not allowed."""
    if assignment["status"] != "published":
        raise HTTPException(400, "Đề bài chưa được phát hành hoặc đã đóng")
    deadline = assignment.get("deadline")
    if deadline:
        try:
            dl = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
            if dl.tzinfo is None:
                dl = dl.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > dl:
                raise HTTPException(400, "Đã quá hạn nộp bài")
        except ValueError:
            pass
    existing = submission_store.find_one(assignment_id=assignment["id"], student_id=student_id)
    if existing and not assignment.get("allow_resubmit", False):
        raise HTTPException(400, "Bạn đã nộp bài cho đề bài này. Giảng viên không cho phép nộp lại.")


def _get_student_name(student_id: str) -> str:
    user = user_store.get(student_id)
    return user["full_name"] if user else student_id


def _plagiarism_check(new_text: str, assignment_id: str, exclude_student_id: str) -> float:
    others = [
        s["content_text"] for s in submission_store.values()
        if s["assignment_id"] == assignment_id
        and s["student_id"] != exclude_student_id
        and s.get("content_text")
    ]
    return check_plagiarism(new_text, others)


# ----- TEXT SUBMISSION -----

@router.post("/assignments/{assignment_id}/submit/text")
def submit_text(
    assignment_id: str,
    req: TextSubmitRequest,
    student: dict = Depends(get_current_user),
):
    if student["role"] == "teacher":
        raise HTTPException(400, "Giảng viên không nộp bài")
    assignment = assignment_store.get(assignment_id)
    if not assignment:
        raise HTTPException(404, "Không tìm thấy đề bài")
    _can_submit(assignment, student["id"])

    if assignment.get("submission_type") == "file":
        raise HTTPException(400, "Đề bài này yêu cầu nộp file")

    # Check existing → version
    existing = submission_store.find_one(assignment_id=assignment_id, student_id=student["id"])
    version = (existing.get("version", 0) + 1) if existing else 1
    sub_id = existing["id"] if existing else str(uuid.uuid4())

    plag_score = _plagiarism_check(req.content_text, assignment_id, student["id"])

    submission = {
        "id": sub_id,
        "assignment_id": assignment_id,
        "student_id": student["id"],
        "student_name": student["full_name"],
        "version": version,
        "content_text": req.content_text,
        "file_url": None,
        "file_name": None,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "submitted",
        "word_count": _word_count(req.content_text),
        "plagiarism_score": round(plag_score, 2),
        "plagiarism_flagged": plag_score >= 40.0,
    }
    submission_store.set(sub_id, submission)
    return submission


# ----- FILE SUBMISSION -----

@router.post("/assignments/{assignment_id}/submit/file")
async def submit_file(
    assignment_id: str,
    file: UploadFile = File(...),
    student: dict = Depends(get_current_user),
):
    if student["role"] == "teacher":
        raise HTTPException(400, "Giảng viên không nộp bài")
    assignment = assignment_store.get(assignment_id)
    if not assignment:
        raise HTTPException(404, "Không tìm thấy đề bài")
    _can_submit(assignment, student["id"])

    if assignment.get("submission_type") == "text":
        raise HTTPException(400, "Đề bài này chỉ nhận bài dạng văn bản")

    allowed_exts = {".pdf", ".docx", ".txt"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_exts:
        raise HTTPException(400, "Chỉ chấp nhận file PDF, DOCX hoặc TXT")

    data = await file.read()
    content_text = extract_text_from_file(file.filename or "", data)
    if not content_text.strip():
        raise HTTPException(400, "Không trích xuất được nội dung từ file")

    # Save file
    safe_name = f"{student['id']}_{assignment_id}{ext}"
    save_path = UPLOADS_DIR / safe_name
    with open(save_path, "wb") as f_out:
        f_out.write(data)

    existing = submission_store.find_one(assignment_id=assignment_id, student_id=student["id"])
    version = (existing.get("version", 0) + 1) if existing else 1
    sub_id = existing["id"] if existing else str(uuid.uuid4())

    plag_score = _plagiarism_check(content_text, assignment_id, student["id"])

    submission = {
        "id": sub_id,
        "assignment_id": assignment_id,
        "student_id": student["id"],
        "student_name": student["full_name"],
        "version": version,
        "content_text": content_text,
        "file_url": f"/uploads/{safe_name}",
        "file_name": file.filename,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "status": "submitted",
        "word_count": _word_count(content_text),
        "plagiarism_score": round(plag_score, 2),
        "plagiarism_flagged": plag_score >= 40.0,
    }
    submission_store.set(sub_id, submission)
    return submission


# ----- LIST / GET -----

@router.get("/assignments/{assignment_id}/submissions")
def list_submissions(assignment_id: str, teacher: dict = Depends(require_teacher)):
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")
    subs = [s for s in submission_store.values() if s["assignment_id"] == assignment_id]
    subs.sort(key=lambda s: s.get("submitted_at", ""), reverse=True)
    return {"submissions": subs, "total": len(subs)}


@router.get("/submissions/my")
def my_submissions(user: dict = Depends(get_current_user)):
    subs = submission_store.find(student_id=user["id"])
    subs.sort(key=lambda s: s.get("submitted_at", ""), reverse=True)
    return {"submissions": subs, "total": len(subs)}


@router.get("/submissions/{submission_id}")
def get_submission(submission_id: str, user: dict = Depends(get_current_user)):
    sub = submission_store.get(submission_id)
    if not sub:
        raise HTTPException(404, "Không tìm thấy bài nộp")
    # Students can only see their own
    if user["role"] == "student" and sub["student_id"] != user["id"]:
        raise HTTPException(403, "Không có quyền xem bài này")
    return sub
