"""Grading router (v2): BM25 rubric grading + teacher review."""
import io
import csv
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from app.storage import submission_store, assignment_store, grading_store, user_store, feedback_store
from app.auth import get_current_user, require_teacher
from app.services.bm25_grading import compute_total_score
from app.services.grading import execute_full_grading

router = APIRouter(tags=["grading"])


class CriteriaScoreUpdate(BaseModel):
    criteria_id: str
    final_score: float
    teacher_comment: str = ""


class SaveGradeRequest(BaseModel):
    criteria_scores: list[CriteriaScoreUpdate]
    overall_comment: str = ""


# ---- AUTO GRADE ----

@router.post("/submissions/{submission_id}/grade/auto")
def auto_grade(submission_id: str, teacher: dict = Depends(require_teacher)):
    sub = submission_store.get(submission_id)
    if not sub:
        raise HTTPException(404, "Không tìm thấy bài nộp")
    assignment = assignment_store.get(sub["assignment_id"])
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")

    rubric = assignment.get("rubric", [])
    if not rubric:
        raise HTTPException(400, "Đề bài chưa có rubric")

    try:
        result, validated_feedbacks = execute_full_grading(
            sub,
            rubric,
            teacher,
            grading_store,
            feedback_store,
            submission_store
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Lỗi gọi API chấm điểm: {str(e)}"
        )
    return result


# ---- GET GRADE ----

@router.get("/submissions/{submission_id}/grade")
def get_grade(submission_id: str, user: dict = Depends(get_current_user)):
    sub = submission_store.get(submission_id)
    if not sub:
        raise HTTPException(404, "Không tìm thấy bài nộp")
    if user["role"] == "student" and sub["student_id"] != user["id"]:
        raise HTTPException(403, "Không có quyền")

    grading = grading_store.get(submission_id)
    if not grading:
        if user["role"] == "student":
            raise HTTPException(404, "Bài nộp chưa được chấm")
        
        # For teachers, return metadata and empty/none grading so they can view/grade it.
        assignment = assignment_store.get(sub["assignment_id"])
        feedbacks = [
            fb for fb in feedback_store.values()
            if fb.get("submission_id") == submission_id
        ]
        feedbacks.sort(key=lambda fb: fb.get("anchor", {}).get("char_offset_start", 0))
        return {
            "grading": None,
            "submission": sub,
            "rubric": assignment.get("rubric", []) if assignment else [],
            "feedbacks": feedbacks,
        }

    # Students can only see published grades
    if user["role"] == "student" and grading.get("status") != "published":
        raise HTTPException(404, "Điểm chưa được công bố")

    assignment = assignment_store.get(sub["assignment_id"])

    # Get feedbacks for this submission
    feedbacks = [
        fb for fb in feedback_store.values()
        if fb.get("submission_id") == submission_id
    ]
    # Students should not see dismissed feedbacks
    if user["role"] == "student":
        feedbacks = [fb for fb in feedbacks if fb.get("status") != "dismissed"]
    feedbacks.sort(key=lambda fb: fb.get("anchor", {}).get("char_offset_start", 0))

    return {
        "grading": grading,
        "submission": sub,
        "rubric": assignment.get("rubric", []) if assignment else [],
        "feedbacks": feedbacks,
    }


# ---- SAVE / UPDATE GRADE ----

@router.put("/submissions/{submission_id}/grade")
def save_grade(
    submission_id: str,
    req: SaveGradeRequest,
    teacher: dict = Depends(require_teacher),
):
    sub = submission_store.get(submission_id)
    if not sub:
        raise HTTPException(404, "Không tìm thấy bài nộp")
    assignment = assignment_store.get(sub["assignment_id"])
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")

    grading = grading_store.get(submission_id)
    if not grading:
        raise HTTPException(400, "Chưa có kết quả chấm AI. Vui lòng chạy auto-grade trước.")

    # Apply teacher overrides
    score_map = {u.criteria_id: u for u in req.criteria_scores}
    for cs in grading["criteria_scores"]:
        if cs["criteria_id"] in score_map:
            upd = score_map[cs["criteria_id"]]
            cs["final_score"] = upd.final_score
            cs["teacher_comment"] = upd.teacher_comment

    grading["total_score"] = compute_total_score(grading["criteria_scores"])
    grading["overall_comment"] = req.overall_comment
    grading["graded_by"] = teacher["id"]
    grading["graded_at"] = datetime.now(timezone.utc).isoformat()
    grading["status"] = "graded"

    grading_store.set(submission_id, grading)
    sub["status"] = "graded"
    submission_store.set(submission_id, sub)
    return grading


# ---- PUBLISH GRADE ----

@router.post("/submissions/{submission_id}/grade/publish")
def publish_grade(submission_id: str, teacher: dict = Depends(require_teacher)):
    sub = submission_store.get(submission_id)
    if not sub:
        raise HTTPException(404, "Không tìm thấy bài nộp")
    assignment = assignment_store.get(sub["assignment_id"])
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")
    grading = grading_store.get(submission_id)
    if not grading:
        raise HTTPException(400, "Chưa có điểm để công bố")

    now = datetime.now(timezone.utc).isoformat()
    grading["published_at"] = now
    grading["status"] = "published"
    grading_store.set(submission_id, grading)
    sub["status"] = "published"
    submission_store.set(submission_id, sub)
    return {"message": "Đã công bố điểm", "published_at": now}


# ---- GRADES LIST (teacher) ----

@router.get("/assignments/{assignment_id}/grades")
def list_grades(
    assignment_id: str,
    skip: int = 0,
    limit: int = 50,
    teacher: dict = Depends(require_teacher)
):
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")

    subs = [s for s in submission_store.values() if s["assignment_id"] == assignment_id]
    rows = []
    for sub in subs:
        grading = grading_store.get(sub["id"])
        rows.append({
            "submission_id": sub["id"],
            "student_id": sub["student_id"],
            "student_name": sub.get("student_name", ""),
            "submitted_at": sub.get("submitted_at"),
            "status": sub.get("status"),
            "total_score": grading["total_score"] if grading else None,
            "criteria_scores": grading["criteria_scores"] if grading else [],
            "overall_comment": grading.get("overall_comment", "") if grading else "",
        })
    rows.sort(key=lambda r: (r["total_score"] or 0), reverse=True)

    scores = [r["total_score"] for r in rows if r["total_score"] is not None]
    stats = {}
    if scores:
        threshold = assignment.get("pass_threshold", 50)
        stats = {
            "count": len(scores),
            "avg": round(sum(scores) / len(scores), 2),
            "max": max(scores),
            "min": min(scores),
            "pass_count": sum(1 for s in scores if s >= threshold),
            "fail_count": sum(1 for s in scores if s < threshold),
        }
    
    total = len(rows)
    paginated = rows[skip:skip + limit]
    return {
        "grades": paginated,
        "total": total,
        "skip": skip,
        "limit": limit,
        "stats": stats,
        "rubric": assignment.get("rubric", [])
    }


# ---- EXPORT CSV ----

@router.get("/assignments/{assignment_id}/grades/export")
def export_grades(assignment_id: str, teacher: dict = Depends(require_teacher)):
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")

    subs = [s for s in submission_store.values() if s["assignment_id"] == assignment_id]
    rubric = assignment.get("rubric", [])
    criteria_names = [c["criteria_name"] for c in rubric]

    output = io.StringIO()
    writer = csv.writer(output)

    header = ["student_name", "student_id", "submitted_at", "total_score"] + criteria_names + ["overall_comment"]
    writer.writerow(header)

    for sub in subs:
        grading = grading_store.get(sub["id"])
        criteria_scores_map = {}
        overall = ""
        total = ""
        if grading:
            total = grading.get("total_score", "")
            overall = grading.get("overall_comment", "")
            for cs in grading.get("criteria_scores", []):
                criteria_scores_map[cs["criteria_name"]] = cs.get("final_score", "")
        row = [
            sub.get("student_name", ""),
            sub.get("student_id", ""),
            sub.get("submitted_at", ""),
            total,
        ] + [criteria_scores_map.get(n, "") for n in criteria_names] + [overall]
        writer.writerow(row)

    output.seek(0)
    filename = f"grades_{assignment_id[:8]}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---- BATCH AUTO GRADE ALL ----

async def _run_batch_grading(assignment_id: str, teacher_id: str, api_key: Optional[str], ai_provider: str, task_id: str):
    """Background task to grade all submissions with WebSocket updates."""
    from app.routers.ws import update_task_progress
    from app.logger import logger
    
    await update_task_progress(task_id, "running", 10.0, "Đang khởi tạo danh sách bài nộp cần chấm...")
    
    assignment = assignment_store.get(assignment_id)
    if not assignment:
        await update_task_progress(task_id, "failed", 0.0, "Không tìm thấy đề bài", error="Không tìm thấy đề bài")
        return

    rubric = assignment.get("rubric", [])
    subs = [
        s for s in submission_store.values()
        if s["assignment_id"] == assignment_id and s["status"] == "submitted"
    ]
    total_subs = len(subs)
    if total_subs == 0:
        await update_task_progress(task_id, "completed", 100.0, "Không có bài nộp nào mới ở trạng thái chưa chấm")
        return

    graded_count = 0
    now = datetime.now(timezone.utc).isoformat()
    
    for i, sub in enumerate(subs):
        progress_pct = 10.0 + (i / total_subs) * 80.0
        await update_task_progress(
            task_id,
            "running",
            progress_pct,
            f"Đang chấm bài {i + 1}/{total_subs} - Sinh viên: {sub.get('student_name', '')}"
        )
        
        try:
            teacher_mock = {
                "id": teacher_id,
                "gemini_api_key": api_key,
                "ai_provider": ai_provider
            }
            execute_full_grading(
                sub,
                rubric,
                teacher_mock,
                grading_store,
                feedback_store,
                submission_store
            )
            graded_count += 1
            
        except Exception as e:
            logger.error(f"Lỗi chấm bài tự động cho sinh viên {sub.get('student_name', '')}: {e}")
            # Keep going for other students in the batch
            
    await update_task_progress(
        task_id,
        "completed",
        100.0,
        f"Hoàn tất chấm điểm tự động. Đã chấm thành công {graded_count}/{total_subs} bài nộp.",
        result={"graded_count": graded_count, "total_count": total_subs}
    )


@router.post("/assignments/{assignment_id}/grade/auto-all")
async def auto_grade_all(
    assignment_id: str,
    background_tasks: BackgroundTasks,
    teacher: dict = Depends(require_teacher)
):
    """Auto-grade all submitted (ungraded) submissions for an assignment asynchronously."""
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")
    rubric = assignment.get("rubric", [])
    if not rubric:
        raise HTTPException(400, "Đề bài chưa có rubric")

    task_id = f"batch_grade_{assignment_id}"
    from app.routers.ws import update_task_progress
    await update_task_progress(task_id, "pending", 0.0, "Đang khởi tạo tiến trình chấm bài hàng loạt...")

    background_tasks.add_task(
        _run_batch_grading,
        assignment_id,
        teacher["id"],
        teacher.get("gemini_api_key"),
        teacher.get("ai_provider", "default"),
        task_id
    )

    return {
        "message": "Đang tiến hành chấm bài tự động toàn bộ lớp trong nền",
        "status": "pending",
        "task_id": task_id
    }


# ---- BATCH PUBLISH ALL GRADED ----

@router.post("/assignments/{assignment_id}/grade/publish-all")
def publish_grade_all(assignment_id: str, teacher: dict = Depends(require_teacher)):
    """Publish grades for all 'graded' submissions of an assignment."""
    assignment = assignment_store.get(assignment_id)
    if not assignment or assignment["teacher_id"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền")

    subs = [
        s for s in submission_store.values()
        if s["assignment_id"] == assignment_id and s["status"] == "graded"
    ]
    published_count = 0
    now = datetime.now(timezone.utc).isoformat()
    for sub in subs:
        grading = grading_store.get(sub["id"])
        if not grading:
            continue
        grading["published_at"] = now
        grading["status"] = "published"
        grading_store.set(sub["id"], grading)
        sub["status"] = "published"
        submission_store.set(sub["id"], sub)
        published_count += 1

    return {"message": f"Đã công bố {published_count} kết quả", "published_count": published_count}
