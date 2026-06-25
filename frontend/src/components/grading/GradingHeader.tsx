import { useGrading } from "../../context/GradingContext";

const API_HOST = import.meta.env.VITE_API_HOST || "http://localhost:8000";

export default function GradingHeader() {
  const {
    submission,
    grading,
    running,
    saving,
    handleAutoGrade,
    handleSave,
    handlePublish,
    computeTotal
  } = useGrading();

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Chấm bài: {submission?.student_name}</h1>
          <p className="page-sub">
            Nộp lúc: {submission ? new Date(submission.submitted_at).toLocaleString("vi-VN") : ""}
            · {submission?.word_count.toLocaleString()} từ
          </p>
          {submission?.file_url && (
            <p style={{ marginTop: "8px" }}>
              <a
                href={`${API_HOST}${submission.file_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Tải file gốc: {submission.file_name}
              </a>
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="btn-accent" onClick={handleAutoGrade} disabled={running} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {running ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
                Đang chấm AI...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                Chạy AI Chấm
              </>
            )}
          </button>
          {grading && (
            <>
              <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {saving ? (
                  "Đang lưu..."
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Lưu điểm
                  </>
                )}
              </button>
              {grading.status !== "published" && (
                <button className="btn-success" onClick={handlePublish} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  Công bố
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Total score indicator */}
      {grading && (
        <div className="score-banner glass" style={{ marginBottom: "20px" }}>
          <div className="score-circle">
            <span className="score-num">{computeTotal()}</span>
            <span className="score-max">/100</span>
          </div>
          <div>
            <p className="text-sm text-muted">Điểm tổng (tự động cập nhật)</p>
            <p className="text-sm">
              Trạng thái:{" "}
              <span className={`badge ${grading.status === "published" ? "badge-success" : "badge-accent"}`}>
                {grading.status === "published" ? "Đã công bố" : "Đã chấm"}
              </span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
