"""Plagiarism router: check all submissions of an assignment."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from app.storage import submission_store, assignment_store, plagiarism_store, user_store
from app.auth import require_teacher
from app.services.plagiarism import compute_similarity_matrix

router = APIRouter(tags=["plagiarism"])


def _run_check(assignment_id: str, teacher_id: str):
    """Background task: compute similarity matrix."""
    subs = [
        s for s in submission_store.values()
        if s["assignment_id"] == assignment_id and s.get("content_text")
    ]
    if len(subs) < 2:
        pairs = []
    else:
        pairs = compute_similarity_matrix(subs)

    flagged = [p for p in pairs if p["flag"] != "ok"]
    max_sim = max((p["similarity_pct"] for p in pairs), default=0.0)

    report = {
        "id": assignment_id,
        "assignment_id": assignment_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "status": "completed",
        "pairs": pairs,
        "summary": {
            "total_submissions": len(subs),
            "total_pairs": len(pairs),
            "flagged_pairs": len(flagged),
            "severe_pairs": sum(1 for p in pairs if p["flag"] == "severe"),
            "max_similarity_pct": round(max_sim, 2),
        },
    }
    plagiarism_store.set(assignment_id, report)


@router.post("/assignments/{assignment_id}/plagiarism/check")
def trigger_plagiarism_check(
    assignment_id: str,
    background_tasks: BackgroundTasks,
    teacher: dict = Depends(require_teacher),
):
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")

    subs_count = sum(1 for s in submission_store.values() if s["assignment_id"] == assignment_id)
    if subs_count < 2:
        raise HTTPException(400, "Cần ít nhất 2 bài nộp để kiểm tra đạo văn")

    # Mark as pending immediately
    pending = plagiarism_store.get(assignment_id) or {}
    pending.update({
        "id": assignment_id,
        "assignment_id": assignment_id,
        "status": "pending",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })
    plagiarism_store.set(assignment_id, pending)

    background_tasks.add_task(_run_check, assignment_id, teacher["id"])
    return {"message": "Đang kiểm tra đạo văn...", "status": "pending"}


@router.get("/assignments/{assignment_id}/plagiarism/report")
def get_plagiarism_report(assignment_id: str, teacher: dict = Depends(require_teacher)):
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")
    report = plagiarism_store.get(assignment_id)
    if not report:
        raise HTTPException(404, "Chưa có báo cáo đạo văn. Vui lòng trigger kiểm tra trước.")
    return report


@router.get("/assignments/{assignment_id}/plagiarism/pair/{sub_a_id}/{sub_b_id}")
def get_pair_detail(
    assignment_id: str,
    sub_a_id: str,
    sub_b_id: str,
    teacher: dict = Depends(require_teacher),
):
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")
    sub_a = submission_store.get(sub_a_id)
    sub_b = submission_store.get(sub_b_id)
    if not sub_a or not sub_b:
        raise HTTPException(404, "Không tìm thấy bài nộp")

    report = plagiarism_store.get(assignment_id)
    pair_info = None
    if report:
        for pair in report.get("pairs", []):
            ids = {pair["submission_a"], pair["submission_b"]}
            if ids == {sub_a_id, sub_b_id}:
                pair_info = pair
                break

    return {
        "pair": pair_info,
        "submission_a": {
            "id": sub_a_id,
            "student_name": sub_a.get("student_name", ""),
            "content_text": sub_a.get("content_text", ""),
            "submitted_at": sub_a.get("submitted_at"),
        },
        "submission_b": {
            "id": sub_b_id,
            "student_name": sub_b.get("student_name", ""),
            "content_text": sub_b.get("content_text", ""),
            "submitted_at": sub_b.get("submitted_at"),
        },
    }
