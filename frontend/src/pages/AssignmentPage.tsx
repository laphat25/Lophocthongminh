import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getAssignment, getAssignmentSubmissions, autoGrade, gradeAll, publishAll,
  triggerPlagiarismCheck, getPlagiarismReport,
  publishAssignment, closeAssignment, getWebSocketUrl,
} from "../api/client";
import type { Assignment, Submission } from "../types";
import Navbar from "../components/Navbar";

export default function AssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [batchGrading, setBatchGrading] = useState(false);
  const [batchPublishing, setBatchPublishing] = useState(false);
  const [plagStatus, setPlagStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [batchProgress, setBatchProgress] = useState<number | null>(null);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [plagProgress, setPlagProgress] = useState<number | null>(null);
  const [plagMsg, setPlagMsg] = useState<string | null>(null);

  const fetchData = async () => {
    if (!assignmentId) return;
    try {
      const [asgn, subs] = await Promise.all([
        getAssignment(assignmentId),
        getAssignmentSubmissions(assignmentId).catch(() => ({ submissions: [], total: 0 })),
      ]);
      setAssignment(asgn);
      setSubmissions(subs.submissions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  const handleAutoGrade = async (subId: string) => {
    setGradingId(subId);
    try {
      await autoGrade(subId);
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi chấm điểm");
    } finally {
      setGradingId(null);
    }
  };

  const handleGradeAll = async () => {
    if (!assignmentId) return;
    setBatchGrading(true);
    setBatchProgress(0);
    setBatchMsg("Đang kết nối...");
    setMsg(null);
    try {
      const res = await gradeAll(assignmentId);
      const taskId = res.task_id;
      if (!taskId) {
        setMsg({ text: res.message, type: "success" });
        setBatchGrading(false);
        setBatchProgress(null);
        setBatchMsg(null);
        fetchData();
        return;
      }

      const wsUrl = getWebSocketUrl(taskId);
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined) {
          setBatchProgress(data.progress);
        }
        if (data.message) {
          setBatchMsg(data.message);
        }

        if (data.status === "completed") {
          ws.close();
          setBatchGrading(false);
          setBatchProgress(null);
          setBatchMsg(null);
          setMsg({ text: data.message || "Đã chấm điểm hoàn tất", type: "success" });
          fetchData();
        } else if (data.status === "failed") {
          ws.close();
          setBatchGrading(false);
          setBatchProgress(null);
          setBatchMsg(null);
          setMsg({ text: data.error || "Có lỗi xảy ra khi chấm bài", type: "error" });
        }
      };

      ws.onerror = () => {
        ws.close();
        // Fallback: wait a bit and refresh
        setTimeout(() => {
          setBatchGrading(false);
          setBatchProgress(null);
          setBatchMsg(null);
          fetchData();
        }, 5000);
      };
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Lỗi chấm tất cả", type: "error" });
      setBatchGrading(false);
      setBatchProgress(null);
      setBatchMsg(null);
    }
  };

  const handlePublishAll = async () => {
    if (!assignmentId) return;
    setBatchPublishing(true);
    setMsg(null);
    try {
      const res = await publishAll(assignmentId);
      setMsg({ text: res.message, type: "success" });
      fetchData();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Lỗi công bố", type: "error" });
    } finally {
      setBatchPublishing(false);
    }
  };

  const handlePlagCheck = async () => {
    if (!assignmentId) return;
    setPlagStatus("checking");
    setPlagProgress(0);
    setPlagMsg("Đang kết nối...");
    try {
      const res = await triggerPlagiarismCheck(assignmentId);
      const taskId = res.task_id;
      if (!taskId) {
        setPlagStatus("done");
        setPlagProgress(null);
        setPlagMsg(null);
        fetchData();
        return;
      }

      const wsUrl = getWebSocketUrl(taskId);
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined) {
          setPlagProgress(data.progress);
        }
        if (data.message) {
          setPlagMsg(data.message);
        }

        if (data.status === "completed") {
          ws.close();
          setPlagStatus("done");
          setPlagProgress(null);
          setPlagMsg(null);
          fetchData();
        } else if (data.status === "failed") {
          ws.close();
          setPlagStatus(null);
          setPlagProgress(null);
          setPlagMsg(null);
          alert(data.error || "Lỗi kiểm tra đạo văn");
        }
      };

      ws.onerror = () => {
        ws.close();
        // Fallback to standard polling if WebSocket connection fails
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const report = await getPlagiarismReport(assignmentId);
            if (report.status === "completed") {
              clearInterval(poll);
              setPlagStatus("done");
              setPlagProgress(null);
              setPlagMsg(null);
              fetchData();
            }
          } catch (pollErr) {
            console.error("Polled plagiarism status error:", pollErr);
          }
          if (attempts > 20) {
            clearInterval(poll);
            setPlagStatus(null);
          }
        }, 1500);
      };
    } catch (e) {
      setPlagStatus(null);
      setPlagProgress(null);
      setPlagMsg(null);
      alert(e instanceof Error ? e.message : "Lỗi kiểm tra đạo văn");
    }
  };

  const statusColor = (status: Submission["status"]) => {
    const map: Record<string, string> = {
      submitted: "badge-muted",
      grading: "badge-warning",
      graded: "badge-accent",
      published: "badge-success",
    };
    return map[status] || "badge-muted";
  };

  const submittedCount = submissions.filter(s => s.status === "submitted").length;
  const gradedCount = submissions.filter(s => s.status === "graded").length;
  const publishedCount = submissions.filter(s => s.status === "published").length;

  if (loading) return <div className="page-layout"><Navbar /><div className="loading-state">Đang tải...</div></div>;

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link to="/teacher">Lớp học</Link> /
              <Link to={`/teacher/classes/${assignment?.class_id}`}> {assignment?.class_name}</Link> /
              {" "}{assignment?.title}
            </div>
            <h1 className="page-title">
              {assignment?.title}
              {" "}
              <span
                className={`badge ${assignment?.status === "published" ? "badge-success" : assignment?.status === "closed" ? "badge-danger" : "badge-muted"}`}
                style={{ fontSize: "0.7rem", verticalAlign: "middle" }}
              >
                {assignment?.status === "published" ? "Đang mở" : assignment?.status === "closed" ? "Đã đóng" : "Nháp"}
              </span>
            </h1>
            <p className="page-sub">
              {assignment?.rubric.length} tiêu chí ·
              Hạn: {assignment?.deadline ? new Date(assignment.deadline).toLocaleString("vi-VN") : "Không giới hạn"}
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {assignment?.status === "draft" && (
              <button className="btn-success" onClick={async () => { await publishAssignment(assignmentId!); fetchData(); }} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 2 15 22 11 13 2 9 22 2" />
                  <line x1="22" y1="2" x2="11" y2="13" />
                </svg>
                Phát hành
              </button>
            )}
            {assignment?.status === "draft" && (
              <Link to={`/teacher/assignments/${assignmentId}/edit`} className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Chỉnh sửa
              </Link>
            )}
            {assignment?.status === "published" && (
              <button className="btn-danger" onClick={async () => { await closeAssignment(assignmentId!); fetchData(); }} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Đóng nhận bài
              </button>
            )}
            <Link to={`/teacher/assignments/${assignmentId}/grades`} className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Bảng điểm
            </Link>
            <Link to={`/teacher/assignments/${assignmentId}/plagiarism`} className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Đạo văn
            </Link>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {msg && <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>{msg.text}</div>}

        {/* Stats bar */}
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-value">{submissions.length}</span>
            <span className="stat-label">Tổng bài nộp</span>
          </div>
          <div className="stat-item">
            <span className="stat-value text-warning">{submittedCount}</span>
            <span className="stat-label">Chờ chấm</span>
          </div>
          <div className="stat-item">
            <span className="stat-value text-accent">{gradedCount}</span>
            <span className="stat-label">Đã chấm</span>
          </div>
          <div className="stat-item">
            <span className="stat-value text-success">{publishedCount}</span>
            <span className="stat-label">Đã công bố</span>
          </div>
          <div className="stat-item">
            <span className="stat-value text-danger">{submissions.filter(s => s.plagiarism_flagged).length}</span>
            <span className="stat-label">Nghi đạo văn</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="btn-accent"
              id="grade-all-btn"
              onClick={handleGradeAll}
              disabled={batchGrading || submittedCount === 0}
              title={submittedCount === 0 ? "Không có bài nào chờ chấm" : `Chấm AI tất cả ${submittedCount} bài`}
            >
              {batchGrading ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
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
                  Đang chấm...
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                  Chấm tất cả ({submittedCount})
                </span>
              )}
            </button>
            <button
              className="btn-success"
              id="publish-all-btn"
              onClick={handlePublishAll}
              disabled={batchPublishing || gradedCount === 0}
              title={gradedCount === 0 ? "Không có bài nào đã chấm" : `Công bố ${gradedCount} kết quả`}
            >
              {batchPublishing ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
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
                  Đang công bố...
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  Công bố tất cả ({gradedCount})
                </span>
              )}
            </button>
            <button
              className={`btn-secondary ${plagStatus === "checking" ? "loading-btn" : ""}`}
              onClick={handlePlagCheck}
              disabled={plagStatus === "checking" || submissions.length < 2}
            >
              {plagStatus === "checking" ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
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
                  Đang kiểm tra...
                </span>
              ) : plagStatus === "done" ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Kiểm tra lại
                </span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Kiểm tra đạo văn
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Task progress indicators */}
        {(batchProgress !== null || plagProgress !== null) && (
          <div style={{
            background: "rgba(var(--primary-rgb), 0.05)",
            border: "1px solid rgba(var(--primary-rgb), 0.15)",
            padding: "16px",
            borderRadius: "12px",
            marginBottom: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            {batchProgress !== null && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline" }}>
                      <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                    </svg>
                    Tiến trình chấm tự động: {batchMsg}
                  </span>
                  <span>{batchProgress}%</span>
                </div>
                <div style={{ background: "rgba(0,0,0,0.06)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ background: "var(--primary)", width: `${batchProgress}%`, height: "100%", transition: "width 0.3s ease" }}></div>
                </div>
              </div>
            )}
            {plagProgress !== null && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "600", marginBottom: "6px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline" }}>
                      <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                    </svg>
                    Tiến trình kiểm tra đạo văn: {plagMsg}
                  </span>
                  <span>{plagProgress}%</span>
                </div>
                <div style={{ background: "rgba(0,0,0,0.06)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ background: "var(--success)", width: `${plagProgress}%`, height: "100%", transition: "width 0.3s ease" }}></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submissions table */}
        <div className="table-container">
          {submissions.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '16px' }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <p>Chưa có bài nộp</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Sinh viên</th>
                  <th>Nộp lúc</th>
                  <th>Số từ</th>
                  <th>Đạo văn</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id}>
                    <td style={{ fontWeight: 600 }}>{sub.student_name}</td>
                    <td className="text-sm text-muted">{new Date(sub.submitted_at).toLocaleString("vi-VN")}</td>
                    <td className="text-muted">{sub.word_count.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${sub.plagiarism_flagged ? "badge-danger" : "badge-success"}`} style={{ display: "inline-flex", alignItems: "center" }}>
                        {sub.plagiarism_score.toFixed(1)}%
                        {sub.plagiarism_flagged && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "4px" }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        )}
                      </span>
                    </td>
                    <td><span className={`badge ${statusColor(sub.status)}`}>{sub.status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {sub.status === "submitted" && (
                          <button
                            className="btn-accent btn-sm"
                            onClick={() => handleAutoGrade(sub.id)}
                            disabled={gradingId === sub.id}
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            {gradingId === sub.id ? (
                              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="2" x2="12" y2="6" />
                                <line x1="12" y1="18" x2="12" y2="22" />
                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                                <line x1="2" y1="12" x2="6" y2="12" />
                                <line x1="18" y1="12" x2="22" y2="12" />
                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                              </svg>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                  <line x1="8" y1="21" x2="16" y2="21" />
                                  <line x1="12" y1="17" x2="12" y2="21" />
                                </svg>
                                AI Chấm
                              </>
                            )}
                          </button>
                        )}
                        <Link to={`/teacher/grade/${sub.id}`} className="btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          Xem/Sửa
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
