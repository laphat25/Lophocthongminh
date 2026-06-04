import json
from typing import Optional
from google import genai
from google.genai import types
from pydantic import BaseModel
from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.rubric import load_rubric
from app.services.bm25_grading import _extract_highlights


def grade_submission(text: str) -> dict:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured in .env")

    client = genai.Client(
        api_key=GEMINI_API_KEY,
        http_options=types.HttpOptions(timeout=30_000)
    )

    import time
    max_retries = 3
    delay = 2
    response = None
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=f"Grade the following student submission:\n\n{text}",
                config=types.GenerateContentConfig(
                    system_instruction=load_rubric(),
                    response_mime_type="application/json",
                    temperature=0.3,
                ),
            )
            break
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            print(f"Gemini API attempt {attempt + 1} failed: {e}. Retrying in {delay} seconds...")
            time.sleep(delay)
            delay *= 2

    result = json.loads(response.text)

    score = int(result["score"])
    if score < 0:
        score = 0
    if score > 100:
        score = 100

    return {
        "score": score,
        "draft_feedback": str(result["draft_feedback"]),
    }


class CriterionEvaluation(BaseModel):
    criteria_id: str
    criteria_name: str
    selected_score: float
    selected_level_description: str
    comment: str


class RubricGradingResponse(BaseModel):
    evaluations: list[CriterionEvaluation]


def grade_by_rubric_gemini(submission_text: str, rubric: list[dict], api_key: Optional[str] = None) -> list[dict]:
    effective_api_key = api_key
    if not effective_api_key or not effective_api_key.strip() or not effective_api_key.startswith("AIzaSy"):
        effective_api_key = GEMINI_API_KEY
    if not effective_api_key:
        raise RuntimeError("Gemini API key is not configured. Vui lòng cấu hình API key trong cài đặt hoặc file .env")

    if not rubric:
        return []

    client = genai.Client(
        api_key=effective_api_key,
        http_options=types.HttpOptions(timeout=30_000)
    )

    # Format the rubric criteria to present to the model
    rubric_str = ""
    for c in rubric:
        rubric_str += f"- Tiêu chí: {c.get('criteria_name')} (ID: {c.get('criteria_id')}, Điểm tối đa: {c.get('max_score')}, Trọng số: {c.get('weight')}%)\n"
        rubric_str += "  Các mức điểm:\n"
        for lv in c.get("levels", []):
            rubric_str += f"    * {lv.get('score')} điểm: {lv.get('description')}\n"
        if c.get("keywords"):
            rubric_str += f"  Từ khóa: {', '.join(c.get('keywords'))}\n"
        rubric_str += "\n"

    prompt = f"""Bạn là một trợ lý AI chấm bài chuyên nghiệp. Nhiệm vụ của bạn là chấm bài nộp của sinh viên dựa trên bộ Tiêu chí chấm điểm (Rubric) được cung cấp dưới đây.

[Nội dung bài làm của sinh viên]:
{submission_text}

[Danh sách Tiêu chí chấm điểm (Rubric)]:
{rubric_str}

Hãy phân tích bài làm của sinh viên và chấm điểm cho từng tiêu chí trong Rubric.
Với mỗi tiêu chí:
1. Hãy tìm mức điểm phù hợp nhất dựa trên phần mô tả của các mức điểm trong Rubric. Điểm số được chọn MUST là một trong các mức điểm được định nghĩa trong Rubric cho tiêu chí đó (không tự ý chấm điểm khác ngoài các mức có sẵn).
2. Viết nhận xét ngắn gọn, mang tính xây dựng giải thích tại sao sinh viên nhận được mức điểm đó (nhận xét bằng tiếng Việt).
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
                    response_schema=RubricGradingResponse,
                    temperature=0.2,
                ),
            )
            break
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            print(f"Gemini API attempt {attempt + 1} failed: {e}. Retrying in {delay} seconds...")
            time.sleep(delay)
            delay *= 2


    try:
        data = json.loads(response.text)
        eval_list = data.get("evaluations", [])
        eval_map = {e["criteria_id"]: e for e in eval_list}
    except Exception as e:
        print(f"Error parsing Gemini response: {e}. Raw response: {response.text}")
        eval_map = {}

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

    return results
