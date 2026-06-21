"""
Anchor Service: compute character offsets, fuzzy matching, anchor validation.

Provides the core logic for locating AI-quoted text within submission content
and resolving anchor positions with multi-layer fallback strategy.
"""
import re
import uuid
from difflib import SequenceMatcher
from typing import Optional


def compute_offset_exact(quote: str, text: str) -> Optional[tuple[int, int]]:
    """Layer 1: Exact string match."""
    pos = text.find(quote)
    if pos >= 0:
        return (pos, pos + len(quote))
    return None


def compute_offset_case_insensitive(quote: str, text: str) -> Optional[tuple[int, int]]:
    """Layer 1b: Case-insensitive exact match."""
    pos = text.lower().find(quote.lower())
    if pos >= 0:
        return (pos, pos + len(quote))
    return None


def compute_offset_with_context(
    quote: str,
    text: str,
    prefix_context: str = "",
    suffix_context: str = "",
) -> Optional[tuple[int, int]]:
    """Layer 2: Use prefix/suffix context to disambiguate multiple matches."""
    if not prefix_context and not suffix_context:
        return compute_offset_exact(quote, text)

    # Build combined pattern and search
    combined = prefix_context + quote + suffix_context
    pos = text.find(combined)
    if pos >= 0:
        start = pos + len(prefix_context)
        end = start + len(quote)
        return (start, end)

    # Try just prefix + quote
    if prefix_context:
        combined = prefix_context + quote
        pos = text.find(combined)
        if pos >= 0:
            start = pos + len(prefix_context)
            return (start, start + len(quote))

    # Try just quote + suffix
    if suffix_context:
        combined = quote + suffix_context
        pos = text.find(combined)
        if pos >= 0:
            return (pos, pos + len(quote))

    # Fallback to simple exact
    return compute_offset_exact(quote, text)


def fuzzy_find(
    quote: str,
    text: str,
    threshold: float = 0.75,
    max_window_deviation: float = 0.3,
) -> Optional[tuple[int, int, float]]:
    """
    Layer 3: Sliding window fuzzy match using SequenceMatcher.

    Returns (start, end, similarity_ratio) or None.
    Uses optimized sliding window with variable-size matching.
    """
    if not quote or not text:
        return None

    quote_lower = quote.lower()
    text_lower = text.lower()
    quote_len = len(quote_lower)

    if quote_len < 5:
        return None

    # Try multiple window sizes (±30% of quote length)
    min_window = max(5, int(quote_len * (1 - max_window_deviation)))
    max_window = int(quote_len * (1 + max_window_deviation))

    best_ratio = 0.0
    best_start = -1
    best_end = -1

    # Step size for performance: skip every N chars for long texts
    step = max(1, len(text_lower) // 2000)

    for window_size in [quote_len, min_window, max_window]:
        if window_size > len(text_lower):
            continue

        for i in range(0, len(text_lower) - window_size + 1, step):
            window = text_lower[i:i + window_size]
            ratio = SequenceMatcher(None, quote_lower, window).ratio()

            if ratio > best_ratio:
                best_ratio = ratio
                best_start = i
                best_end = i + window_size

    # Refine with step=1 around the best match
    if best_start >= 0 and step > 1:
        search_start = max(0, best_start - step * 2)
        search_end = min(len(text_lower), best_end + step * 2)

        for window_size in [quote_len, min_window, max_window]:
            if window_size > search_end - search_start:
                continue
            for i in range(search_start, search_end - window_size + 1):
                window = text_lower[i:i + window_size]
                ratio = SequenceMatcher(None, quote_lower, window).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_start = i
                    best_end = i + window_size

    if best_ratio >= threshold:
        return (best_start, best_end, best_ratio)

    return None


def paragraph_fallback(
    text: str,
    paragraph_index: Optional[int],
    sentence_index: Optional[int] = None,
) -> Optional[tuple[int, int]]:
    """Layer 4: Paragraph/sentence based fallback."""
    if paragraph_index is None:
        return None

    paragraphs = re.split(r'\n\s*\n', text)

    if paragraph_index >= len(paragraphs):
        return None

    para = paragraphs[paragraph_index]
    para_start = text.find(para)

    if para_start < 0:
        return None

    if sentence_index is not None:
        sentences = re.split(r'(?<=[.!?])\s+', para)
        if sentence_index < len(sentences):
            sent = sentences[sentence_index]
            sent_start = text.find(sent, para_start)
            if sent_start >= 0:
                return (sent_start, sent_start + len(sent))

    return (para_start, para_start + len(para))


def resolve_anchor(
    quote: str,
    text: str,
    prefix_context: str = "",
    suffix_context: str = "",
    paragraph_index: Optional[int] = None,
    sentence_index: Optional[int] = None,
) -> dict:
    """
    Multi-layer anchor resolution. Returns anchor dict with computed offsets.

    Strategy:
    1. Exact match with context
    2. Case-insensitive match
    3. Fuzzy match
    4. Paragraph fallback
    """
    anchor_id = str(uuid.uuid4())

    # Layer 1: Exact match with context
    result = compute_offset_with_context(quote, text, prefix_context, suffix_context)
    if result:
        return {
            "id": anchor_id,
            "char_offset_start": result[0],
            "char_offset_end": result[1],
            "exact_quote": quote,
            "prefix_context": prefix_context,
            "suffix_context": suffix_context,
            "paragraph_index": paragraph_index,
            "sentence_index": sentence_index,
            "line_number": None,
            "column_start": None,
            "column_end": None,
            "anchor_status": "valid",
            "confidence": 1.0,
        }

    # Layer 1b: Case-insensitive
    result = compute_offset_case_insensitive(quote, text)
    if result:
        return {
            "id": anchor_id,
            "char_offset_start": result[0],
            "char_offset_end": result[1],
            "exact_quote": quote,
            "prefix_context": prefix_context,
            "suffix_context": suffix_context,
            "paragraph_index": paragraph_index,
            "sentence_index": sentence_index,
            "line_number": None,
            "column_start": None,
            "column_end": None,
            "anchor_status": "valid",
            "confidence": 0.95,
        }

    # Layer 3: Fuzzy match
    fuzzy_result = fuzzy_find(quote, text, threshold=0.75)
    if fuzzy_result:
        start, end, ratio = fuzzy_result
        return {
            "id": anchor_id,
            "char_offset_start": start,
            "char_offset_end": end,
            "exact_quote": quote,
            "prefix_context": prefix_context,
            "suffix_context": suffix_context,
            "paragraph_index": paragraph_index,
            "sentence_index": sentence_index,
            "line_number": None,
            "column_start": None,
            "column_end": None,
            "anchor_status": "relocated",
            "confidence": round(ratio, 3),
        }

    # Layer 4: Paragraph fallback
    para_result = paragraph_fallback(text, paragraph_index, sentence_index)
    if para_result:
        return {
            "id": anchor_id,
            "char_offset_start": para_result[0],
            "char_offset_end": para_result[1],
            "exact_quote": quote,
            "prefix_context": prefix_context,
            "suffix_context": suffix_context,
            "paragraph_index": paragraph_index,
            "sentence_index": sentence_index,
            "line_number": None,
            "column_start": None,
            "column_end": None,
            "anchor_status": "relocated",
            "confidence": 0.5,
        }

    # All layers failed → orphaned
    return {
        "id": anchor_id,
        "char_offset_start": 0,
        "char_offset_end": 0,
        "exact_quote": quote,
        "prefix_context": prefix_context,
        "suffix_context": suffix_context,
        "paragraph_index": paragraph_index,
        "sentence_index": sentence_index,
        "line_number": None,
        "column_start": None,
        "column_end": None,
        "anchor_status": "orphaned",
        "confidence": 0.0,
    }
