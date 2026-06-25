import { useGrading } from "../../context/GradingContext";
import HighlightedText from "../HighlightedText";
import DOMPurify from "dompurify";

const API_HOST = import.meta.env.VITE_API_HOST || "http://localhost:8000";

export default function SubmissionPanel() {
  const {
    submission,
    feedbacks,
    activeFeedbackId,
    viewMode,
    setViewMode,
    docxHtml,
    docxLoading,
    verifyingCitations,
    submissionRef,
    handleHighlightClick,
    handleOpenAddModal,
    handleVerifyCitations,
  } = useGrading();

  return (
    <div className="grading-submission glass" style={{ display: "flex", flexDirection: "column" }}>
      <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
        Bài làm của sinh viên
      </h3>

      <div className="tabs" style={{ marginBottom: "16px" }}>
        <button
          type="button"
          className={`tab ${viewMode === "text" ? "tab-active" : ""}`}
          onClick={() => setViewMode("text")}
        >
          Văn bản trích xuất
        </button>
        {submission?.file_url && (
          <button
            type="button"
            className={`tab ${viewMode === "file" ? "tab-active" : ""}`}
            onClick={() => setViewMode("file")}
          >
            Xem file gốc ({submission.file_name?.toLowerCase().endsWith(".pdf") ? "PDF" : "Word"})
          </button>
        )}
        <button
          type="button"
          className={`tab ${viewMode === "citations" ? "tab-active" : ""}`}
          onClick={() => setViewMode("citations")}
        >
          Kiểm chứng Tài liệu tham khảo
        </button>
      </div>

      <div
        className="submission-text"
        style={
          viewMode === "file" && submission?.file_name?.toLowerCase().endsWith(".pdf")
            ? { overflow: "hidden", maxHeight: "none", padding: 0, flex: 1, minHeight: "550px" }
            : { flex: 1, minHeight: "550px" }
        }
      >
        {viewMode === "text" ? (
          submission?.content_text ? (
            <HighlightedText
              text={submission.content_text}
              feedbacks={feedbacks}
              activeFeedbackId={activeFeedbackId}
              onHighlightClick={handleHighlightClick}
              submissionRef={submissionRef}
              isTeacher={true}
              onAddManualFeedback={handleOpenAddModal}
            />
          ) : (
            <span className="text-muted">Không có nội dung</span>
          )
        ) : viewMode === "file" ? (
          submission?.file_url && (
            submission.file_name?.toLowerCase().endsWith(".pdf") ? (
              <iframe
                src={`${API_HOST}${submission.file_url}`}
                width="100%"
                height="100%"
                style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", minHeight: "550px" }}
              />
            ) : submission.file_name?.toLowerCase().endsWith(".docx") ? (
              <div style={{ height: "100%", overflowY: "auto", minHeight: "550px" }}>
                <style>{`
                  .docx-preview-container table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 16px 0;
                    background: #fff;
                  }
                  .docx-preview-container th, .docx-preview-container td {
                    border: 1px solid #ddd;
                    padding: 10px 14px;
                    text-align: left;
                    color: #333;
                  }
                  .docx-preview-container th {
                    background-color: #f7f7f7;
                    font-weight: 600;
                  }
                  .docx-preview-container p {
                    margin-bottom: 12px;
                    color: #333;
                  }
                `}</style>
                {docxLoading ? (
                  <div style={{ padding: "20px", color: "var(--text-secondary)" }}>Đang tải bản xem trước file Word...</div>
                ) : (
                  <div
                    className="docx-preview-container glass"
                    style={{
                      padding: "24px",
                      background: "#ffffff",
                      color: "#333333",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--border)",
                      minHeight: "550px",
                      fontFamily: "var(--font-sans, 'Inter', sans-serif)",
                      lineHeight: "1.6"
                    }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(docxHtml || "") }}
                  />
                )}
              </div>
            ) : (
              <div style={{
                padding: "24px",
                background: "var(--bg-primary)",
                borderRadius: "var(--radius)",
                textAlign: "center",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)"
              }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "12px", opacity: 0.7 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p style={{ fontWeight: 500, marginBottom: "8px" }}>File TXT không hỗ trợ xem trực tiếp.</p>
                <p className="text-sm text-muted" style={{ marginBottom: "16px" }}>Vui lòng tải file về máy để xem định dạng gốc hoặc dùng tab "Văn bản trích xuất" bên cạnh.</p>
                <a
                  href={`${API_HOST}${submission.file_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary btn-sm"
                  style={{ display: "inline-flex" }}
                >
                  Tải file về máy
                </a>
              </div>
            )
          )
        ) : (
          <div style={{ padding: "8px", minHeight: "550px", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h4 style={{ margin: 0, color: "var(--text-primary)" }}>Kiểm chứng tài liệu tham khảo</h4>
              <button
                type="button"
                className="btn-secondary btn-sm"
                disabled={verifyingCitations}
                onClick={handleVerifyCitations}
              >
                {verifyingCitations ? "Đang quét..." : "Quét / Kiểm chứng lại"}
              </button>
            </div>
            
            {!submission?.citation_report || !submission.citation_report.has_citations ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: "16px" }}>
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <p style={{ marginBottom: "16px", color: "var(--text-secondary)" }}>
                  Hệ thống chưa quét hoặc không nhận diện được phần "Tài liệu tham khảo" trong bài làm này.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={verifyingCitations}
                  onClick={handleVerifyCitations}
                >
                  {verifyingCitations ? "Đang quét..." : "Bắt đầu quét & kiểm tra"}
                </button>
              </div>
            ) : (
              <div>
                {/* Summary stats */}
                {(() => {
                  const items = submission.citation_report.citations;
                  const verifiedCount = items.filter(c => c.status === "verified").length;
                  const localCount = items.filter(c => c.status === "local_document").length;
                  const suspiciousCount = items.filter(c => c.status === "suspicious").length;
                  
                  return (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "12px",
                      marginBottom: "24px",
                      textAlign: "center"
                    }}>
                      <div style={{ padding: "12px", background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: "6px" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#16a34a" }}>{verifiedCount}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Đã xác thực</div>
                      </div>
                      <div style={{ padding: "12px", background: "rgba(234, 179, 8, 0.08)", border: "1px solid rgba(234, 179, 8, 0.2)", borderRadius: "6px" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#ca8a04" }}>{localCount}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Tài liệu Việt Nam / SGK</div>
                      </div>
                      <div style={{ padding: "12px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "6px" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#dc2626" }}>{suspiciousCount}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Nghi vấn (Bịa tài liệu)</div>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Citation list */}
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {submission.citation_report.citations.map((c, i) => (
                    <div key={i} style={{
                      padding: "16px",
                      background: "var(--bg-light)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: "0.9rem"
                    }}>
                      {/* Citation Text */}
                      <div style={{ fontWeight: 500, marginBottom: "10px", lineHeight: "1.5" }}>{c.raw_text}</div>
                      
                      {/* Status badge */}
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
                        {c.status === "verified" && (
                          <>
                            <span style={{
                              display: "inline-block",
                              padding: "2px 8px",
                              background: "#dcfce7",
                              color: "#16a54a",
                              borderRadius: "12px",
                              fontSize: "0.75rem",
                              fontWeight: 600
                            }}>
                              Đã xác thực (CrossRef)
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                              Độ trùng khớp: {Math.round(c.score * 100)}%
                            </span>
                          </>
                        )}
                        {c.status === "local_document" && (
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            background: "#fef9c3",
                            color: "#a16207",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            fontWeight: 600
                          }}>
                            Văn bản / SGK Việt Nam
                          </span>
                        )}
                        {c.status === "suspicious" && (
                          <span style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            background: "#fee2e2",
                            color: "#dc2626",
                            borderRadius: "12px",
                            fontSize: "0.75rem",
                            fontWeight: 600
                          }}>
                            Nghi vấn (Không tìm thấy)
                          </span>
                        )}
                      </div>
                      
                      {/* Verification detail */}
                      {c.status === "verified" && c.matched_title && (
                        <div style={{
                          padding: "8px 12px",
                          background: "#ffffff",
                          borderLeft: "3px solid #16a54a",
                          fontSize: "0.85rem",
                          color: "var(--text-secondary)"
                        }}>
                          <strong>Khớp học thuật:</strong> {c.matched_title}
                          {c.matched_url && (
                            <div style={{ marginTop: "4px" }}>
                              <a href={c.matched_url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>
                                Xem DOI bài viết ↗
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {c.status === "suspicious" && (
                        <div style={{
                          padding: "8px 12px",
                          background: "#ffffff",
                          borderLeft: "3px solid #dc2626",
                          fontSize: "0.85rem",
                          color: "#991b1b"
                        }}>
                          Không tìm thấy bài báo/tài liệu tương đương trên hệ thống chỉ mục quốc tế CrossRef. Vui lòng đối chiếu tính chân thực để tránh trường hợp học sinh dùng AI bịa tài liệu tham khảo.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
