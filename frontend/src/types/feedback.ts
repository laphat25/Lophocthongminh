// ─── Feedback Anchoring Types ──────────────────────────────────────────────

export interface AnchorData {
  id: string;
  char_offset_start: number;
  char_offset_end: number;
  exact_quote: string;
  prefix_context: string;
  suffix_context: string;
  paragraph_index: number | null;
  sentence_index: number | null;
  line_number: number | null;
  column_start: number | null;
  column_end: number | null;
  anchor_status: "valid" | "relocated" | "orphaned";
  confidence: number;
}

export interface SuggestedFix {
  id: string;
  original_text: string;
  replacement_text: string;
  explanation: string;
  fix_status: "pending" | "accepted" | "rejected" | "modified";
}

export type FeedbackSeverity = "error" | "warning" | "info" | "praise";
export type FeedbackCategory =
  | "grammar"
  | "logic"
  | "structure"
  | "citation"
  | "clarity"
  | "completeness"
  | "originality"
  | "style"
  | "code_bug"
  | "other";
export type FeedbackStatus = "active" | "accepted" | "dismissed" | "resolved";

export interface FeedbackItem {
  id: string;
  review_session_id: string;
  submission_id: string;
  criteria_id: string;
  anchor: AnchorData;
  severity: FeedbackSeverity;
  category: FeedbackCategory;
  comment: string;
  evidence: string;
  suggested_fix: SuggestedFix | null;
  source: "ai" | "teacher" | "peer";
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
}

export interface FeedbackSummary {
  error_count: number;
  warning_count: number;
  info_count: number;
  praise_count: number;
  resolved_count: number;
}

export interface FeedbacksResponse {
  feedbacks: FeedbackItem[];
  total: number;
  summary: FeedbackSummary;
}

// ─── Highlight Engine Types ────────────────────────────────────────────────

export interface TextSegment {
  text: string;
  feedbackIds: string[];
  severity?: FeedbackSeverity;
  startOffset: number;
  endOffset: number;
}
