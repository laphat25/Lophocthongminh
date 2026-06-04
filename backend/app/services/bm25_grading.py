"""
BM25-based rubric grading engine.

For each rubric criterion:
  - Build a BM25 index over the submission text (single document corpus)
  - For each level, create a "query" from level.description + criterion.keywords
  - The level with the highest BM25 score is the AI suggestion
"""
import re
from rank_bm25 import BM25Okapi

# Vietnamese + English stopwords
STOPWORDS = {
    # English
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "need", "must",
    "it", "its", "this", "that", "these", "those", "i", "you", "he", "she",
    "we", "they", "me", "him", "her", "us", "them", "my", "your", "his",
    "our", "their", "what", "which", "who", "whom", "how", "when", "where",
    "why", "not", "no", "nor", "as", "if", "then", "than", "so", "such",
    "also", "each", "every", "all", "any", "few", "more", "most", "other",
    "some", "about", "up", "out", "into", "over", "after", "before",
    # Vietnamese
    "và", "là", "của", "có", "trong", "được", "các", "một", "để",
    "với", "này", "đó", "cho", "từ", "không", "theo", "về", "tại",
    "như", "khi", "thì", "nếu", "nhưng", "hoặc", "bởi", "vì", "do",
    "đã", "sẽ", "đang", "đây", "kia", "đó", "những", "hay", "cũng",
    "rất", "mà", "bị", "vào", "ra", "lên", "xuống", "trên", "dưới",
    "nên", "phải", "cần", "đến", "đi", "lại", "nào", "gì", "ai",
    "bao", "nhiêu", "hơn", "nhất", "thế", "vậy", "thì", "ở", "qua",
}


def tokenize(text: str) -> list[str]:
    """Lowercase, remove punctuation, split, remove stopwords."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    tokens = text.split()
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


def grade_by_rubric(submission_text: str, rubric: list[dict]) -> list[dict]:
    """
    Grade a submission against a structured rubric using BM25.

    Returns a list of per-criteria scoring results with AI suggestions.
    """
    sub_tokens = tokenize(submission_text)
    if not sub_tokens:
        return _default_grades(rubric)

    # BM25 index: corpus = [submission]
    bm25 = BM25Okapi([sub_tokens])

    results = []
    for criteria in rubric:
        levels = criteria.get("levels", [])
        keywords = criteria.get("keywords", [])

        if not levels:
            results.append(_empty_criteria_result(criteria))
            continue

        best_score = -1.0
        best_level = levels[0]
        level_bm25_scores = []

        for level in levels:
            # Query = level description + criteria keywords
            query_text = level.get("description", "") + " " + " ".join(keywords)
            query_tokens = tokenize(query_text)

            if not query_tokens:
                level_bm25_scores.append(0.0)
                continue

            scores = bm25.get_scores(query_tokens)
            score_val = float(scores[0]) if len(scores) > 0 else 0.0
            level_bm25_scores.append(score_val)

            if score_val > best_score:
                best_score = score_val
                best_level = level

        results.append({
            "criteria_id": criteria.get("criteria_id", ""),
            "criteria_name": criteria.get("criteria_name", ""),
            "ai_suggested_score": best_level.get("score", 0),
            "ai_suggested_level": best_level.get("description", ""),
            "final_score": best_level.get("score", 0),
            "max_score": criteria.get("max_score", 10),
            "weight": criteria.get("weight", 0),
            "teacher_comment": "",
            "highlighted_text": _extract_highlights(submission_text, keywords),
        })

    return results


def compute_total_score(criteria_scores: list[dict]) -> float:
    """
    Total = Σ (final_score_i / max_score_i × weight_i)
    where weights sum to 100 → total is 0–100.
    """
    total = 0.0
    for c in criteria_scores:
        max_s = c.get("max_score", 0)
        if max_s > 0:
            achievement = c.get("final_score", 0) / max_s
            total += achievement * c.get("weight", 0)
    return round(total, 2)


def _extract_highlights(text: str, keywords: list[str]) -> list[str]:
    """Find sentences containing any of the keywords."""
    if not keywords:
        return []
    sentences = re.split(r"[.!?\n]", text)
    highlights = []
    kw_lower = [k.lower() for k in keywords]
    for sent in sentences:
        s = sent.strip()
        if not s:
            continue
        if any(kw in s.lower() for kw in kw_lower):
            highlights.append(s[:200])  # truncate long sentences
        if len(highlights) >= 3:
            break
    return highlights


def _default_grades(rubric: list[dict]) -> list[dict]:
    return [_empty_criteria_result(c) for c in rubric]


def _empty_criteria_result(criteria: dict) -> dict:
    levels = criteria.get("levels", [])
    first_level = levels[0] if levels else {"score": 0, "description": ""}
    return {
        "criteria_id": criteria.get("criteria_id", ""),
        "criteria_name": criteria.get("criteria_name", ""),
        "ai_suggested_score": first_level.get("score", 0),
        "ai_suggested_level": first_level.get("description", ""),
        "final_score": first_level.get("score", 0),
        "max_score": criteria.get("max_score", 10),
        "weight": criteria.get("weight", 0),
        "teacher_comment": "",
        "highlighted_text": [],
    }
