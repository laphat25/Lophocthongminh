import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getGrade, autoGrade, saveGrade, publishGrade } from "../api/client";
import type { GradingResult, Submission, RubricCriteria } from "../types";
import Navbar from "../components/Navbar";

export default function GradingPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [grading, setGrading] = useState<GradingResult | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [rubric, setRubric] = useState<RubricCriteria[]>([]);
  const [localScores, setLocalScores] = useState<Record<string, { final_score: number; teacher_comment: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overallComment, setOverallComment] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [running, setRunning] = useState(false);
  const [viewMode, setViewMode] = useState<"text" | "file">("text");
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);

  const fetchData = async () => {
    if (!submissionId) return;
    try {
      const data = await getGrade(submissionId);
      setGrading(data.grading);
      setSubmission(data.submission);
      setRubric(data.rubric);
      setOverallComment(data.grading.overall_comment || "");
      const scores: Record<string, { final_score: number; teacher_comment: string }> = {};
      data.grading.criteria_scores.forEach((cs) => {
        scores[cs.criteria_id] = { final_score: cs.final_score, teacher_comment: cs.teacher_comment };
      });
      setLocalScores(scores);
    } catch {
      // Not graded yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [submissionId]);

  useEffect(() => {
    if (viewMode === "file" && submission?.file_url && submission.file_name?.toLowerCase().endsWith(".docx")) {
      if (!docxHtml && !docxLoading) {
        setDocxLoading(true);
        const url = `http://localhost:8000${submission.file_url}`;
        fetch(url)
          .then((res) => {
            if (!res.ok) throw new Error("Không thể tải file Word");
            return res.arrayBuffer();
          })
          .then((arrayBuffer) => {
            const mammoth = (window as any).mammoth;
            if (mammoth) {
              return mammoth.convertToHtml({ arrayBuffer });
            } else {
              throw new Error("Thư viện Mammoth chưa được nạp");
            }
          })
          .then((result) => {
            setDocxHtml(result.value || "<p>File rỗng</p>");
          })
          .catch((err) => {
            console.error(err);
            setDocxHtml(`<p style="color:var(--error); padding: 20px;">Lỗi nạp bản xem trước file Word: ${err.message}</p>`);
          })
          .finally(() => {
            setDocxLoading(false);
          });
      }
    }
  }, [viewMode, submission, docxHtml, docxLoading]);

  const handleAutoGrade = async () => {
    if (!submissionId) return;
    setRunning(true);
    setMsg(null);
    try {
      const result = await autoGrade(submissionId);
      setGrading(result);
      setOverallComment(result.overall_comment || "");
      const scores: Record<string, { final_score: number; teacher_comment: string }> = {};
      result.criteria_scores.forEach((cs) => {
        scores[cs.criteria_id] = { final_score: cs.final_score, teacher_comment: cs.teacher_comment };
      });
      setLocalScores(scores);
      setMsg({ text: "AI đã chấm xong!", type: "success" });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Lỗi AI chấm", type: "error" });
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async () => {
    if (!submissionId || !grading) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        criteria_scores: grading.criteria_scores.map((cs) => ({
          criteria_id: cs.criteria_id,
          final_score: localScores[cs.criteria_id]?.final_score ?? cs.final_score,
          teacher_comment: localScores[cs.criteria_id]?.teacher_comment ?? cs.teacher_comment,
        })),
        overall_comment: overallComment,
      };
      const updated = await saveGrade(submissionId, payload);
      setGrading(updated);
      setMsg({ text: "Đã lưu điểm thành công!", type: "success" });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Lỗi lưu điểm", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!submissionId) return;
    try {
      await publishGrade(submissionId);
      setMsg({ text: "Đã công bố điểm cho sinh viên!", type: "success" });
      fetchData();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Lỗi công bố", type: "error" });
    }
  };

  const computeTotal = () => {
    if (!grading) return 0;
    let total = 0;
    grading.criteria_scores.forEach((cs) => {
      const score = localScores[cs.criteria_id]?.final_score ?? cs.final_score;
      if (cs.max_score > 0) total += (score / cs.max_score) * cs.weight;
    });
    return Math.round(total * 10) / 10;
  };

  if (loading) return <div className="page-layout"><Navbar /><div className="loading-state">Đang tải...</div></div>;

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content" style={{ maxWidth: "1400px" }}>
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
                  href={`http://localhost:8000${submission.file_url}`}
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

        {msg && <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>{msg.text}</div>}

        {/* Total score indicator */}
        {grading && (
          <div className="score-banner glass">
            <div className="score-circle">
              <span className="score-num">{computeTotal()}</span>
              <span className="score-max">/100</span>
            </div>
            <div>
              <p className="text-sm text-muted">Điểm tổng (tự động cập nhật)</p>
              <p className="text-sm">
                Trạng thái: <span className={`badge ${grading.status === "published" ? "badge-success" : "badge-accent"}`}>
                  {grading.status === "published" ? "Đã công bố" : "Đã chấm"}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Side-by-side layout */}
        <div className="grading-layout">
          {/* Left: Submission text */}
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

            {submission?.file_url && (
              <div className="tabs" style={{ marginBottom: "16px" }}>
                <button
                  className={`tab ${viewMode === "text" ? "tab-active" : ""}`}
                  onClick={() => setViewMode("text")}
                >
                  Văn bản trích xuất
                </button>
                <button
                  className={`tab ${viewMode === "file" ? "tab-active" : ""}`}
                  onClick={() => setViewMode("file")}
                >
                  Xem file gốc ({submission.file_name?.toLowerCase().endsWith(".pdf") ? "PDF" : "Word"})
                </button>
              </div>
            )}

            <div
              className="submission-text"
              style={
                viewMode === "file" && submission?.file_name?.toLowerCase().endsWith(".pdf")
                  ? { overflow: "hidden", maxHeight: "none", padding: 0, flex: 1, minHeight: "550px" }
                  : { flex: 1, minHeight: "550px" }
              }
            >
              {viewMode === "text" ? (
                <div style={{ whiteSpace: "pre-wrap" }}>
                  {submission?.content_text || <span className="text-muted">Không có nội dung</span>}
                </div>
              ) : (
                submission?.file_url && (
                  submission.file_name?.toLowerCase().endsWith(".pdf") ? (
                    <iframe
                      src={`http://localhost:8000${submission.file_url}`}
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
                          dangerouslySetInnerHTML={{ __html: docxHtml || "" }}
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
                        href={`http://localhost:8000${submission.file_url}`}
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
              )}
            </div>
          </div>

          {/* Right: Rubric criteria */}
          <div className="grading-rubric">
            {!grading ? (
              <div className="empty-state glass">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '16px' }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <p>Nhấn "Chạy AI Chấm" để nhận gợi ý điểm tự động</p>
              </div>
            ) : (
              <>
                {grading.criteria_scores.map((cs) => {
                  const local = localScores[cs.criteria_id] || { final_score: cs.final_score, teacher_comment: cs.teacher_comment };
                  const rubricCriteria = rubric.find((r) => r.criteria_id === cs.criteria_id);
                  return (
                    <div key={cs.criteria_id} className="criteria-card glass">
                      <div className="criteria-header">
                        <h4>{cs.criteria_name}</h4>
                        <span className="text-muted text-sm">Tối đa: {cs.max_score} · Trọng số: {cs.weight}%</span>
                      </div>

                      {/* AI suggestion */}
                      <div className="ai-suggestion">
                        <span className="ai-badge" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                          </svg>
                          AI đề xuất
                        </span>
                        <span className="ai-score">{cs.ai_suggested_score}/{cs.max_score}</span>
                        <span className="text-sm text-muted"> — {cs.ai_suggested_level}</span>
                      </div>

                      {/* Rubric levels reference */}
                      {rubricCriteria && (
                        <div className="levels-ref">
                          {rubricCriteria.levels.map((lv, i) => (
                            <span key={i} className={`level-badge ${lv.score === cs.ai_suggested_score ? "level-active" : ""}`}>
                              {lv.score}: {lv.description.slice(0, 30)}…
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Highlighted text */}
                      {cs.highlighted_text.length > 0 && (
                        <div className="highlights">
                          {cs.highlighted_text.map((t, i) => (
                            <p key={i} className="highlight-item">"{t}"</p>
                          ))}
                        </div>
                      )}

                      {/* Score input */}
                      <div className="score-input-row">
                        <label>Điểm giảng viên:</label>
                        <input
                          type="number"
                          min={0}
                          max={cs.max_score}
                          step={0.5}
                          value={local.final_score}
                          onChange={(e) =>
                            setLocalScores((prev) => ({
                              ...prev,
                              [cs.criteria_id]: { ...local, final_score: parseFloat(e.target.value) || 0 },
                            }))
                          }
                          className="score-input"
                        />
                        <span className="text-muted">/{cs.max_score}</span>
                      </div>

                      {/* Comment */}
                      <textarea
                        placeholder="Nhận xét cho tiêu chí này..."
                        value={local.teacher_comment}
                        onChange={(e) =>
                          setLocalScores((prev) => ({
                            ...prev,
                            [cs.criteria_id]: { ...local, teacher_comment: e.target.value },
                          }))
                        }
                        rows={2}
                        className="comment-input"
                      />
                    </div>
                  );
                })}

                {/* Overall comment */}
                <div className="criteria-card glass">
                  <h4>💬 Nhận xét tổng thể</h4>
                  <textarea
                    placeholder="Nhận xét chung về bài làm..."
                    value={overallComment}
                    onChange={(e) => setOverallComment(e.target.value)}
                    rows={3}
                    className="comment-input"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
