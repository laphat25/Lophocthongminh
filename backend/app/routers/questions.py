import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.storage import question_store
from app.auth import get_current_user, require_teacher

router = APIRouter(prefix="/questions", tags=["questions"])

class QuestionRequest(BaseModel):
    title: str
    topic: str
    difficulty: str = "medium"
    tags: list[str] = []
    content: str

@router.post("")
def create_question(req: QuestionRequest, teacher: dict = Depends(require_teacher)):
    question_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    question = {
        "id": question_id,
        "title": req.title,
        "topic": req.topic,
        "difficulty": req.difficulty,
        "tags": req.tags,
        "content": req.content,
        "created_by": teacher["id"],
        "created_by_name": teacher["full_name"],
        "created_at": now,
        "updated_at": now
    }
    question_store.set(question_id, question)
    return question

@router.get("")
def list_questions(skip: int = 0, limit: int = 50, user: dict = Depends(get_current_user)):
    # Teachers see all questions or questions they created.
    # Let's list all questions.
    all_questions = question_store.values()
    # Sort by created_at descending
    all_questions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    total = len(all_questions)
    paginated = all_questions[skip:skip+limit]
    return {"questions": paginated, "total": total, "skip": skip, "limit": limit}

@router.get("/{question_id}")
def get_question(question_id: str, user: dict = Depends(get_current_user)):
    q = question_store.get(question_id)
    if not q:
        raise HTTPException(404, "Không tìm thấy câu hỏi")
    return q

@router.put("/{question_id}")
def update_question(question_id: str, req: QuestionRequest, teacher: dict = Depends(require_teacher)):
    q = question_store.get(question_id)
    if not q:
        raise HTTPException(404, "Không tìm thấy câu hỏi")
    if q["created_by"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền chỉnh sửa câu hỏi này")
        
    q.update({
        "title": req.title,
        "topic": req.topic,
        "difficulty": req.difficulty,
        "tags": req.tags,
        "content": req.content,
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    question_store.set(question_id, q)
    return q

@router.delete("/{question_id}")
def delete_question(question_id: str, teacher: dict = Depends(require_teacher)):
    q = question_store.get(question_id)
    if not q:
        raise HTTPException(404, "Không tìm thấy câu hỏi")
    if q["created_by"] != teacher["id"]:
        raise HTTPException(403, "Không có quyền xóa câu hỏi này")
    question_store.delete(question_id)
    return {"message": "Đã xóa câu hỏi thành công"}
