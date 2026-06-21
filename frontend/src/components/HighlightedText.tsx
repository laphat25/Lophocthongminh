/**
 * HighlightedText — Renders submission text with highlighted feedback anchors.
 * 
 * Features:
 * - Severity-based highlight colors (error=red, warning=yellow, info=blue, praise=green)
 * - Hover tooltip preview
 * - Click to navigate to feedback card
 * - Active feedback highlighting
 * - Overlapping feedback support
 */
import { useMemo, useState, useCallback, useEffect } from "react";
import type { FeedbackItem } from "../types/feedback";
import { buildHighlightSegments } from "../core/highlightEngine";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  AwardIcon,
  EditIcon
} from "./Icons";

function SeverityIcon({ severity, size = 11 }: { severity: string; size?: number }) {
  switch (severity) {
    case "error":
      return <AlertCircleIcon size={size} />;
    case "warning":
      return <AlertTriangleIcon size={size} />;
    case "info":
      return <InfoIcon size={size} />;
    case "praise":
      return <AwardIcon size={size} />;
    default:
      return null;
  }
}

interface HighlightedTextProps {
  text: string;
  feedbacks: FeedbackItem[];
  activeFeedbackId: string | null;
  onHighlightClick: (feedbackIds: string[]) => void;
  submissionRef: React.RefObject<HTMLDivElement | null>;
  isTeacher?: boolean;
  onAddManualFeedback?: (start: number, end: number, quote: string) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  feedbackIds: string[];
}

interface SelectionState {
  start: number;
  end: number;
  text: string;
  x: number;
  y: number;
}

export default function HighlightedText({
  text,
  feedbacks,
  activeFeedbackId,
  onHighlightClick,
  submissionRef,
  isTeacher = false,
  onAddManualFeedback,
}: HighlightedTextProps) {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    feedbackIds: [],
  });

  const [selectionRange, setSelectionRange] = useState<SelectionState | null>(null);

  const segments = useMemo(
    () => buildHighlightSegments(text, feedbacks),
    [text, feedbacks]
  );

  const feedbackMap = useMemo(() => {
    const map = new Map<string, FeedbackItem>();
    feedbacks.forEach((fb) => map.set(fb.id, fb));
    return map;
  }, [feedbacks]);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, feedbackIds: string[]) => {
      if (feedbackIds.length === 0) return;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const containerRect = submissionRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      setTooltip({
        visible: true,
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top - 8,
        feedbackIds,
      });
    },
    [submissionRef]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleSelection = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isTeacher || !onAddManualFeedback) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setSelectionRange(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const container = e.currentTarget;

      if (!container.contains(range.commonAncestorContainer)) {
        setSelectionRange(null);
        return;
      }

      // Range-based character offset calculation relative to text content
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(container);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      const start = preSelectionRange.toString().length;
      const end = start + range.toString().length;
      const selectedText = range.toString();

      // Get bounding coordinates relative to selection container
      const rect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setSelectionRange({
        start,
        end,
        text: selectedText,
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 36,
      });
    },
    [isTeacher, onAddManualFeedback]
  );

  // Clear selection popover if clicked outside
  useEffect(() => {
    if (!selectionRange) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest(".fb-selection-popover") ||
        target.closest(".highlighted-text-content")
      ) {
        return;
      }
      setSelectionRange(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [selectionRange]);

  return (
    <div ref={submissionRef} className="highlighted-text-container">
      <div
        className="highlighted-text-content"
        style={{ whiteSpace: "pre-wrap" }}
        onMouseUp={handleSelection}
      >
        {segments.map((seg, i) =>
          seg.feedbackIds.length > 0 ? (
            <mark
              key={i}
              className={`fb-highlight fb-highlight-${seg.severity || "info"} ${
                seg.feedbackIds.includes(activeFeedbackId || "")
                  ? "fb-highlight-active"
                  : ""
              }`}
              data-feedback-ids={seg.feedbackIds.join(",")}
              onClick={() => onHighlightClick(seg.feedbackIds)}
              onMouseEnter={(e) => handleMouseEnter(e, seg.feedbackIds)}
              onMouseLeave={handleMouseLeave}
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>

      {/* Floating Manual Feedback Popover */}
      {selectionRange && (
        <div
          className="fb-selection-popover"
          style={{
            left: `${selectionRange.x}px`,
            top: `${selectionRange.y}px`,
          }}
        >
          <button
            className="fb-popover-btn"
            onClick={(e) => {
              e.stopPropagation();
              onAddManualFeedback?.(
                selectionRange.start,
                selectionRange.end,
                selectionRange.text
              );
              setSelectionRange(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <EditIcon size={12} style={{ marginRight: "4px" }} />
            <span>Thêm nhận xét</span>
          </button>
        </div>
      )}

      {/* Tooltip */}
      {tooltip.visible && tooltip.feedbackIds.length > 0 && (
        <div
          className="fb-tooltip"
          style={{
            left: `${Math.min(tooltip.x, 280)}px`,
            top: `${tooltip.y}px`,
          }}
        >
          {tooltip.feedbackIds.slice(0, 3).map((id) => {
            const fb = feedbackMap.get(id);
            if (!fb) return null;
            return (
              <div key={id} className="fb-tooltip-item">
                <span className="fb-tooltip-icon">
                  <SeverityIcon severity={fb.severity} size={11} />
                </span>
                <span className="fb-tooltip-text">
                  {fb.comment.length > 60
                    ? fb.comment.slice(0, 60) + "..."
                    : fb.comment}
                </span>
              </div>
            );
          })}
          {tooltip.feedbackIds.length > 3 && (
            <div className="fb-tooltip-more">
              +{tooltip.feedbackIds.length - 3} nhận xét khác
            </div>
          )}
          <div className="fb-tooltip-hint">Click để xem chi tiết</div>
        </div>
      )}
    </div>
  );
}
