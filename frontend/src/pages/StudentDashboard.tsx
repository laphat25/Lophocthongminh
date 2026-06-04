import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getClasses, joinClass, getAssignments, getMySubmissions } from "../api/client";
import type { ClassItem, Assignment, Submission } from "../types";
import Navbar from "../components/Navbar";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchData = async () => {
    try {
      const [clsData, asgData, subsData] = await Promise.all([
        getClasses(),
        getAssignments(),
        getMySubmissions(),
      ]);
      setClasses(clsData.classes);
      setAssignments(asgData.assignments);
      setMySubmissions(subsData.submissions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinMsg(null);
    try {
      const res = await joinClass(joinCode.trim().toUpperCase());
      setJoinMsg({ text: res.message, type: "success" });
      setJoinCode("");
      fetchData();
    } catch (err) {
      setJoinMsg({ text: err instanceof Error ? err.message : "Lỗi tham gia lớp", type: "error" });
    } finally {
      setJoining(false);
    }
  };

  const getSubmissionForAssignment = (assignmentId: string) =>
    mySubmissions.find((s) => s.assignment_id === assignmentId);

  if (loading) return <div className="page-layout"><Navbar /><div className="loading-state">Đang tải...</div></div>;

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title">Dashboard Sinh viên</h1>
            <p className="page-sub">Xin chào, <strong>{user?.full_name}</strong> 👋</p>
          </div>
        </div>

        {/* Join class */}
        {(activeTab === "all" || activeTab === "classes") && (
          <div className="glass join-class-card" style={{ maxWidth: "600px" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
              </svg>
              Tham gia lớp học
            </h3>
            <form onSubmit={handleJoin} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", pointerEvents: "none" }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Nhập mã lớp (VD: NJU7I3)"
                  style={{
                    textTransform: "uppercase",
                    paddingLeft: "36px",
                    fontWeight: 600,
                    letterSpacing: "0.5px"
                  }}
                  required
                  maxLength={6}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={joining} style={{ height: "38px", flexShrink: 0 }}>
                {joining ? "Đang tham gia..." : "Tham gia"}
              </button>
            </form>
            {joinMsg && (
              <p className={`mt-8 text-sm ${joinMsg.type === "success" ? "text-success" : "text-danger"}`}>
                {joinMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Assignments */}
        {(activeTab === "all" || activeTab === "assignments") && (
          <>
            <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
              Đề bài của tôi
            </h2>
            {assignments.length === 0 ? (
              <div className="empty-state">
                <p>Chưa có đề bài. Tham gia lớp học để thấy đề bài!</p>
              </div>
            ) : (
              <div className="grid-2">
                {assignments.map((a) => {
                  const mySub = getSubmissionForAssignment(a.id);
                  const isDeadlinePassed = a.deadline && new Date(a.deadline) < new Date();
                  return (
                    <Link key={a.id} to={`/student/assignments/${a.id}`} className="card card-hover">
                      <div className="card-header-row">
                        <h3>{a.title}</h3>
                        {mySub ? (
                          <span className={`badge ${mySub.status === "published" ? "badge-success" : "badge-accent"}`}>
                            {mySub.status === "published" ? "Có điểm" : "Đã nộp"}
                          </span>
                        ) : (
                          <span className={`badge ${isDeadlinePassed ? "badge-danger" : "badge-muted"}`}>
                            {isDeadlinePassed ? "Hết hạn" : "Chưa nộp"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted">{a.class_name}</p>
                      <p className="text-sm mt-8">
                        Hạn: {a.deadline ? new Date(a.deadline).toLocaleString("vi-VN") : "Không giới hạn"}
                      </p>
                      {mySub?.status === "published" && (
                        <div className="score-mini">
                          <span>Xem điểm →</span>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Enrolled classes */}
        {(activeTab === "all" || activeTab === "classes") && (
          <>
            <h2 className="section-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              Lớp học đã tham gia
            </h2>
            {classes.length === 0 ? (
              <div className="empty-state">
                <p>Bạn chưa tham gia lớp học nào. Nhập mã phía trên để tham gia!</p>
              </div>
            ) : (
              <div className="grid-3">
                {classes.map((cls) => (
                  <div key={cls.id} className="card">
                    <h3>{cls.class_name}</h3>
                    <p className="text-muted">{cls.subject}</p>
                    <p className="text-sm mt-8">GV: {cls.teacher_name}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
