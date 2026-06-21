"""
Feedback Anchoring Service: Process AI output into validated, anchored feedback items.

Takes raw AI grading output (with anchored_feedbacks) and:
1. Validates each feedback's quote exists in the submission
2. Computes character offsets using AnchorService
3. Discards feedbacks that can't be located
4. Returns enriched FeedbackItem dicts ready for storage
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from app.services.anchor_service import resolve_anchor


def process_ai_feedbacks(
    ai_feedbacks: list[dict],
    submission_text: str,
    submission_id: str,
    review_session_id: Optional[str] = None,
) -> list[dict]:
    """
    Process raw AI feedback output into validated FeedbackItem dicts.

    Args:
        ai_feedbacks: List of feedback dicts from AI (AnchoredGradingResponse.anchored_feedbacks)
        submission_text: The full submission text to match against
        submission_id: ID of the submission
        review_session_id: Optional review session ID

    Returns:
        List of validated FeedbackItem dicts with resolved anchors
    """
    if not ai_feedbacks or not submission_text:
        return []

    now = datetime.now(timezone.utc).isoformat()
    validated_feedbacks = []

    for raw_fb in ai_feedbacks:
        feedback = _process_single_feedback(
            raw_fb, submission_text, submission_id, review_session_id, now
        )
        if feedback is not None:
            validated_feedbacks.append(feedback)

    return validated_feedbacks


def _process_single_feedback(
    raw_fb: dict,
    submission_text: str,
    submission_id: str,
    review_session_id: Optional[str],
    now: str,
) -> Optional[dict]:
    """Process a single AI feedback output into a validated FeedbackItem."""
    anchor_data = raw_fb.get("anchor", {})
    quote = anchor_data.get("exact_quote", "")

    # Skip if no quote or too short
    if not quote or len(quote.strip()) < 3:
        return None

    # Resolve anchor position in text
    anchor = resolve_anchor(
        quote=quote.strip(),
        text=submission_text,
        prefix_context=anchor_data.get("prefix_context", ""),
        suffix_context=anchor_data.get("suffix_context", ""),
        paragraph_index=anchor_data.get("paragraph_index"),
        sentence_index=anchor_data.get("sentence_index"),
    )

    # Skip orphaned anchors (couldn't locate in text at all)
    if anchor["anchor_status"] == "orphaned":
        return None

    # Build suggested fix if present
    suggested_fix = None
    raw_fix = raw_fb.get("suggested_fix")
    if raw_fix and raw_fix.get("replacement_text"):
        suggested_fix = {
            "id": str(uuid.uuid4()),
            "original_text": raw_fix.get("original_text", quote),
            "replacement_text": raw_fix["replacement_text"],
            "explanation": raw_fix.get("explanation", ""),
            "fix_status": "pending",
        }

    # Validate severity
    severity = raw_fb.get("severity", "info")
    if severity not in ("error", "warning", "info", "praise"):
        severity = "info"

    # Validate category
    category = raw_fb.get("category", "other")
    valid_categories = {
        "grammar", "logic", "structure", "citation", "clarity",
        "completeness", "originality", "style", "code_bug", "other"
    }
    if category not in valid_categories:
        category = "other"

    feedback_id = str(uuid.uuid4())

    return {
        "id": feedback_id,
        "review_session_id": review_session_id or "",
        "submission_id": submission_id,
        "criteria_id": raw_fb.get("criteria_id") or "",
        "anchor": anchor,
        "severity": severity,
        "category": category,
        "comment": raw_fb.get("comment", ""),
        "evidence": raw_fb.get("evidence", ""),
        "suggested_fix": suggested_fix,
        "source": "ai",
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }


def create_manual_feedback(
    submission_text: str,
    submission_id: str,
    char_offset_start: int,
    char_offset_end: int,
    severity: str,
    category: str,
    comment: str,
    criteria_id: str = "",
    suggested_fix: Optional[dict] = None,
    review_session_id: str = "",
) -> dict:
    """Create a manual (teacher-created) feedback item."""
    now = datetime.now(timezone.utc).isoformat()

    # Extract quote from offsets
    exact_quote = submission_text[char_offset_start:char_offset_end]

    # Build context
    prefix_start = max(0, char_offset_start - 30)
    suffix_end = min(len(submission_text), char_offset_end + 30)
    prefix_context = submission_text[prefix_start:char_offset_start]
    suffix_context = submission_text[char_offset_end:suffix_end]

    anchor_id = str(uuid.uuid4())
    feedback_id = str(uuid.uuid4())

    anchor = {
        "id": anchor_id,
        "char_offset_start": char_offset_start,
        "char_offset_end": char_offset_end,
        "exact_quote": exact_quote,
        "prefix_context": prefix_context,
        "suffix_context": suffix_context,
        "paragraph_index": None,
        "sentence_index": None,
        "line_number": None,
        "column_start": None,
        "column_end": None,
        "anchor_status": "valid",
        "confidence": 1.0,
    }

    fix_data = None
    if suggested_fix and suggested_fix.get("replacement_text"):
        fix_data = {
            "id": str(uuid.uuid4()),
            "original_text": exact_quote,
            "replacement_text": suggested_fix["replacement_text"],
            "explanation": suggested_fix.get("explanation", ""),
            "fix_status": "pending",
        }

    return {
        "id": feedback_id,
        "review_session_id": review_session_id,
        "submission_id": submission_id,
        "criteria_id": criteria_id,
        "anchor": anchor,
        "severity": severity if severity in ("error", "warning", "info", "praise") else "info",
        "category": category,
        "comment": comment,
        "evidence": "",
        "suggested_fix": fix_data,
        "source": "teacher",
        "status": "active",
        "created_at": now,
        "updated_at": now,
    }
