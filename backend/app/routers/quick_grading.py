import os
import re
import uuid
import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from app.storage import (
    submission_store, class_store, enrollment_store,
    user_store, assignment_store, grading_store, feedback_store
)
from app.auth import require_teacher
from app.config import UPLOADS_DIR
from app.services.pdf_parser import extract_text_from_file
from app.services.plagiarism import run_assignment_plagiarism_check
from app.services.citation_verifier import verify_all_citations
from app.services.grading import execute_full_grading
from app.routers.ws import update_task_progress
from app.logger import logger
from app.utils.file_utils import sanitize_filename, validate_uploaded_file
from app.utils.helpers import generate_random_code

router = APIRouter(prefix="/assignments", tags=["quick_grading"])

def parse_student_info(filename: str) -> tuple[str, str]:
    """
    Extract student ID and student name from filename.
    Examples:
      - "20206012_NguyenVanA_BaiTap1.pdf" -> ID: "20206012", Name: "Nguyen Van A"
      - "NguyenVanA.docx" -> ID: "nguyenvana", Name: "Nguyen Van A"
    """
    name_without_ext = os.path.splitext(filename)[0]
    
    # Split by delimiters: space, underscore, dash
    parts = re.split(r'[\s_\-]+', name_without_ext)
    parts = [p.strip() for p in parts if p.strip()]
    
    student_id = ""
    student_name = ""
    
    # Pattern to match numeric or alphanumeric ID (typically 5 to 12 chars)
    if parts and re.match(r'^[a-zA-Z0-9]{5,12}$', parts[0]) and any(c.isdigit() for c in parts[0]):
        student_id = parts[0]
        name_parts = parts[1:]
        if name_parts:
            # Stop if we hit typical assignment-related keywords
            clean_name_parts = []
            for part in name_parts:
                if re.match(r'^(bai|tap|assignment|project|bt|de|thi|final|draft|copy|submission|baocao|report)', part, re.IGNORECASE):
                      break
                clean_name_parts.append(part)
            if clean_name_parts:
                student_name = " ".join(clean_name_parts)
            else:
                student_name = " ".join(name_parts)
        else:
            student_name = student_id
    else:
        # No obvious student ID, extract name and generate clean spacing
        clean_name_parts = []
        for part in parts:
            if re.match(r'^(bai|tap|assignment|project|bt|de|thi|final|draft|copy|submission|baocao|report)', part, re.IGNORECASE):
                  break
            clean_name_parts.append(part)
        if clean_name_parts:
            student_name = " ".join(clean_name_parts)
        else:
            student_name = " ".join(parts)
        
        # Split CamelCase/PascalCase if present to generate clean ID
        temp_name = re.sub(r'(?<!^)(?=[A-Z])', ' ', student_name)
        student_id = re.sub(r'[^a-zA-Z0-9]', '', temp_name).lower()[:12]
        if not student_id:
            student_id = str(uuid.uuid4())[:8]

    # Split CamelCase/PascalCase if present for the final name representation
    student_name = re.sub(r'(?<!^)(?=[A-Z])', ' ', student_name)
    # Clean spaces and capitalize words
    student_name = re.sub(r'\s+', ' ', student_name).strip()
    student_name = student_name.title()
    
    return student_id, student_name

async def _run_quick_grading_batch(
    assignment_id: str,
    teacher: dict,
    task_id: str,
    submission_ids: List[str]
):
    """Background task to perform plagiarism check, citation verification, and AI grading."""
    await update_task_progress(task_id, "running", 5.0, "Đang khởi tạo tiến trình chấm bài...")
    
    assignment = assignment_store.get(assignment_id)
    if not assignment:
        await update_task_progress(task_id, "failed", 0.0, "Không tìm thấy đề bài ảo", error="Không tìm thấy đề bài ảo")
        return

    rubric = assignment.get("rubric", [])
    total_subs = len(submission_ids)
    if total_subs == 0:
        await update_task_progress(task_id, "completed", 100.0, "Không có bài nộp nào để chấm")
        return

    graded_count = 0
    now = datetime.now(timezone.utc).isoformat()

    for i, sub_id in enumerate(submission_ids):
        sub = submission_store.get(sub_id)
        if not sub:
            continue

        student_name = sub.get("student_name", "Sinh viên")
        student_id = sub.get("student_id")
        content_text = sub.get("content_text", "")

        progress_pct = 5.0 + (i / total_subs) * 90.0
        await update_task_progress(
            task_id,
            "running",
            progress_pct,
            f"Đang phân tích bài {i + 1}/{total_subs} - Sinh viên: {student_name}..."
        )
        try:
            # 1. Plagiarism Check
            plag_score = run_assignment_plagiarism_check(content_text, assignment_id, student_id)
            
            # 2. Citation Verification
            citation_report = await verify_all_citations(content_text)
            
            # Set plagiarism and citation report on sub first
            sub["plagiarism_score"] = round(plag_score, 2)
            sub["plagiarism_flagged"] = plag_score >= 40.0
            sub["citation_report"] = citation_report

            # 3. AI Rubric Grading & feedback anchoring & status update
            execute_full_grading(
                sub,
                rubric,
                teacher,
                grading_store,
                feedback_store,
                submission_store
            )

            graded_count += 1
        except Exception as e:
            logger.error(f"Lỗi chấm bài tự động cho {student_name}: {e}")
            sub["status"] = "failed"
            submission_store.set(sub_id, sub)

    await update_task_progress(
        task_id,
        "completed",
        100.0,
        f"Hoàn tất chấm điểm tự động. Đã chấm thành công {graded_count}/{total_subs} bài nộp.",
        result={"graded_count": graded_count, "total_count": total_subs}
    )


@router.post("/quick-grade")
async def quick_grade(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    rubric: str = Form(...),
    title: str = Form(...),
    teacher: dict = Depends(require_teacher)
):
    if not files:
        raise HTTPException(400, "Vui lòng tải lên ít nhất một file bài làm")

    # 1. Parse and validate rubric
    try:
        rubric_data = json.loads(rubric)
    except Exception:
        raise HTTPException(400, "Định dạng Rubric không hợp lệ (yêu cầu chuỗi JSON)")

    total_weight = sum(float(c.get("weight", 0)) for c in rubric_data)
    if rubric_data and abs(total_weight - 100) > 0.01:
        raise HTTPException(400, f"Tổng trọng số phải bằng 100% (hiện tại: {total_weight}%)")

    # 2. Check or create default quick-grading class for this teacher
    cls = class_store.find_one(class_name="Lớp chấm nhanh", teacher_id=teacher["id"])
    if not cls:
        class_id = str(uuid.uuid4())
        # Generate unique class code
        for _ in range(10):
            code = generate_random_code()
            if not class_store.find_one(class_code=code):
                break
        cls = {
            "id": class_id,
            "class_name": "Lớp chấm nhanh",
            "subject": "Chấm nhanh",
            "class_code": code,
            "teacher_id": teacher["id"],
            "teacher_name": teacher["full_name"],
            "description": "Lớp học ảo tự động tạo cho tính năng chấm nhanh",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        class_store.set(class_id, cls)

    # 3. Create virtual assignment
    assignment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    serialized_rubric = []
    for c in rubric_data:
        serialized_rubric.append({
            "criteria_id": str(uuid.uuid4()),
            "criteria_name": c["criteria_name"],
            "max_score": float(c["max_score"]),
            "weight": float(c["weight"]),
            "keywords": c.get("keywords", []),
            "levels": [{"score": float(lv["score"]), "description": lv["description"]} for lv in c.get("levels", [])],
        })

    assignment = {
        "id": assignment_id,
        "class_id": cls["id"],
        "class_name": cls["class_name"],
        "teacher_id": teacher["id"],
        "teacher_name": teacher["full_name"],
        "title": title,
        "description": "Bài tập ảo tạo cho luồng chấm nhanh",
        "submission_type": "file",
        "allow_resubmit": False,
        "open_at": now,
        "deadline": None,
        "status": "published",
        "pass_threshold": 50.0,
        "rubric": serialized_rubric,
        "created_at": now,
        "updated_at": now,
    }
    assignment_store.set(assignment_id, assignment)

    # 4. Process uploads and create stub student submissions
    submission_ids = []
    for upload_file in files:
        filename = upload_file.filename or "file"
        file_data = await upload_file.read()
        validate_uploaded_file(file_data, filename)

        # Parse student info
        student_id, student_name = parse_student_info(filename)

        # Create stub student if not exists
        student_user = user_store.find_one(student_id=student_id)
        if not student_user:
            email = f"{student_id}@quickgrade.local"
            if user_store.find_one(email=email):
                email = f"{student_id}_{str(uuid.uuid4())[:4]}@quickgrade.local"
            
            student_user = {
                "id": str(uuid.uuid4()),
                "email": email,
                "password_hash": "",
                "full_name": student_name,
                "role": "student",
                "student_id": student_id,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
                "is_stub": True,
            }
            user_store.set(student_user["id"], student_user)

        # Enroll student
        enrollment = enrollment_store.find_one(class_id=cls["id"], student_id=student_user["id"])
        if not enrollment:
            enrollment = {
                "id": str(uuid.uuid4()),
                "class_id": cls["id"],
                "student_id": student_user["id"],
                "student_name": student_user["full_name"],
                "student_email": student_user["email"],
                "joined_at": now,
                "status": "active",
            }
            enrollment_store.add(enrollment)

        # Extract text content
        content_text = extract_text_from_file(filename, file_data)
        if not content_text.strip():
            raise HTTPException(400, f"Không trích xuất được nội dung văn bản từ tệp {filename}")

        # Save file to uploads directory
        safe_filename = sanitize_filename(filename)
        safe_name = f"{student_user['id']}_{assignment_id}_{safe_filename}"
        save_path = UPLOADS_DIR / safe_name
        with open(save_path, "wb") as f_out:
            f_out.write(file_data)

        # Create submission record
        sub_id = str(uuid.uuid4())
        submission = {
            "id": sub_id,
            "assignment_id": assignment_id,
            "student_id": student_user["id"],
            "student_name": student_user["full_name"],
            "version": 1,
            "content_text": content_text,
            "file_url": f"/uploads/{safe_name}",
            "file_name": safe_filename,
            "submitted_at": now,
            "status": "submitted",
            "word_count": len(re.findall(r"\S+", content_text)),
            "plagiarism_score": 0.0,
            "plagiarism_flagged": False,
            "citation_report": {"citations": []},
        }
        submission_store.set(sub_id, submission)
        submission_ids.append(sub_id)

    # 5. Start background task for batch grading
    task_id = f"quick_grade_{assignment_id}"
    await update_task_progress(task_id, "pending", 0.0, "Đang khởi tạo tiến trình chấm...")
    
    background_tasks.add_task(
        _run_quick_grading_batch,
        assignment_id,
        teacher,
        task_id,
        submission_ids
    )

    return {
        "message": "Đang tiến hành chấm bài tự động trong nền",
        "class_id": cls["id"],
        "assignment_id": assignment_id,
        "task_id": task_id
    }
