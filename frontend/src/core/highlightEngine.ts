/**
 * Highlight Engine: Converts plain text + feedback anchors into segments
 * for rendering with highlight annotations.
 *
 * Handles overlapping feedbacks by splitting text at all anchor boundaries
 * and tracking which feedbacks cover each segment.
 */
import type { FeedbackItem, FeedbackSeverity, TextSegment } from "../types/feedback";

const SEVERITY_PRIORITY: Record<FeedbackSeverity, number> = {
  error: 4,
  warning: 3,
  info: 2,
  praise: 1,
};

/**
 * Get the highest severity from a list of feedbacks.
 */
function getHighestSeverity(feedbacks: FeedbackItem[]): FeedbackSeverity | undefined {
  if (feedbacks.length === 0) return undefined;

  let highest: FeedbackSeverity = feedbacks[0].severity;
  let highestPriority = SEVERITY_PRIORITY[highest] || 0;

  for (let i = 1; i < feedbacks.length; i++) {
    const priority = SEVERITY_PRIORITY[feedbacks[i].severity] || 0;
    if (priority > highestPriority) {
      highest = feedbacks[i].severity;
      highestPriority = priority;
    }
  }

  return highest;
}

/**
 * Build highlight segments from text and feedbacks.
 *
 * Algorithm:
 * 1. Collect all boundary points (start/end of each non-dismissed anchor)
 * 2. Sort boundaries
 * 3. Build segments between consecutive boundaries
 * 4. For each segment, determine which feedbacks overlap it
 */
export function buildHighlightSegments(
  text: string,
  feedbacks: FeedbackItem[]
): TextSegment[] {
  if (!text || feedbacks.length === 0) {
    return [{ text, feedbackIds: [], startOffset: 0, endOffset: text.length }];
  }

  // Filter out dismissed feedbacks and orphaned anchors
  const activeFeedbacks = feedbacks.filter(
    (fb) => fb.status !== "dismissed" && fb.anchor.anchor_status !== "orphaned"
  );

  if (activeFeedbacks.length === 0) {
    return [{ text, feedbackIds: [], startOffset: 0, endOffset: text.length }];
  }

  // Collect all boundary points
  const boundaries = new Set<number>([0, text.length]);
  for (const fb of activeFeedbacks) {
    const start = Math.max(0, Math.min(fb.anchor.char_offset_start, text.length));
    const end = Math.max(0, Math.min(fb.anchor.char_offset_end, text.length));
    if (start < end) {
      boundaries.add(start);
      boundaries.add(end);
    }
  }

  // Sort boundaries
  const sorted = [...boundaries].sort((a, b) => a - b);

  // Build segments
  const segments: TextSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];

    // Find overlapping feedbacks for this segment
    const overlapping = activeFeedbacks.filter(
      (fb) =>
        fb.anchor.char_offset_start <= start && fb.anchor.char_offset_end >= end
    );

    segments.push({
      text: text.slice(start, end),
      feedbackIds: overlapping.map((fb) => fb.id),
      severity: getHighestSeverity(overlapping),
      startOffset: start,
      endOffset: end,
    });
  }

  return segments;
}

/**
 * Get severity display info (icon, color class, label).
 */
export function getSeverityInfo(severity: FeedbackSeverity) {
  switch (severity) {
    case "error":
      return { className: "highlight-error", label: "Lỗi" };
    case "warning":
      return { className: "highlight-warning", label: "Cần cải thiện" };
    case "info":
      return { className: "highlight-info", label: "Gợi ý" };
    case "praise":
      return { className: "highlight-praise", label: "Điểm tốt" };
  }
}

/**
 * Get category display label in Vietnamese.
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    grammar: "Ngữ pháp",
    logic: "Logic",
    structure: "Cấu trúc",
    citation: "Trích dẫn",
    clarity: "Rõ ràng",
    completeness: "Đầy đủ",
    originality: "Sáng tạo",
    style: "Văn phong",
    code_bug: "Lỗi code",
    other: "Khác",
  };
  return labels[category] || category;
}
