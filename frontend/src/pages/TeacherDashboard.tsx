import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getClasses, createClass, getAssignments, updateUserSettings, deleteClassApi } from "../api/client";
import type { ClassItem, Assignment } from "../types";
import Navbar from "../components/Navbar";

export default function TeacherDashboard() {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ class_name: "", subject: "", description: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [geminiKey, setGeminiKey] = useState(user?.gemini_api_key || "");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user?.gemini_api_key) {
      setGeminiKey(user.gemini_api_key);
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [clsData, asgData] = await Promise.all([
        getClasses(),
        getAssignments(),
      ]);
      setClasses(clsData.classes);
      setAssignments(asgData.assignments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createClass(form);
      setShowCreate(false);
      setForm({ class_name: "", subject: "", description: "" });
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tạo lớp");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(null);
    setError(null);
    try {
      const res = await updateUserSettings({ gemini_api_key: geminiKey });
      setSettingsSuccess(res.message);
      updateUser(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi lưu cài đặt");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header" style={{ marginBottom: activeTab === "all" ? "1rem" : "1.5rem" }}>
          <div>
            <h1 className="page-title">
              {activeTab === "classes" ? "Lớp học của tôi" : activeTab === "settings" ? "Cài đặt hệ thống" : "Dashboard Giảng viên"}
            </h1>
            {activeTab !== "all" && <p className="page-sub">Xin chào, <strong>{user?.full_name}</strong> 👋</p>}
          </div>
          {activeTab === "classes" && (
            <button className="btn-primary" id="create-class-btn" onClick={() => setShowCreate(true)}>
              + Tạo lớp mới
            </button>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {showCreate && (
          <div className="modal-overlay" onClick={() => setShowCreate(false)}>
            <div className="modal glass animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <h2>Tạo lớp học mới</h2>
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Tên lớp</label>
                  <input type="text" value={form.class_name} onChange={(e) => setForm(f => ({ ...f, class_name: e.target.value }))} placeholder="VD: Lớp CNTT-01" required />
                </div>
                <div className="form-group">
                  <label>Môn học</label>
                  <input type="text" value={form.subject} onChange={(e) => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="VD: Cơ sở dữ liệu" required />
                </div>
                <div className="form-group">
                  <label>Mô tả</label>
                  <input type="text" value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Mô tả ngắn..." />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Hủy</button>
                  <button type="submit" className="btn-primary" disabled={creating}>{creating ? "Đang tạo..." : "Tạo lớp"}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Đang tải...</div>
        ) : activeTab === "settings" ? (
          <div className="card glass animate-fade-in" style={{ maxWidth: "600px", margin: "2rem auto" }}>
            <h2 style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Cấu hình API Gemini
            </h2>
            <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
              Thiết lập khóa API của riêng bạn để hệ thống tự động chấm điểm bài tập của sinh viên thông qua mô hình trí tuệ nhân tạo Gemini (Miễn phí từ Google AI Studio).
            </p>

            {settingsSuccess && <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>{settingsSuccess}</div>}

            <form onSubmit={handleSaveSettings}>
              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>Gemini API Key</label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="Nhập API Key từ Google AI Studio (AIzaSy...)"
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)" }}
                />
                <span className="text-sm text-muted" style={{ display: "block", marginTop: "8px", lineHeight: "1.4" }}>
                  Lưu ý: Khóa API này được lưu bảo mật trong tài khoản của bạn. Để lấy khóa API miễn phí, vui lòng truy cập{" "}
                  <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", textDecoration: "underline" }}>
                    Google AI Studio
                  </a>.
                </span>
              </div>

              <button type="submit" className="btn-primary" disabled={savingSettings} style={{ width: "100%" }}>
                {savingSettings ? "Đang lưu..." : "Lưu cài đặt"}
              </button>
            </form>
          </div>
        ) : activeTab === "all" ? (
          <div className="teacher-home-dashboard animate-fade-in">
            {/* Welcome Hero Banner */}
            <div className="dashboard-hero-banner" style={{
              background: "linear-gradient(135deg, #C92328 0%, #E63946 50%, #F58220 100%)",
              color: "#ffffff",
              padding: "28px 32px",
              borderRadius: "12px",
              marginBottom: "2rem",
              boxShadow: "0 10px 25px rgba(201, 35, 40, 0.15)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "relative",
              overflow: "hidden"
            }}>
              {/* Subtle background graphics/pattern */}
              <div style={{
                position: "absolute",
                right: "-20px",
                bottom: "-20px",
                opacity: 0.12,
                pointerEvents: "none"
              }}>
                <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.5">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>

              <div style={{ zIndex: 1 }}>
                <h2 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 700, color: "#ffffff", display: "flex", alignItems: "center", gap: "8px" }}>
                  Xin chào, {user?.full_name}! 🎓
                </h2>
                <p style={{ margin: "8px 0 0 0", fontSize: "0.95rem", opacity: 0.9, color: "rgba(255, 255, 255, 0.9)", lineHeight: "1.5" }}>
                  Chào mừng thầy/cô quay lại hệ thống <strong>Lớp học thông minh</strong>. Chúc thầy/cô một ngày giảng dạy và làm việc đầy năng lượng!
                </p>
              </div>

              {/* Stats Card inside the Hero Banner for a very compact and clean layout */}
              <div className="hero-stat-box" style={{
                background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(8px)",
                padding: "16px 28px",
                borderRadius: "10px",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                transition: "all 0.2s ease",
                zIndex: 1
              }}
              onClick={() => navigate("/teacher?tab=classes")}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
              }}
              >
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "rgba(255, 255, 255, 0.9)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Lớp học đang dạy</span>
                <span style={{ fontSize: "2.8rem", fontWeight: 800, color: "#ffffff", marginTop: "4px", lineHeight: 1 }}>{classes.length}</span>
              </div>
            </div>

            {/* Quick Actions */}
            <h3 className="section-title">Thao tác nhanh</h3>
            <div className="grid-2" style={{ marginBottom: "2.5rem" }}>
              <div className="card card-hover" style={{ 
                cursor: "pointer", 
                display: "flex", 
                alignItems: "center", 
                gap: "16px",
                padding: "20px"
              }} onClick={() => { setShowCreate(true); navigate("/teacher?tab=classes"); }}>
                <div style={{
                  background: "rgba(201, 35, 40, 0.08)",
                  borderRadius: "10px",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem" }}>Tạo lớp học mới</h4>
                  <p className="text-sm text-muted" style={{ margin: 0 }}>Bắt đầu dạy một nhóm học sinh mới</p>
                </div>
              </div>
              
              <Link to="/teacher/rubrics" className="card card-hover" style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "16px",
                padding: "20px",
                textDecoration: "none"
              }}>
                <div style={{
                  background: "rgba(201, 35, 40, 0.08)",
                  borderRadius: "10px",
                  width: "48px",
                  height: "48px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                  </svg>
                </div>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem" }}>Thư viện Rubric</h4>
                  <p className="text-sm text-muted" style={{ margin: 0 }}>Xây dựng tiêu chí chấm bài chuẩn hóa</p>
                </div>
              </Link>
            </div>

            {/* Recent Assignments */}
            <h3 className="section-title">Đề bài đã giao gần đây</h3>
            {assignments.length === 0 ? (
              <div className="card empty-state" style={{ padding: "32px", textAlign: "center" }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ marginBottom: "12px", opacity: 0.7 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                <p style={{ margin: 0, color: "var(--text-secondary)" }}>Chưa có đề bài nào được giao. Hãy tạo lớp và giao đề bài đầu tiên!</p>
              </div>
            ) : (
              <div className="grid-2">
                {assignments.slice(0, 4).map((a) => (
                  <Link key={a.id} to={`/teacher/assignments/${a.id}`} className="card card-hover" style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "20px",
                    borderLeft: a.status === "published" ? "4px solid var(--primary)" : "4px solid var(--text-muted)"
                  }}>
                    <div>
                      <div className="card-header-row" style={{ alignItems: "flex-start", marginBottom: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</h3>
                        <span className={`badge ${a.status === "published" ? "badge-success" : "badge-muted"}`} style={{ flexShrink: 0 }}>
                          {a.status === "published" ? "Đã phát hành" : "Nháp"}
                        </span>
                      </div>
                      <p className="text-sm text-muted" style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        {a.class_name}
                      </p>
                    </div>
                    <div style={{
                      borderTop: "1px solid var(--border-light)",
                      paddingTop: "12px",
                      marginTop: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.8rem",
                      color: "var(--text-secondary)"
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      <span>Hạn nộp: {a.deadline ? new Date(a.deadline).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "Không giới hạn"}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : classes.length === 0 ? (
          <div className="empty-state">
            <p>Chưa có lớp học nào. Tạo lớp đầu tiên!</p>
          </div>
        ) : (
          <div className="grid-3 animate-fade-in">
            {classes.map((cls) => (
              <Link key={cls.id} to={`/teacher/classes/${cls.id}`} className="card card-hover" style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "20px",
                borderTop: "4px solid var(--primary)",
                minHeight: "150px"
              }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                    <h3 style={{ margin: 0, fontSize: "1.1rem" }}>{cls.class_name}</h3>
                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm(`Bạn chắc chắn muốn xóa lớp học "${cls.class_name}"? Mọi bài tập và điểm số trong lớp cũng sẽ bị xóa.`)) {
                          try {
                            await deleteClassApi(cls.id);
                            fetchData();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Lỗi xóa lớp học");
                          }
                        }
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        color: "var(--text-muted)",
                        display: "inline-flex",
                        alignItems: "center"
                      }}
                      title="Xóa lớp học"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#C92328" }}>
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                  <p className="text-muted text-sm" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                    </svg>
                    {cls.subject}
                  </p>
                  {cls.description && <p className="text-sm text-secondary" style={{ marginTop: "10px", fontStyle: "italic" }}>{cls.description}</p>}
                </div>
                <div className="card-footer" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "12px", marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge badge-accent">Mã lớp: {cls.class_code}</span>
                  <span className="text-xs text-muted" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    Chi tiết
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
