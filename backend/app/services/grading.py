import json
from typing import Optional
from google import genai
from google.genai import types
from pydantic import BaseModel
from app.config import GEMINI_API_KEY, GEMINI_MODEL, decrypt_api_key
from app.services.bm25_grading import _extract_highlights
from app.logger import logger


class CriterionEvaluation(BaseModel):
    criteria_id: str
    criteria_name: str
    selected_score: float
    selected_level_description: str
    comment: str


class RubricGradingResponse(BaseModel):
    evaluations: list[CriterionEvaluation]


class AnchorOutput(BaseModel):
    exact_quote: str
    prefix_context: str = ""
    suffix_context: str = ""
    paragraph_index: Optional[int] = None
    sentence_index: Optional[int] = None


class SuggestedFixOutput(BaseModel):
    original_text: str
    replacement_text: str
    explanation: str


class FeedbackOutput(BaseModel):
    anchor: AnchorOutput
    severity: str
    category: str
    criteria_id: Optional[str] = None
    comment: str
    evidence: str
    suggested_fix: Optional[SuggestedFixOutput] = None


class AnchoredGradingResponse(BaseModel):
    evaluations: list[CriterionEvaluation]
    anchored_feedbacks: list[FeedbackOutput]


def grade_by_rubric_gemini(submission_text: str, rubric: list[dict], api_key: Optional[str] = None) -> tuple[list[dict], list[dict]]:
    """
    Grade submission with rubric using Gemini.
    Returns (criteria_scores, raw_anchored_feedbacks).
    """
    effective_api_key = decrypt_api_key(api_key) if api_key else ""
    if not effective_api_key or not effective_api_key.strip():
        raise RuntimeError("Gemini API key is not configured. Vui lòng cấu hình API key trong cài đặt tài khoản giảng viên.")

    if not rubric:
        return [], []

    client = genai.Client(
        api_key=effective_api_key,
        http_options=types.HttpOptions(timeout=120_000)
    )

    # Format the rubric criteria to present to the model
    rubric_str = ""
    criteria_ids = []
    for c in rubric:
        cid = c.get('criteria_id', '')
        criteria_ids.append(cid)
        rubric_str += f"- Tiêu chí: {c.get('criteria_name')} (ID: {cid}, Điểm tối đa: {c.get('max_score')}, Trọng số: {c.get('weight')}%)\n"
        rubric_str += "  Các mức điểm:\n"
        for lv in c.get("levels", []):
            rubric_str += f"    * {lv.get('score')} điểm: {lv.get('description')}\n"
        if c.get("keywords"):
            rubric_str += f"  Từ khóa: {', '.join(c.get('keywords'))}\n"
        rubric_str += "\n"

    prompt = f"""Bạn là một trợ lý AI chấm bài chuyên nghiệp. Nhiệm vụ của bạn gồm 2 phần:

## PHẦN 1: Chấm điểm theo Rubric
Chấm bài nộp của sinh viên dựa trên Rubric. Với mỗi tiêu chí:
1. Chọn mức điểm phù hợp nhất (MUST là một trong các mức có sẵn).
2. Viết nhận xét ngắn gọn giải thích tại sao chọn mức điểm đó (tiếng Việt).

## PHẦN 2: Phân tích chi tiết và tạo Anchored Feedbacks
Phân tích bài làm và tạo danh sách nhận xét CỤ THỂ, mỗi nhận xét PHẢI gắn với một đoạn text chính xác trong bài.

Với MỖI lỗi hoặc điểm cần cải thiện:
1. **exact_quote**: Trích dẫn CHÍNH XÁC đoạn text từ bài làm (copy nguyên văn, KHÔNG paraphrase)
2. **prefix_context**: ~30 ký tự ngay TRƯỚC đoạn lỗi
3. **suffix_context**: ~30 ký tự ngay SAU đoạn lỗi
4. **paragraph_index**: Chỉ số paragraph (đếm từ 0, paragraph = chia bởi dòng trống)
5. **severity**: error (sai), warning (cần cải thiện), info (gợi ý), praise (khen)
6. **category**: grammar | logic | structure | citation | clarity | completeness | originality | style | code_bug | other
7. **criteria_id**: ID tiêu chí liên quan (một trong: {', '.join(criteria_ids)}) hoặc null
8. **comment**: Nhận xét chi tiết bằng tiếng Việt
9. **evidence**: Bằng chứng/lý do đánh dấu
10. **suggested_fix**: Đề xuất cách sửa cụ thể (nếu có thể)

LƯU Ý QUAN TRỌNG:
- exact_quote PHẢI là copy chính xác từ bài làm, KHÔNG ĐƯỢC paraphrase hay chỉnh sửa
- Tối đa 15 feedbacks, ưu tiên lỗi quan trọng
- Bao gồm ít nhất 1-2 nhận xét tích cực (praise) nếu bài làm có điểm tốt

[Nội dung bài làm của sinh viên]:
{submission_text}

[Danh sách Tiêu chí chấm điểm (Rubric)]:
{rubric_str}
"""

    import time
    max_retries = 3
    delay = 2
    response = None
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=AnchoredGradingResponse,
                    temperature=0.2,
                ),
            )
            break
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            logger.warning(f"Gemini API attempt {attempt + 1} failed: {e}. Retrying in {delay} seconds...")
            time.sleep(delay)
            delay *= 2

    try:
        data = json.loads(response.text)
        eval_list = data.get("evaluations", [])
        eval_map = {e["criteria_id"]: e for e in eval_list}
        raw_feedbacks = data.get("anchored_feedbacks", [])
    except Exception as e:
        logger.error(f"Error parsing Gemini response: {e}. Raw response: {response.text}")
        eval_map = {}
        raw_feedbacks = []

    results = []
    for criteria in rubric:
        cid = criteria.get("criteria_id", "")
        levels = criteria.get("levels", [])
        first_level = levels[0] if levels else {"score": 0, "description": ""}
        
        # Default fallback
        ai_suggested_score = first_level.get("score", 0)
        ai_suggested_level = first_level.get("description", "")
        comment = ""

        # Map Gemini response if available
        if cid in eval_map:
            gemini_eval = eval_map[cid]
            ai_suggested_score = gemini_eval.get("selected_score", ai_suggested_score)
            ai_suggested_level = gemini_eval.get("selected_level_description", ai_suggested_level)
            comment = gemini_eval.get("comment", "")

        results.append({
            "criteria_id": cid,
            "criteria_name": criteria.get("criteria_name", ""),
            "ai_suggested_score": ai_suggested_score,
            "ai_suggested_level": ai_suggested_level,
            "final_score": ai_suggested_score,
            "max_score": criteria.get("max_score", 10),
            "weight": criteria.get("weight", 0),
            "teacher_comment": comment,
            "highlighted_text": _extract_highlights(submission_text, criteria.get("keywords", [])),
        })

    # Convert raw_feedbacks to dict format for downstream processing
    feedbacks_dicts = []
    for fb in raw_feedbacks:
        if isinstance(fb, dict):
            feedbacks_dicts.append(fb)
        else:
            feedbacks_dicts.append(fb.model_dump() if hasattr(fb, 'model_dump') else dict(fb))

    return results, feedbacks_dicts

