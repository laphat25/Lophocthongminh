/**
 * FeedbackPanel — Sidebar panel displaying all feedback cards with
 * summary counts and severity filter.
 */
import { useState, useMemo } from "react";
import type { FeedbackItem, FeedbackSeverity } from "../types/feedback";
import FeedbackCard from "./FeedbackCard";

interface FeedbackPanelProps {
  feedbacks: FeedbackItem[];
  activeFeedbackId: string | null;
  onFeedbackClick: (feedbackId: string) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onResolve?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAcceptFix?: (id: string) => void;
  onRejectFix?: (id: string) => void;
}

type FilterType = "all" | FeedbackSeverity;

export default function FeedbackPanel({
  feedbacks,
  activeFeedbackId,
  onFeedbackClick,
  registerRef,
  onResolve,
  onDismiss,
  onAcceptFix,
  onRejectFix,
}: FeedbackPanelProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const summary = useMemo(() => {
    return {
      error: feedbacks.filter((f) => f.severity === "error").length,
      warning: feedbacks.filter((f) => f.severity === "warning").length,
      info: feedbacks.filter((f) => f.severity === "info").length,
      praise: feedbacks.filter((f) => f.severity === "praise").length,
      total: feedbacks.length,
    };
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    if (filter === "all") return feedbacks;
    return feedbacks.filter((f) => f.severity === filter);
  }, [feedbacks, filter]);

  if (feedbacks.length === 0) {
    return null;
  }

  return (
    <div className="fb-panel">
      <div className="fb-panel-header">
        <h3 className="fb-panel-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Nhận xét chi tiết
        </h3>
        <span className="fb-panel-count">{summary.total}</span>
      </div>

      {/* Summary badges */}
      <div className="fb-summary-bar">
        <button
          className={`fb-filter-btn ${filter === "all" ? "fb-filter-active" : ""}`}
          onClick={() => setFilter("all")}
        >
          Tất cả ({summary.total})
        </button>
        {summary.error > 0 && (
          <button
            className={`fb-filter-btn fb-filter-error ${filter === "error" ? "fb-filter-active" : ""}`}
            onClick={() => setFilter("error")}
          >
            <span className="fb-status-dot dot-error"></span>
            <span>{summary.error}</span>
          </button>
        )}
        {summary.warning > 0 && (
          <button
            className={`fb-filter-btn fb-filter-warning ${filter === "warning" ? "fb-filter-active" : ""}`}
            onClick={() => setFilter("warning")}
          >
            <span className="fb-status-dot dot-warning"></span>
            <span>{summary.warning}</span>
          </button>
        )}
        {summary.info > 0 && (
          <button
            className={`fb-filter-btn fb-filter-info ${filter === "info" ? "fb-filter-active" : ""}`}
            onClick={() => setFilter("info")}
          >
            <span className="fb-status-dot dot-info"></span>
            <span>{summary.info}</span>
          </button>
        )}
        {summary.praise > 0 && (
          <button
            className={`fb-filter-btn fb-filter-praise ${filter === "praise" ? "fb-filter-active" : ""}`}
            onClick={() => setFilter("praise")}
          >
            <span className="fb-status-dot dot-praise"></span>
            <span>{summary.praise}</span>
          </button>
        )}
      </div>

      {/* Feedback cards */}
      <div className="fb-cards-list">
        {filteredFeedbacks.length === 0 ? (
          <div className="fb-empty">Không có nhận xét nào</div>
        ) : (
          filteredFeedbacks.map((fb) => (
            <FeedbackCard
              key={fb.id}
              feedback={fb}
              isActive={activeFeedbackId === fb.id}
              onClick={() => onFeedbackClick(fb.id)}
              registerRef={registerRef}
              onResolve={onResolve}
              onDismiss={onDismiss}
              onAcceptFix={onAcceptFix}
              onRejectFix={onRejectFix}
            />
          ))
        )}
      </div>
    </div>
  );
}
