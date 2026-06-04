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
    corpus_tokens = [_tokenize(t) for t in other_texts]
    corpus_tokens = [t for t in corpus_tokens if t]
    if not corpus_tokens:
        return 0.0
    bm25 = BM25Okapi(corpus_tokens)
    scores = bm25.get_scores(new_tokens)
    max_score = float(max(scores))
    self_s = _self_score(new_tokens)
    if self_s == 0:
        return 0.0
    return min(100.0, (max_score / self_s) * 100.0)


def compute_similarity_matrix(submissions: list[dict]) -> list[dict]:
    """
    Compute pairwise BM25 similarity for a list of submissions.

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
        tokenized.append(tokens)

    # Pre-compute self-scores
    self_scores = [_self_score(t) for t in tokenized]

    # Build one BM25 on the full corpus
    valid_corpus = [t if t else ["__empty__"] for t in tokenized]
    bm25_full = BM25Okapi(valid_corpus)

    results = []
    for i in range(n):
        for j in range(i + 1, n):
            tokens_i = tokenized[i] if tokenized[i] else ["__empty__"]
            tokens_j = tokenized[j] if tokenized[j] else ["__empty__"]

            score_ij = float(bm25_full.get_scores(tokens_i)[j])
            score_ji = float(bm25_full.get_scores(tokens_j)[i])

            ss_i = self_scores[i]
            ss_j = self_scores[j]

            if ss_i > 0 and ss_j > 0:
                sim = max(score_ij / ss_i, score_ji / ss_j) * 100.0
            elif ss_i > 0:
                sim = (score_ij / ss_i) * 100.0
            elif ss_j > 0:
                sim = (score_ji / ss_j) * 100.0
            else:
                sim = 0.0

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
