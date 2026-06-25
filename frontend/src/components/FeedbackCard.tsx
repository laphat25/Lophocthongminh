/**
 * FeedbackCard — Individual feedback item card showing severity,
 * category, comment, evidence, and read-only suggested fix.
 */
import type { FeedbackItem } from "../types/feedback";
import { getSeverityInfo, getCategoryLabel } from "../core/highlightEngine";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  AwardIcon,
  LightbulbIcon,
  EditIcon,
} from "./Icons";

interface FeedbackCardProps {
  feedback: FeedbackItem;
  isActive: boolean;
  onClick: () => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onResolve?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onAcceptFix?: (id: string) => void;
  onRejectFix?: (id: string) => void;
}

function SeverityIcon({ severity, size = 12 }: { severity: string; size?: number }) {
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

export default function FeedbackCard({
  feedback,
  isActive,
  onClick,
  registerRef,
  onResolve,
  onDismiss,
  onAcceptFix,
  onRejectFix,
}: FeedbackCardProps) {
  const info = getSeverityInfo(feedback.severity);

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      active: "Đang hoạt động",
      accepted: "Đã chấp nhận",
      dismissed: "Đã bỏ qua",
      resolved: "Đã giải quyết"
    };
    return map[status] || status;
  };

  return (
    <div
      ref={(el) => registerRef(feedback.id, el)}
      className={`fb-card ${isActive ? "fb-card-active" : ""} fb-status-${feedback.status}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="fb-card-header">
        <div className="fb-card-badges">
          <span className={`fb-severity-badge fb-severity-${feedback.severity}`}>
            <SeverityIcon severity={feedback.severity} />
            <span>{info.label}</span>
          </span>
          <span className="fb-category-badge">
            {getCategoryLabel(feedback.category)}
          </span>
          {feedback.source === "teacher" && (
            <span className="fb-source-badge">
              <EditIcon size={10} style={{ marginRight: "3px" }} />
              GV
            </span>
          )}
        </div>
        {feedback.anchor && feedback.anchor.confidence < 1 && (
          <span className="fb-confidence" title={`Độ tin cậy vị trí: ${Math.round(feedback.anchor.confidence * 100)}%`}>
            {feedback.anchor.anchor_status === "relocated" ? "≈" : ""}
            {Math.round(feedback.anchor.confidence * 100)}%
          </span>
        )}
      </div>

      {/* Quote */}
      {feedback.anchor && (
        <div className="fb-card-quote">
          "{feedback.anchor.exact_quote.length > 80
            ? feedback.anchor.exact_quote.slice(0, 80) + "..."
            : feedback.anchor.exact_quote}"
        </div>
      )}

      {/* Comment */}
      <p className="fb-card-comment">{feedback.comment}</p>

      {/* Evidence */}
      {feedback.evidence && (
        <div className="fb-card-evidence">
          <span className="fb-evidence-label">Lý do:</span>{" "}
          {feedback.evidence}
        </div>
      )}

      {/* Suggested Fix */}
      {feedback.suggested_fix && (
        <div className="fb-card-fix" style={{ marginTop: "10px", padding: "10px", background: "rgba(201, 35, 40, 0.02)", borderRadius: "var(--radius)", border: "1px solid var(--border-light)" }}>
          <div className="fb-fix-header" style={{ display: "flex", alignItems: "center", fontWeight: 600, fontSize: "0.85rem", marginBottom: "6px" }}>
            <LightbulbIcon size={12} style={{ marginRight: "4px", color: "var(--primary)" }} />
            <span>Gợi ý sửa:</span>
          </div>
          <div className="fb-fix-diff" style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.85rem", margin: "4px 0" }}>
            <del className="fb-fix-old" style={{ color: "#C92328", textDecoration: "line-through" }}>{feedback.suggested_fix.original_text}</del>
            <ins className="fb-fix-new" style={{ color: "#2E7559", textDecoration: "none", fontWeight: 500 }}>{feedback.suggested_fix.replacement_text}</ins>
          </div>
          {feedback.suggested_fix.explanation && (
            <p className="fb-fix-explanation" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>{feedback.suggested_fix.explanation}</p>
          )}
          
          {feedback.suggested_fix.fix_status === "pending" && (onAcceptFix || onRejectFix) && (
            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              {onAcceptFix && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAcceptFix(feedback.id); }}
                  className="btn-success btn-xs"
                  style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "4px", background: "#2E7559", color: "#fff", border: "none", cursor: "pointer" }}
                >
                  Áp dụng
                </button>
              )}
              {onRejectFix && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRejectFix(feedback.id); }}
                  className="btn-secondary btn-xs"
                  style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "4px", cursor: "pointer" }}
                >
                  Từ chối
                </button>
              )}
            </div>
          )}

          {feedback.suggested_fix.fix_status !== "pending" && (
            <div style={{ marginTop: "8px", fontSize: "0.75rem", fontWeight: 600, color: feedback.suggested_fix.fix_status === "accepted" ? "#2E7559" : "#C92328" }}>
              Sửa: {feedback.suggested_fix.fix_status === "accepted" ? "Đã áp dụng" : "Đã từ chối"}
            </div>
          )}
        </div>
      )}

      {/* Footer Actions */}
      <div style={{
        marginTop: "12px",
        borderTop: "1px solid var(--border-light)",
        paddingTop: "8px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <span className="text-xs text-muted" style={{ fontSize: "0.75rem" }}>
          {statusLabel(feedback.status)}
        </span>
        <div style={{ display: "flex", gap: "6px" }}>
          {feedback.status === "active" && onResolve && (
            <button
              onClick={(e) => { e.stopPropagation(); onResolve(feedback.id); }}
              className="btn-success btn-xs"
              style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "4px", background: "#2E7559", color: "#fff", border: "none", cursor: "pointer" }}
            >
              Giải quyết
            </button>
          )}
          {feedback.status === "active" && onDismiss && (
            <button
              onClick={(e) => { e.stopPropagation(); onDismiss(feedback.id); }}
              className="btn-secondary btn-xs"
              style={{ padding: "4px 8px", fontSize: "0.75rem", borderRadius: "4px", cursor: "pointer" }}
            >
              Bỏ qua
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
