"""
Plagiarism detection service.

Two modes:
1. check_plagiarism(new_text, other_texts) — single submission vs corpus
2. compute_similarity_matrix(submissions) — N×N pairwise similarity
"""
import re
from rank_bm25 import BM25Okapi

STOPWORDS = {
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
    "và", "là", "của", "có", "trong", "được", "các", "một", "để",
    "với", "này", "đó", "cho", "từ", "không", "theo", "về", "tại",
    "như", "khi", "thì", "nếu", "nhưng", "hoặc", "bởi", "vì", "do",
    "đã", "sẽ", "đang", "đây", "kia", "đó", "những", "hay", "cũng",
    "rất", "mà", "bị", "vào", "ra", "lên", "xuống", "trên", "dưới",
    "nên", "phải", "cần", "đến", "đi", "lại", "nào", "gì", "ai",
}


def _tokenize(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    tokens = text.split()
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


def _self_score(tokens: list[str]) -> float:
    """Self-similarity baseline for normalization."""
    if not tokens:
        return 0.0
    bm25 = BM25Okapi([tokens])
    scores = bm25.get_scores(tokens)
    return float(scores[0]) if scores else 0.0


def check_plagiarism(new_text: str, other_texts: list[str]) -> float:
    """Return plagiarism % (0–100) of new_text against corpus of other_texts."""
    if not other_texts:
        return 0.0
    new_tokens = _tokenize(new_text)
    if not new_tokens:
        return 0.0
    
    new_set = set(new_tokens)
    max_sim = 0.0
    for other in other_texts:
        other_tokens = _tokenize(other)
        if not other_tokens:
            continue
        other_set = set(other_tokens)
        intersection = new_set & other_set
        if not intersection:
            continue
        # Containment similarity: percentage of query tokens found in the target
        sim = (len(intersection) / len(new_set)) * 100.0
        if sim > max_sim:
            max_sim = sim
            
    return round(min(100.0, max_sim), 2)


def compute_similarity_matrix(submissions: list[dict]) -> list[dict]:
    """
    Compute pairwise similarity for a list of submissions.

    Each submission dict: {id, student_name, content_text}
    Returns list of {submission_a, student_a_name, submission_b, student_b_name,
                     similarity_score (0-1), flag}
    """
    n = len(submissions)
    if n < 2:
        return []

    tokenized = []
    for sub in submissions:
        tokens = _tokenize(sub.get("content_text", ""))
        tokenized.append(set(tokens))

    results = []
    for i in range(n):
        for j in range(i + 1, n):
            set_i = tokenized[i]
            set_j = tokenized[j]

            if not set_i or not set_j:
                sim = 0.0
            else:
                intersection = set_i & set_j
                # Use bidirectional max containment for pairwise similarity
                sim = max(len(intersection) / len(set_i), len(intersection) / len(set_j)) * 100.0

            sim = round(min(100.0, sim), 2)

            flag = "ok"
            if sim >= 70:
                flag = "severe"
            elif sim >= 40:
                flag = "warning"

            results.append({
                "submission_a": submissions[i]["id"],
                "student_a_name": submissions[i].get("student_name", ""),
                "submission_b": submissions[j]["id"],
                "student_b_name": submissions[j].get("student_name", ""),
                "similarity_score": round(sim / 100, 4),
                "similarity_pct": sim,
                "flag": flag,
            })

    # Sort by similarity descending
    results.sort(key=lambda x: x["similarity_pct"], reverse=True)
    return results


def run_assignment_plagiarism_check(new_text: str, assignment_id: str, exclude_student_id: str) -> float:
    """Compare a new submission's text against other students' submissions for the same assignment."""
    from app.storage import submission_store
    others = [
        s["content_text"] for s in submission_store.values()
        if s["assignment_id"] == assignment_id
        and s["student_id"] != exclude_student_id
        and s.get("content_text")
    ]
    return check_plagiarism(new_text, others)

