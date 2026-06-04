import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getAssignmentGrades, getGradesExportUrl } from "../api/client";
import type { GradeRow, GradeStats, RubricCriteria } from "../types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Navbar from "../components/Navbar";

export default function GradesReportPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [stats, setStats] = useState<GradeStats | null>(null);
  const [rubric, setRubric] = useState<RubricCriteria[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assignmentId) return;
    getAssignmentGrades(assignmentId)
      .then((data) => { setGrades(data.grades); setStats(data.stats); setRubric(data.rubric); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assignmentId]);

  // Build histogram data (buckets: 0-9, 10-19, ..., 90-100)
  const histogramData = Array.from({ length: 11 }, (_, i) => ({
    label: i === 10 ? "100" : `${i * 10}-${i * 10 + 9}`,
    count: 0,
  }));
  grades.forEach((g) => {
    if (g.total_score !== null) {
      const bucket = Math.min(10, Math.floor(g.total_score / 10));
      histogramData[bucket].count++;
    }
  });

  const token = localStorage.getItem("auth_token") || "";
  const exportUrl = `${getGradesExportUrl(assignmentId!)}`;

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
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Bảng điểm tổng hợp
            </h1>
          </div>
          <a
            href={exportUrl}
            className="btn-success"
            download
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            onClick={(e) => {
              // add auth header via fetch since anchor can't send headers
              e.preventDefault();
              fetch(exportUrl, { headers: { Authorization: `Bearer ${token}` } })
                .then((r) => r.blob())
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url; a.download = "grades.csv"; a.click();
                });
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Xuất CSV
          </a>
        </div>

        {/* Stats */}
        {stats && (
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-value">{stats.count}</span>
              <span className="stat-label">Bài đã chấm</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{stats.avg}</span>
              <span className="stat-label">Điểm TB</span>
            </div>
            <div className="stat-item">
              <span className="stat-value text-success">{stats.max}</span>
              <span className="stat-label">Cao nhất</span>
            </div>
            <div className="stat-item">
              <span className="stat-value text-danger">{stats.min}</span>
              <span className="stat-label">Thấp nhất</span>
            </div>
            <div className="stat-item">
              <span className="stat-value text-success">{stats.pass_count}</span>
              <span className="stat-label">Đạt</span>
            </div>
            <div className="stat-item">
              <span className="stat-value text-danger">{stats.fail_count}</span>
              <span className="stat-label">Không đạt</span>
            </div>
          </div>
        )}

        {/* Chart */}
        {stats && stats.count > 0 && (
          <div className="chart-container glass">
            <h3>Phân phối điểm</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={histogramData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "8px" }}
                  labelStyle={{ color: "var(--text-primary)" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {histogramData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.count === 0 ? "var(--border)" : i >= 5 ? "var(--success)" : i >= 3 ? "var(--warning)" : "var(--danger)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Grade table */}
        <div className="table-container">
          {grades.length === 0 ? (
            <div className="empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '16px' }}>
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <p>Chưa có điểm nào</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sinh viên</th>
                  <th>Tổng điểm</th>
                  {rubric.map((c) => <th key={c.criteria_id}>{c.criteria_name}</th>)}
                  <th>Nhận xét</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {grades.map((g, idx) => {
                  const scoreMap: Record<string, number> = {};
                  g.criteria_scores.forEach((cs) => { scoreMap[cs.criteria_id] = cs.final_score; });
                  const isPassed = g.total_score !== null && g.total_score >= 50;
                  return (
                    <tr key={g.submission_id}>
                      <td className="text-muted">{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{g.student_name}</td>
                      <td>
                        {g.total_score !== null ? (
                          <span style={{ fontWeight: 700, color: isPassed ? "var(--success)" : "var(--danger)" }}>
                            {g.total_score}
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      {rubric.map((c) => (
                        <td key={c.criteria_id} className="text-muted">
                          {scoreMap[c.criteria_id] ?? "—"}
                        </td>
                      ))}
                      <td className="text-sm text-muted" style={{ maxWidth: "200px" }}>
                        {g.overall_comment || "—"}
                      </td>
                      <td>
                        <Link to={`/teacher/grade/${g.submission_id}`} className="btn-secondary btn-sm">Xem</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
