import json
import time
from typing import Optional
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import GEMINI_API_KEY, GEMINI_MODEL


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


def parse_rubric_with_gemini(text: str, api_key: Optional[str] = None) -> Optional[dict]:
    """Parse unstructured rubric text into a structured JSON template using Gemini."""
    effective_api_key = api_key
    if not effective_api_key or not effective_api_key.strip() or not effective_api_key.startswith("AIzaSy"):
        effective_api_key = GEMINI_API_KEY
    if not effective_api_key:
        raise RuntimeError("Gemini API key is not configured. Vui lòng cấu hình API key trong cài đặt hoặc file .env")

    if not text or not text.strip():
        return None

    client = genai.Client(
        api_key=effective_api_key,
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
            print(f"Gemini API attempt {attempt + 1} failed: {e}. Retrying in {delay} seconds...")
            time.sleep(delay)
            delay *= 2

    if not response or not response.text:
        return None

    try:
        data = json.loads(response.text)
        
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
        print(f"Error parsing Gemini response: {e}. Raw response: {response.text}")
        return None
