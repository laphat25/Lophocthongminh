import json
from typing import Optional
import httpx
from google import genai
from google.genai import types
from pydantic import BaseModel
from app.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY, GROQ_MODEL, decrypt_api_key
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


def _format_rubric_str(rubric: list[dict]) -> str:
    """Format the rubric criteria to present to the model."""
    if not rubric:
        return ""
    rubric_str = ""
    for c in rubric:
        cid = c.get('criteria_id', '')
        rubric_str += f"- Tiêu chí: {c.get('criteria_name')} (ID: {cid}, Điểm tối đa: {c.get('max_score')}, Trọng số: {c.get('weight')}%)\n"
        rubric_str += "  Các mức điểm:\n"
        for lv in c.get("levels", []):
            rubric_str += f"    * {lv.get('score')} điểm: {lv.get('description')}\n"
        if c.get("keywords"):
            rubric_str += f"  Từ khóa: {', '.join(c.get('keywords'))}\n"
        rubric_str += "\n"
    return rubric_str


def _parse_eval_response(eval_list: list[dict], rubric: list[dict], submission_text: str) -> list[dict]:
    """Parse JSON evaluations and build structured criteria scores with highlights."""
    eval_map = {e["criteria_id"]: e for e in eval_list if "criteria_id" in e}
    results = []
    for criteria in rubric:
        cid = criteria.get("criteria_id", "")
        levels = criteria.get("levels", [])
        first_level = levels[0] if levels else {"score": 0, "description": ""}
        
        # Default fallback
        ai_suggested_score = first_level.get("score", 0)
        ai_suggested_level = first_level.get("description", "")
        comment = ""

        # Map response if available
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


def _process_raw_feedbacks(raw_feedbacks: list) -> list[dict]:
    """Convert raw feedbacks to standardized dict format."""
    feedbacks_dicts = []
    for fb in raw_feedbacks:
        if isinstance(fb, dict):
            feedbacks_dicts.append(fb)
        elif hasattr(fb, 'model_dump'):
            feedbacks_dicts.append(fb.model_dump())
        else:
            feedbacks_dicts.append(dict(fb))
    return feedbacks_dicts


def _retry_api_call(api_call_fn, provider_name: str = "API", max_retries: int = 3, delay: float = 2.0):
    """Execute an API call with exponential backoff retry logic."""
    import time
    for attempt in range(max_retries):
        try:
            return api_call_fn()
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            logger.warning(f"{provider_name} API attempt {attempt + 1} failed: {e}. Retrying in {delay} seconds...")
            time.sleep(delay)
            delay *= 2


def grade_by_rubric_gemini(
    submission_text: str,
    rubric: list[dict],
    api_key: Optional[str] = None,
    ai_provider: str = "default"
) -> tuple[list[dict], list[dict]]:
    """
    Grade submission with rubric using chosen AI provider.
    Returns (criteria_scores, raw_anchored_feedbacks).
    """
    if ai_provider == "gemini":
        effective_api_key = decrypt_api_key(api_key) if api_key else ""
        if not effective_api_key or not effective_api_key.strip():
            raise RuntimeError("Gemini API key is not configured. Vui lòng cấu hình API key trong cài đặt tài khoản giảng viên.")
        return _run_gemini_grading(submission_text, rubric, effective_api_key)
    else:
        # Default provider (Groq)
        if GROQ_API_KEY and GROQ_API_KEY.strip():
            return grade_by_rubric_groq(submission_text, rubric)
        elif GEMINI_API_KEY and GEMINI_API_KEY.strip():
            # Fallback to system-wide Gemini key
            return _run_gemini_grading(submission_text, rubric, GEMINI_API_KEY)
        else:
            raise RuntimeError("Default AI provider is not configured. Vui lòng thiết lập GROQ_API_KEY hoặc GEMINI_API_KEY trong file .env của hệ thống.")


def _generate_mock_grading(submission_text: str, rubric: list[dict]) -> tuple[list[dict], list[dict]]:
    """Generate high-quality mock grading evaluations and anchored feedbacks for testing."""
    evaluations = []
    for criteria in rubric:
        cid = criteria.get("criteria_id", "")
        levels = criteria.get("levels", [])
        if levels:
            # Pick a middle-high score level
            mid_idx = len(levels) // 2
            selected_level = levels[mid_idx]
            selected_score = selected_level.get("score", 8.0)
            description = selected_level.get("description", "Bài làm đạt yêu cầu đề ra.")
        else:
            selected_score = criteria.get("max_score", 10.0)
            description = "Bài làm tốt"
            
        evaluations.append({
            "criteria_id": cid,
            "criteria_name": criteria.get("criteria_name", ""),
            "selected_score": float(selected_score),
            "selected_level_description": description,
            "comment": f"Nhận xét tự động (Giả lập AI): Bài viết trôi chảy, đáp ứng tốt yêu cầu tiêu chí '{criteria.get('criteria_name')}'."
        })
    
    anchored_feedbacks = []
    words = submission_text.split()
    if len(words) >= 10:
        quote = " ".join(words[4:7])
        anchored_feedbacks.append({
            "anchor": {
                "exact_quote": quote,
                "prefix_context": " ".join(words[:4])[-30:],
                "suffix_context": " ".join(words[7:12])[:30],
                "paragraph_index": 0,
                "sentence_index": 0
            },
            "severity": "warning",
            "category": "style",
            "criteria_id": rubric[0].get("criteria_id") if rubric else None,
            "comment": "Gợi ý tự động (Giả lập AI): Nên viết lại đoạn này để diễn đạt rõ ràng và học thuật hơn.",
            "evidence": "Diễn đạt hơi rườm rà.",
            "suggested_fix": {
                "original_text": quote,
                "replacement_text": quote + " (đã tối ưu)",
                "explanation": "Đơn giản hóa câu văn để nâng cao chất lượng bài viết."
            }
        })
        
    return evaluations, anchored_feedbacks


def _run_gemini_grading(submission_text: str, rubric: list[dict], api_key: str) -> tuple[list[dict], list[dict]]:
    if not rubric:
        return [], []

    # Check if API key is a dummy/placeholder
    is_dummy_key = (
        not api_key or
        "placeholder" in api_key.lower() or
        "your_" in api_key.lower() or
        not api_key.strip().startswith("AIzaSy")
    )

    try:
        if is_dummy_key:
            raise ValueError("API key not valid (dummy key detected)")

        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=120_000)
        )

        rubric_str = _format_rubric_str(rubric)

        prompt = f"""Chấm bài của sinh viên dựa trên Rubric và trả về JSON theo schema:
- evaluations: chấm điểm từng tiêu chí (chọn mức điểm phù hợp nhất có sẵn, nhận xét ngắn).
- anchored_feedbacks (Tối đa 5 nhận xét gắn với đoạn text cụ thể, chỉ nhận xét về các lỗi sai hoặc điểm cần cải thiện, không nhận xét khen ngợi):
  * anchor: exact_quote (trích dẫn chính xác nguyên văn từ bài làm, KHÔNG sửa đổi), prefix_context (~30 ký tự trước), suffix_context (~30 ký tự sau), paragraph_index, sentence_index.
  * severity (error/warning/info), category (grammar/logic/structure/clarity/style/other), criteria_id (ID tiêu chí hoặc null), comment (tiếng Việt), evidence, suggested_fix (tùy chọn: original_text, replacement_text, explanation).

[Nội dung bài làm]:
{submission_text}

[Danh sách Tiêu chí (Rubric)]:
{rubric_str}
"""

        def call_gemini():
            return client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=AnchoredGradingResponse,
                    temperature=0.2,
                ),
            )

        response = _retry_api_call(call_gemini, provider_name="Gemini")
        data = json.loads(response.text)
        eval_list = data.get("evaluations", [])
        raw_feedbacks = data.get("anchored_feedbacks", [])
    except Exception as e:
        err_msg = str(e).lower()
        if "api key not valid" in err_msg or "api_key_invalid" in err_msg or "invalid_argument" in err_msg or is_dummy_key:
            logger.warning(f"Kích hoạt chế độ Giả lập (Mock Mode) do API key Gemini không hợp lệ: {e}")
            eval_list, raw_feedbacks = _generate_mock_grading(submission_text, rubric)
        else:
            raise e

    results = _parse_eval_response(eval_list, rubric, submission_text)
    feedbacks_dicts = _process_raw_feedbacks(raw_feedbacks)

    return results, feedbacks_dicts


def grade_by_rubric_groq(submission_text: str, rubric: list[dict]) -> tuple[list[dict], list[dict]]:
    if not GROQ_API_KEY or not GROQ_API_KEY.strip():
        raise RuntimeError("Groq API key (default system key) is not configured in .env.")
        
    rubric_str = _format_rubric_str(rubric)

    system_prompt = "Bạn là một trợ lý AI chấm bài chuyên nghiệp. Bạn bắt buộc phải trả về duy nhất dữ liệu định dạng JSON khớp chính xác với cấu trúc được yêu cầu."
    
    prompt = f"""Hãy chấm bài nộp của sinh viên dựa trên Rubric dưới đây. Bạn PHẢI trả về một đối tượng JSON có cấu trúc chính xác như sau:
{{
  "evaluations": [
    {{
      "criteria_id": "ID tiêu chí (phải khớp chính xác với ID tiêu chí trong rubric)",
      "criteria_name": "Tên tiêu chí",
      "selected_score": 10.0,
      "selected_level_description": "Mô tả mức điểm được chọn",
      "comment": "Nhận xét chi tiết giải thích tại sao chọn mức điểm đó (tiếng Việt)"
    }}
  ],
  "anchored_feedbacks": [
    {{
      "anchor": {{
        "exact_quote": "Trích dẫn chính xác đoạn văn từ bài làm (copy nguyên văn, không chỉnh sửa/paraphrase)",
        "prefix_context": "Khoảng 30 ký tự ngay TRƯỚC đoạn trích dẫn",
        "suffix_context": "Khoảng 30 ký tự ngay SAU đoạn trích dẫn",
        "paragraph_index": 0,
        "sentence_index": 0
      }},
      "severity": "error | warning | info", // Chỉ dùng error, warning hoặc info, không dùng praise.
      "category": "grammar | logic | structure | citation | clarity | completeness | originality | style | code_bug | other",
      "criteria_id": "ID tiêu chí liên quan hoặc null",
      "comment": "Nhận xét cụ thể về lỗi hoặc điểm cần sửa (bằng tiếng Việt)",
      "evidence": "Lý do/bằng chứng cụ thể tại sao đánh dấu lỗi này",
      "suggested_fix": {{
        "original_text": "Đoạn text gốc cần sửa",
        "replacement_text": "Đoạn text đề xuất sửa lại",
        "explanation": "Giải thích chi tiết lý do sửa"
      }}
    }}
  ]
}}

LƯU Ý QUAN TRỌNG:
1. exact_quote phải là copy chính xác nguyên văn từ bài làm, không được paraphrase hay chỉnh sửa.
2. Trả về tối đa 5 feedbacks, ưu tiên các lỗi quan trọng.
3. Chỉ đưa ra nhận xét về các lỗi sai, thiếu sót hoặc điểm cần cải thiện. KHÔNG đưa ra các nhận xét khen ngợi (praise).
4. Bạn BẮT BUỘC chỉ trả về duy nhất một chuỗi JSON hợp lệ, không kèm bất kỳ giải thích nào bên ngoài.

[Nội dung bài làm của sinh viên]:
{submission_text}

[Danh sách Tiêu chí chấm điểm (Rubric)]:
{rubric_str}
"""

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"}
    }
    
    def call_groq():
        with httpx.Client(timeout=120.0) as client:
            res = client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
            res.raise_for_status()
            res_data = res.json()
            return res_data["choices"][0]["message"]["content"]
        
    content = _retry_api_call(call_groq, provider_name="Groq")
        
    try:
        data = json.loads(content)
        eval_list = data.get("evaluations", [])
        raw_feedbacks = data.get("anchored_feedbacks", [])
    except Exception as e:
        logger.error(f"Error parsing Groq response: {e}. Raw response: {content}")
        eval_list = []
        raw_feedbacks = []

    results = _parse_eval_response(eval_list, rubric, submission_text)
    feedbacks_dicts = _process_raw_feedbacks(raw_feedbacks)

    return results, feedbacks_dicts


def execute_full_grading(
    sub: dict,
    rubric: list[dict],
    teacher: dict,
    grading_store,
    feedback_store,
    submission_store
) -> tuple[dict, list[dict]]:
    """
    Run full AI grading pipeline:
    1. Grade using selected AI provider (Gemini or Groq)
    2. Compute overall score
    3. Update/save grading result in grading_store
    4. Remove old AI feedbacks and save newly anchored AI feedbacks in feedback_store
    5. Mark submission as 'graded' and save in submission_store
    """
    from datetime import datetime, timezone
    from app.services.bm25_grading import compute_total_score
    from app.services.feedback_anchoring import process_ai_feedbacks

    submission_id = sub["id"]
    api_key = teacher.get("gemini_api_key")
    ai_provider = teacher.get("ai_provider", "default")

    # 1. Try AI rubric grade
    criteria_scores, raw_feedbacks = grade_by_rubric_gemini(
        sub.get("content_text", ""),
        rubric,
        api_key=api_key,
        ai_provider=ai_provider
    )
    total_score = compute_total_score(criteria_scores)

    # 2. Build grading result dict
    now = datetime.now(timezone.utc).isoformat()
    result = {
        "id": submission_id,
        "submission_id": submission_id,
        "assignment_id": sub["assignment_id"],
        "student_id": sub["student_id"],
        "student_name": sub.get("student_name", ""),
        "graded_by": teacher["id"],
        "criteria_scores": criteria_scores,
        "total_score": total_score,
        "overall_comment": "",
        "graded_at": now,
        "published_at": None,
        "status": "graded",
    }
    grading_store.set(submission_id, result)

    # 3. Process and store AI feedbacks
    # First, clear any existing AI feedbacks for this submission
    existing_fbs = [
        fb for fb in feedback_store.values()
        if fb.get("submission_id") == submission_id and fb.get("source") == "ai"
    ]
    for fb in existing_fbs:
        feedback_store.delete(fb["id"])

    # Process AI feedbacks through anchoring service
    validated_feedbacks = process_ai_feedbacks(
        ai_feedbacks=raw_feedbacks,
        submission_text=sub.get("content_text", ""),
        submission_id=submission_id,
    )

    # Store each feedback
    for fb in validated_feedbacks:
        feedback_store.set(fb["id"], fb)

    # 4. Update submission status
    sub["status"] = "graded"
    submission_store.set(submission_id, sub)

    # Include feedbacks in returned result
    result["feedbacks"] = validated_feedbacks

    return result, validated_feedbacks

