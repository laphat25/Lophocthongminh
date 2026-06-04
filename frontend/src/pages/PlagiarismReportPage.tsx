import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getPlagiarismReport, triggerPlagiarismCheck } from "../api/client";
import type { PlagiarismReport as PlagReport, PlagiarismPair } from "../types";
import Navbar from "../components/Navbar";

export default function PlagiarismReportPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [report, setReport] = useState<PlagReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchReport = async () => {
    if (!assignmentId) return;
    try {
      const r = await getPlagiarismReport(assignmentId);
      setReport(r);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [assignmentId]);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await triggerPlagiarismCheck(assignmentId!);
      // Poll
      let i = 0;
      const poll = setInterval(async () => {
        i++;
        await fetchReport();
        if (i > 20) clearInterval(poll);
      }, 1500);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setChecking(false);
    }
  };

  const flagStyle = (flag: PlagiarismPair["flag"]) => {
    if (flag === "severe") return { badge: "badge-danger", label: "Nghiêm trọng" };
    if (flag === "warning") return { badge: "badge-warning", label: "Cảnh báo" };
    return { badge: "badge-success", label: "Bình thường" };
  };

  if (loading) return <div className="page-layout"><Navbar /><div className="loading-state">Đang tải...</div></div>;

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link to={`/teacher/assignments/${assignmentId}`}>← Quay lại đề bài</Link>
            </div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Báo cáo đạo văn
            </h1>
            {report && (
              <p className="page-sub">
                Cập nhật: {new Date(report.generated_at).toLocaleString("vi-VN")} ·
                Trạng thái: <span className={`badge ${report.status === "completed" ? "badge-success" : "badge-warning"}`}>{report.status}</span>
              </p>
            )}
          </div>
          <button className="btn-primary" onClick={handleCheck} disabled={checking} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {checking ? (
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
                Đang kiểm tra...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Chạy lại kiểm tra
              </>
            )}
          </button>
        </div>

        {!report ? (
          <div className="empty-state glass">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '16px' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p>Chưa có báo cáo. Nhấn "Chạy lại kiểm tra" để bắt đầu.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="stats-bar" style={{ marginBottom: "24px" }}>
              <div className="stat-item">
                <span className="stat-value">{report.summary.total_submissions}</span>
                <span className="stat-label">Bài nộp</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{report.summary.total_pairs}</span>
                <span className="stat-label">Cặp so sánh</span>
              </div>
              <div className="stat-item">
                <span className="stat-value text-warning">{report.summary.flagged_pairs}</span>
                <span className="stat-label">Cặp đáng ngờ (≥40%)</span>
              </div>
              <div className="stat-item">
                <span className="stat-value text-danger">{report.summary.severe_pairs}</span>
                <span className="stat-label">Nghiêm trọng (≥70%)</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{report.summary.max_similarity_pct.toFixed(1)}%</span>
                <span className="stat-label">Tương đồng cao nhất</span>
              </div>
            </div>

            {/* Similarity pairs table */}
            <div className="table-container">
              <h3 style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
                Danh sách cặp bài tương đồng
                {report.pairs.filter(p => p.flag !== "ok").length > 0 && (
                  <span className="badge badge-danger" style={{ marginLeft: "12px" }}>
                    {report.pairs.filter(p => p.flag !== "ok").length} cảnh báo
                  </span>
                )}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Sinh viên A</th>
                    <th>Sinh viên B</th>
                    <th>Tương đồng</th>
                    <th>Mức độ</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {report.pairs.map((pair, idx) => {
                    const style = flagStyle(pair.flag);
                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{pair.student_a_name}</td>
                        <td style={{ fontWeight: 600 }}>{pair.student_b_name}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div className="similarity-bar">
                              <div
                                className="similarity-fill"
                                style={{
                                  width: `${pair.similarity_pct}%`,
                                  background: pair.flag === "severe" ? "var(--danger)" : pair.flag === "warning" ? "var(--warning)" : "var(--success)",
                                }}
                              />
                            </div>
                            <span style={{ fontWeight: 700, minWidth: "50px" }}>
                              {pair.similarity_pct.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${style.badge}`}>{style.label}</span>
                        </td>
                        <td>
                          <Link
                            to={`/teacher/assignments/${assignmentId}/plagiarism/pair/${pair.submission_a}/${pair.submission_b}`}
                            className="btn-secondary btn-sm"
                          >
                            So sánh
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
