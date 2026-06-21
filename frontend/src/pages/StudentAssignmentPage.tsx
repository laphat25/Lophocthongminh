import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { getAssignment, getMySubmissions, submitText, submitFile, getGrade, acceptFix, rejectFix } from "../api/client";
import type { Assignment, Submission, GradingResult } from "../types";
import type { FeedbackItem } from "../types/feedback";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import HighlightedText from "../components/HighlightedText";
import FeedbackPanel from "../components/FeedbackPanel";
import { useAnchorNavigation } from "../hooks/useAnchorNavigation";

export default function StudentAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [mySub, setMySub] = useState<Submission | null>(null);
  const [grading, setGrading] = useState<GradingResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [submitMode, setSubmitMode] = useState<"text" | "file">("text");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [agree, setAgree] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showResubmitForm, setShowResubmitForm] = useState(false);

  const handleAcceptFix = async (id: string) => {
    try {
      const updated = await acceptFix(id);
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi khi áp dụng sửa");
    }
  };

  const handleRejectFix = async (id: string) => {
    try {
      const updated = await rejectFix(id);
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi khi từ chối sửa");
    }
  };

  const API_HOST = import.meta.env.VITE_API_HOST || "http://localhost:8000";

  // Feedback anchoring state for student
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const { submissionRef, scrollToAnchor, scrollToFeedback, registerFeedbackRef } = useAnchorNavigation();

  const fetchData = async () => {
    if (!assignmentId) return;
    try {
      const [asgn, subs] = await Promise.all([
        getAssignment(assignmentId),
        getMySubmissions(),
      ]);
      setAssignment(asgn);
      const found = subs.submissions.find((s) => s.assignment_id === assignmentId) || null;
      setMySub(found);

      if (found && found.status === "published") {
        try {
          const g = await getGrade(found.id);
          setGrading(g.grading);
          if (g.feedbacks) {
            setFeedbacks(g.feedbacks);
          }
        } catch (err) {
          console.warn("Không thể tải chi tiết điểm:", err);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleHighlightClick = useCallback((feedbackIds: string[]) => {
    if (feedbackIds.length > 0) {
      setActiveFeedbackId(feedbackIds[0]);
      scrollToFeedback(feedbackIds[0]);
    }
  }, [scrollToFeedback]);

  const handleFeedbackClick = useCallback((feedbackId: string) => {
    setActiveFeedbackId(feedbackId);
    scrollToAnchor(feedbackId);
  }, [scrollToAnchor]);

  useEffect(() => { fetchData(); }, [assignmentId]);

  const isDeadlinePassed = assignment?.deadline && new Date(assignment.deadline) < new Date();

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentId || !textContent.trim()) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const sub = await submitText(assignmentId, textContent);
      setMySub(sub);
      setMsg({ text: "Nộp bài thành công!", type: "success" });
      setShowResubmitForm(false);
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Lỗi nộp bài", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSubmit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !assignmentId) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const sub = await submitFile(assignmentId, file);
      setMySub(sub);
      setMsg({ text: `Nộp file "${file.name}" thành công!`, type: "success" });
      setShowResubmitForm(false);
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : "Lỗi nộp file", type: "error" });
    } finally {
      setSubmitting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const triggerFileSelect = () => {
    if (!agree) {
      alert("Vui lòng tích chọn đồng ý cam kết tự làm bài trước khi nộp file.");
      return;
    }
    fileRef.current?.click();
  };

  if (loading) return <div className="page-layout"><Navbar /><div className="loading-state">Đang tải...</div></div>;

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link to="/student">Dashboard</Link> / {assignment?.title}
            </div>
            <h1 className="page-title">{assignment?.title}</h1>
            <p className="page-sub">
              {assignment?.class_name} ·
              Hạn: {assignment?.deadline ? new Date(assignment.deadline).toLocaleString("vi-VN") : "Không giới hạn"}
              {isDeadlinePassed && <span className="badge badge-danger" style={{ marginLeft: "10px" }}>Hết hạn</span>}
            </p>
          </div>
        </div>

        {/* Assignment description */}
        {assignment?.description && (
          <div className="glass description-box">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Đề bài
            </h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{assignment.description}</p>
          </div>
        )}



        {/* Result if graded and published */}
        {grading && grading.status === "published" && (
          <div className="glass result-box animate-fade-in">
            <h3>🎯 Kết quả chấm bài</h3>
            <div className="result-total">
              <span className="result-score">{grading.total_score}</span>
              <span className="result-max">/100</span>
            </div>

            {grading.overall_comment && (
              <div className="overall-comment">
                <strong>Nhận xét tổng thể:</strong>
                <p>{grading.overall_comment}</p>
              </div>
            )}

            <div className="criteria-results">
              {grading.criteria_scores.map((cs) => (
                <div key={cs.criteria_id} className="criteria-result-item">
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{cs.criteria_name}</strong>
                    <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                      {cs.final_score}/{cs.max_score}
                    </span>
                  </div>
                  {cs.teacher_comment && (
                    <p className="text-sm text-muted mt-8">{cs.teacher_comment}</p>
                  )}
                  <div className="criteria-progress">
                    <div
                      className="criteria-progress-fill"
                      style={{ width: `${(cs.final_score / cs.max_score) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Graded Workspace (Submission Highlights + Feedback Panel) */}
        {grading && grading.status === "published" && feedbacks.length > 0 && (
          <div className="grading-layout mt-16">
            {/* Left Column: Submission Highlights */}
            <div className="grading-submission glass" ref={submissionRef}>
              <h3 className="panel-title" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                Bài làm của bạn
              </h3>
              {mySub?.content_text ? (
                <div className="submission-text-container">
                  <HighlightedText
                    text={mySub.content_text}
                    feedbacks={feedbacks}
                    activeFeedbackId={activeFeedbackId}
                    onHighlightClick={handleHighlightClick}
                    submissionRef={submissionRef}
                    isTeacher={false}
                  />
                </div>
              ) : (
                <p className="text-muted">Không tìm thấy nội dung văn bản bài làm.</p>
              )}
            </div>

            {/* Right Column: Feedback cards list */}
            <div className="grading-sidebar">
              <div className="card" style={{ padding: "16px 20px" }}>
                <FeedbackPanel
                  feedbacks={feedbacks}
                  activeFeedbackId={activeFeedbackId}
                  onFeedbackClick={handleFeedbackClick}
                  registerRef={registerFeedbackRef}
                  onAcceptFix={handleAcceptFix}
                  onRejectFix={handleRejectFix}
                />
              </div>
            </div>
          </div>
        )}

        {/* Submission form */}
        {(!mySub || (mySub && assignment?.allow_resubmit && showResubmitForm)) && !isDeadlinePassed && (
          <div className="glass description-box">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Nộp bài
            </h3>

            {assignment?.submission_type === "both" && (
              <div className="submit-mode-tabs">
                <button className={`tab ${submitMode === "text" ? "tab-active" : ""}`} onClick={() => setSubmitMode("text")}>
                  Văn bản
                </button>
                <button className={`tab ${submitMode === "file" ? "tab-active" : ""}`} onClick={() => setSubmitMode("file")}>
                  Upload file
                </button>
              </div>
            )}

            {msg && <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>{msg.text}</div>}

            <label style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "12px",
              background: "rgba(201, 35, 40, 0.03)",
              borderRadius: "var(--radius)",
              border: "1px solid rgba(201, 35, 40, 0.1)",
              marginBottom: "16px",
              cursor: "pointer",
              fontSize: "0.85rem"
            }}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
                disabled={submitting}
              />
              <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                Tôi cam kết đây là bài tự làm, không sao chép và đồng ý nộp bài chấm điểm.
              </span>
            </label>

            {(assignment?.submission_type === "text" || (assignment?.submission_type === "both" && submitMode === "text")) && (
              <form onSubmit={handleTextSubmit}>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Nhập bài làm của bạn vào đây..."
                  rows={12}
                  className="submit-textarea"
                  required
                  disabled={submitting}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                  <span className="text-sm text-muted">{textContent.split(/\S+/).filter(Boolean).length} từ</span>
                  <button type="submit" className="btn-primary" disabled={submitting || !agree} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {submitting ? (
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
                        Đang nộp...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Nộp bài
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {(assignment?.submission_type === "file" || (assignment?.submission_type === "both" && submitMode === "file")) && (
              <div
                className="file-upload-zone"
                onClick={triggerFileSelect}
                style={{
                  opacity: agree ? 1 : 0.55,
                  cursor: agree ? "pointer" : "not-allowed",
                  borderStyle: agree ? "dashed" : "solid",
                  borderColor: agree ? "var(--primary)" : "var(--border)"
                }}
              >
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" onChange={handleFileSubmit} style={{ display: "none" }} disabled={submitting || !agree} />
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={agree ? "var(--primary)" : "var(--text-muted)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "8px" }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <p>{submitting ? "Đang upload..." : (agree ? "Click để chọn file (PDF, DOCX, TXT)" : "Vui lòng tích chọn đồng ý cam kết tự làm bài trước khi nộp file")}</p>
              </div>
            )}
          </div>
        )}

        {/* Already submitted */}
        {mySub && (
          <div className="glass description-box">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Đã nộp bài
            </h3>
            <p className="text-muted">Nộp lúc: {new Date(mySub.submitted_at).toLocaleString("vi-VN")}</p>
            <p className="text-muted">Số từ: {mySub.word_count.toLocaleString()}</p>
            <p>
              Trạng thái: <span className={`badge ${mySub.status === "published" ? "badge-success" : "badge-accent"}`}>
                {mySub.status === "published" ? "Có điểm" : mySub.status}
              </span>
            </p>
            {mySub.file_url && (
              <p className="mt-8">
                <a
                  href={`${API_HOST}${mySub.file_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-accent btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Tải file đã nộp: {mySub.file_name}
                </a>
              </p>
            )}
            {grading && grading.status !== "published" && (
              <p className="text-muted text-sm mt-8" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)" }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Điểm đang được xử lý, chưa được công bố.
              </p>
            )}
            {assignment?.allow_resubmit && !isDeadlinePassed && (
              <div style={{ marginTop: "16px", display: "flex", gap: "8px" }}>
                {!showResubmitForm ? (
                  <button
                    onClick={() => setShowResubmitForm(true)}
                    className="btn-primary btn-sm"
                  >
                    Nộp lại bài tập
                  </button>
                ) : (
                  <button
                    onClick={() => setShowResubmitForm(false)}
                    className="btn-secondary btn-sm"
                  >
                    Hủy nộp lại
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
