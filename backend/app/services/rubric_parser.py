import json
import time
from typing import Optional
import httpx
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import GEMINI_API_KEY, GEMINI_MODEL, GROQ_API_KEY, GROQ_MODEL, decrypt_api_key
from app.logger import logger


class RubricLevelResponse(BaseModel):
    score: float
    description: str


class RubricCriteriaResponse(BaseModel):
    criteria_name: str
    max_score: float
    weight: float
    keywords: list[str] = []
    levels: list[RubricLevelResponse] = []


class RubricTemplateResponse(BaseModel):
    name: str
    description: str
    criteria: list[RubricCriteriaResponse] = []


def parse_rubric_with_gemini(
    text: str,
    api_key: Optional[str] = None,
    ai_provider: str = "default"
) -> Optional[dict]:
    """Parse unstructured rubric text into a structured JSON template using chosen AI provider."""
    if ai_provider == "gemini":
        effective_api_key = decrypt_api_key(api_key) if api_key else ""
        if not effective_api_key or not effective_api_key.strip():
            raise RuntimeError("Gemini API key is not configured. Vui lòng cấu hình API key trong cài đặt tài khoản giảng viên.")
        return _run_gemini_rubric_parser(text, effective_api_key)
    else:
        # Default provider (Groq)
        if GROQ_API_KEY and GROQ_API_KEY.strip():
            return parse_rubric_with_groq(text)
        elif GEMINI_API_KEY and GEMINI_API_KEY.strip():
            # Fallback to system-wide Gemini key
            return _run_gemini_rubric_parser(text, GEMINI_API_KEY)
        else:
            raise RuntimeError("Default AI provider is not configured. Vui lòng thiết lập GROQ_API_KEY hoặc GEMINI_API_KEY trong file .env của hệ thống.")


def _generate_mock_parsed_rubric(text: str) -> dict:
    """Generate mock parsed rubric templates for testing/demo when Gemini API is unavailable."""
    return {
        "name": "Rubric Đánh Giá Đề Tài (Mock AI)",
        "description": "Rubric giả lập được tạo tự động để phục vụ chạy thử nghiệm khi chưa cấu hình API Key.",
        "criteria": [
            {
                "criteria_name": "Nội dung & Kiến thức chuyên môn",
                "max_score": 10.0,
                "weight": 50.0,
                "keywords": ["nội dung", "thuật toán", "kiến thức"],
                "levels": [
                    {"score": 10.0, "description": "Lập luận chính xác, đầy đủ, chứng minh xuất sắc."},
                    {"score": 8.0, "description": "Đạt yêu cầu cốt lõi, sai sót không đáng kể."},
                    {"score": 5.0, "description": "Bài viết sơ sài, thiếu chiều sâu kiến thức."}
                ]
            },
            {
                "criteria_name": "Kỹ năng Trình bày & Bố cục",
                "max_score": 10.0,
                "weight": 50.0,
                "keywords": ["trình bày", "bố cục", "định dạng"],
                "levels": [
                    {"score": 10.0, "description": "Cấu trúc bài viết mạch lạc, rõ ràng, định dạng chuẩn khoa học."},
                    {"score": 7.0, "description": "Đầy đủ bố cục chính nhưng còn một vài lỗi định dạng câu."},
                    {"score": 4.0, "description": "Bố cục lộn xộn, gây khó hiểu cho người đọc."}
                ]
            }
        ]
    }


def _run_gemini_rubric_parser(text: str, api_key: str) -> Optional[dict]:
    if not text or not text.strip():
        return None

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
            http_options=types.HttpOptions(timeout=30_000)
        )

        prompt = f"""Bạn là một chuyên gia về giáo dục và đánh giá. Nhiệm vụ của bạn là đọc nội dung của một tài liệu văn bản chứa Rubric chấm điểm và trích xuất nó thành một cấu trúc dữ liệu JSON rõ ràng.

[Nội dung tài liệu Rubric]:
{text}

Hãy phân tích và trả về đúng định dạng JSON bao gồm:
- name: Tên của Rubric (tự suy luận từ nội dung hoặc đặt tên phù hợp).
- description: Mô tả ngắn gọn về Rubric này.
- criteria: Danh sách các tiêu chí chấm điểm.
Với mỗi tiêu chí (criteria), phải có:
  - criteria_name: Tên tiêu chí.
  - max_score: Điểm tối đa của tiêu chí này.
  - weight: Trọng số của tiêu chí (tính bằng phần trăm %, tổng các trọng số phải bằng 100).
  - keywords: Danh sách các từ khóa quan trọng (tối đa 5 từ khóa).
  - levels: Danh sách các mức điểm (levels) của tiêu chí đó.
Với mỗi mức điểm (level):
  - score: Mức điểm (ví dụ: 10, 8, 5, 0).
  - description: Mô tả yêu cầu để đạt được mức điểm này.

LƯU Ý QUAN TRỌNG: 
- Tổng 'weight' của tất cả các tiêu chí TRONG criteria BẮT BUỘC PHẢI BẰNG 100.
- Hãy cố gắng phân tích cấu trúc dựa trên ý nghĩa của tài liệu, tự nội suy nếu thiếu một số thông tin nhưng vẫn giữ tính hợp lý.
"""

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
                        response_schema=RubricTemplateResponse,
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

        if not response or not response.text:
            return None
        data = json.loads(response.text)
    except Exception as e:
        err_msg = str(e).lower()
        if "api key not valid" in err_msg or "api_key_invalid" in err_msg or "invalid_argument" in err_msg or is_dummy_key:
            logger.warning(f"Kích hoạt chế độ Giả lập (Mock Mode) cho Rubric Parser do API key không hợp lệ: {e}")
            data = _generate_mock_parsed_rubric(text)
        else:
            logger.error(f"Error parsing Gemini response: {e}")
            return None

    # Ensure total weight is 100
    criteria = data.get("criteria", [])
    if criteria:
        total_weight = sum(c.get("weight", 0) for c in criteria)
        if total_weight > 0 and abs(total_weight - 100) > 0.01:
            # Normalize weights
            for c in criteria:
                c["weight"] = round((c.get("weight", 0) / total_weight) * 100, 2)
            
            # Fix rounding error on last item to ensure exactly 100
            new_total = sum(c["weight"] for c in criteria[:-1])
            criteria[-1]["weight"] = round(100.0 - new_total, 2)

    return data


def parse_rubric_with_groq(text: str) -> Optional[dict]:
    if not GROQ_API_KEY or not GROQ_API_KEY.strip():
        raise RuntimeError("Groq API key (default system key) is not configured in .env.")
        
    system_prompt = "Bạn là một chuyên gia về giáo dục và đánh giá. Bạn bắt buộc phải trả về duy nhất dữ liệu định dạng JSON khớp chính xác với cấu trúc được yêu cầu."
    
    prompt = f"""Bạn hãy đọc nội dung của một tài liệu văn bản chứa Rubric chấm điểm và trích xuất nó thành một cấu trúc dữ liệu JSON.
Bạn BẮT BUỘC phải trả về một đối tượng JSON có cấu trúc chính xác như sau:
{{
  "name": "Tên của Rubric (tự suy luận từ nội dung hoặc đặt tên phù hợp)",
  "description": "Mô tả ngắn gọn về Rubric này",
  "criteria": [
    {{
      "criteria_name": "Tên tiêu chí",
      "max_score": 10.0,
      "weight": 20.0, // Trọng số của tiêu chí (tính bằng phần trăm %, ví dụ: 20.0 cho 20%). Tổng các trọng số phải bằng 100.
      "keywords": ["từ khóa 1", "từ khóa 2"], // Danh sách từ khóa quan trọng (tối đa 5 từ)
      "levels": [
        {{
          "score": 10.0,
          "description": "Mô tả yêu cầu để đạt được mức điểm này"
        }}
      ]
    }}
  ]
}}

LƯU Ý QUAN TRỌNG:
1. Tổng 'weight' của tất cả các tiêu chí BẮT BUỘC PHẢI BẰNG 100.
2. Trả về duy nhất một chuỗi JSON hợp lệ, không kèm bất kỳ giải thích nào khác.

[Nội dung tài liệu Rubric]:
{text}
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
    
    max_retries = 3
    delay = 2
    content = ""
    for attempt in range(max_retries):
        try:
            with httpx.Client(timeout=60.0) as client:
                res = client.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload)
                res.raise_for_status()
                res_data = res.json()
                content = res_data["choices"][0]["message"]["content"]
                break
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            logger.warning(f"Groq API attempt {attempt + 1} failed: {e}. Retrying in {delay} seconds...")
            time.sleep(delay)
            delay *= 2

    if not content:
        return None

    try:
        data = json.loads(content)
        
        # Ensure total weight is 100
        criteria = data.get("criteria", [])
        if criteria:
            total_weight = sum(c.get("weight", 0) for c in criteria)
            if total_weight > 0 and abs(total_weight - 100) > 0.01:
                # Normalize weights
                for c in criteria:
                    c["weight"] = round((c.get("weight", 0) / total_weight) * 100, 2)
                
                # Fix rounding error on last item to ensure exactly 100
                new_total = sum(c["weight"] for c in criteria[:-1])
                criteria[-1]["weight"] = round(100.0 - new_total, 2)

        return data
    except Exception as e:
        logger.error(f"Error parsing Groq rubric response: {e}. Raw response: {content}")
        return None
