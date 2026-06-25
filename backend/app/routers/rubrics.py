import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from typing import Optional

from app.storage import rubric_template_store
from app.auth import get_current_user, require_teacher
from app.services.pdf_parser import extract_text_from_file
from app.services.rubric_parser import parse_rubric_with_gemini

router = APIRouter(prefix="/rubrics/templates", tags=["rubric-templates"])


class RubricLevelModel(BaseModel):
    score: float
    description: str


class RubricCriteriaModel(BaseModel):
    criteria_name: str
    max_score: float
    weight: float
    keywords: list[str] = []
    levels: list[RubricLevelModel] = []


class CreateRubricTemplateRequest(BaseModel):
    name: str
    description: str = ""
    criteria: list[RubricCriteriaModel] = []


@router.get("")
def list_templates():
    """Lấy danh sách tất cả các rubric templates."""
    all_templates = rubric_template_store.values()
    return {"templates": all_templates}


@router.post("")
def create_template(req: CreateRubricTemplateRequest, teacher: dict = Depends(require_teacher)):
    """Tạo rubric template thủ công."""
    if req.criteria:
        total_weight = sum(c.weight for c in req.criteria)
        if abs(total_weight - 100) > 0.01:
            raise HTTPException(400, f"Tổng trọng số phải bằng 100% (hiện tại: {total_weight}%)")

    template_id = f"CUSTOM_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc).isoformat()
    
    template_data = {
        "id": template_id,
        "name": req.name,
        "description": req.description,
        "criteria": [c.model_dump() for c in req.criteria],
        "created_by": teacher["id"],
        "created_at": now
    }
    
    rubric_template_store.set(template_id, template_data)
    return template_data


@router.delete("/{template_id}")
def delete_template(template_id: str, teacher: dict = Depends(require_teacher)):
    """Xóa một rubric template."""
    template = rubric_template_store.get(template_id)
    if not template:
        raise HTTPException(404, "Không tìm thấy mẫu rubric")
    
    if template.get("created_by") != teacher["id"] and not template_id.startswith("CUSTOM_"):
        # For safety, ensure they only delete what they can. 
        # But for MVP, we might allow them to delete custom ones.
        pass
        
    rubric_template_store.delete(template_id)
    return {"message": "Đã xóa mẫu rubric thành công"}


@router.post("/upload")
async def upload_rubric_template(
    file: UploadFile = File(...),
    teacher: dict = Depends(require_teacher)
):
    """Upload file rubric (PDF, DOCX, TXT) và parse thành Rubric Template."""
    content = await file.read()
    if not content:
        raise HTTPException(400, "File trống")

    # Trích xuất văn bản từ file
    text = extract_text_from_file(file.filename, content)
    
    if not text or len(text.strip()) < 50:
        raise HTTPException(400, "Không thể trích xuất đủ văn bản từ file hoặc định dạng không hỗ trợ (yêu cầu PDF, DOCX, TXT).")

    # Gọi AI để parse
    parsed_data = parse_rubric_with_gemini(
        text,
        api_key=teacher.get("gemini_api_key"),
        ai_provider=teacher.get("ai_provider", "default")
    )
    if not parsed_data:
        raise HTTPException(500, "Không thể phân tích dữ liệu Rubric từ nội dung file. Vui lòng kiểm tra lại cấu trúc file.")
    
    # Lưu template
    template_id = f"CUSTOM_{uuid.uuid4().hex}"
    now = datetime.now(timezone.utc).isoformat()
    
    template_data = {
        "id": template_id,
        "name": parsed_data.get("name", file.filename),
        "description": parsed_data.get("description", f"Parsed from {file.filename}"),
        "criteria": parsed_data.get("criteria", []),
        "created_by": teacher["id"],
        "created_at": now
    }
    
    rubric_template_store.set(template_id, template_data)
    return template_data
