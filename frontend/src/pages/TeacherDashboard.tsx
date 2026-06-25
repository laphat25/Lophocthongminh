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

  const [geminiKey, setGeminiKey] = useState("");
  const [aiProvider, setAiProvider] = useState(user?.ai_provider || "default");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsInfo, setSettingsInfo] = useState<string | null>(null);

  useEffect(() => {
    // Clear all alerts when activeTab changes
    setSettingsSuccess(null);
    setSettingsError(null);
    setSettingsInfo(null);
    setError(null);
  }, [activeTab]);

  useEffect(() => {
    if (user?.ai_provider) {
      setAiProvider(user.ai_provider);
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
    setSettingsSuccess(null);
    setSettingsError(null);
    setSettingsInfo(null);
    setError(null);

    const key = geminiKey.trim();

    if (aiProvider === "gemini") {
      if (!user?.has_gemini_key && !key) {
        setSettingsError("Vui lòng nhập Gemini API Key của bạn.");
        return;
      }
      if (key) {
        if (!key.startsWith("AIzaSy") && !key.startsWith("AQ.")) {
          setSettingsError("Gemini API Key không hợp lệ. Khóa API phải bắt đầu bằng 'AIzaSy' hoặc 'AQ.'.");
          return;
        }
        if (key.length < 20) {
          setSettingsError("Gemini API Key quá ngắn. Vui lòng kiểm tra lại khóa API của bạn.");
          return;
        }
      }
    } else {
      if (key) {
        if (!key.startsWith("AIzaSy") && !key.startsWith("AQ.")) {
          setSettingsError("Gemini API Key không hợp lệ. Khóa API phải bắt đầu bằng 'AIzaSy' hoặc 'AQ.'.");
          return;
        }
        if (key.length < 20) {
          setSettingsError("Gemini API Key quá ngắn. Vui lòng kiểm tra lại khóa API của bạn.");
          return;
        }
      }
    }

    setSavingSettings(true);
    try {
      const res = await updateUserSettings({ 
        gemini_api_key: key || undefined, 
        ai_provider: aiProvider 
      });
      setSettingsSuccess(res.message);
      updateUser(res.user);
      setGeminiKey("");
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Lỗi lưu cài đặt");
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
              Cài đặt Hệ thống & AI
            </h2>
            <p className="text-muted" style={{ marginBottom: "1.5rem" }}>
              Thiết lập cấu hình nhà cung cấp AI phục vụ việc chấm điểm bài tập tự động và sinh tiêu chí đánh giá (Rubric).
            </p>

            {settingsError && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{settingsError}</div>}
            {settingsSuccess && <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>{settingsSuccess}</div>}
            {settingsInfo && <div className="alert alert-info" style={{ marginBottom: "1.5rem" }}>{settingsInfo}</div>}

            <form onSubmit={handleSaveSettings}>
              {/* AI Provider Selection */}
              <div className="form-group" style={{ marginBottom: "1.8rem" }}>
                <label style={{ display: "block", marginBottom: "10px", fontWeight: 600 }}>Nhà cung cấp AI</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <label style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: aiProvider === "default" ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: aiProvider === "default" ? "rgba(201, 35, 40, 0.03)" : "none",
                    cursor: "pointer"
                  }}>
                    <input
                      type="radio"
                      name="aiProvider"
                      value="default"
                      checked={aiProvider === "default"}
                      onChange={() => setAiProvider("default")}
                      style={{ marginTop: "4px" }}
                    />
                    <div>
                      <strong style={{ display: "block", fontSize: "0.95rem" }}>Mặc định (Miễn phí từ Hệ thống)</strong>
                      <span className="text-xs text-muted" style={{ display: "block", marginTop: "4px" }}>
                        Sử dụng mô hình AI tốc độ cao (Llama 3) đã được cài đặt sẵn trên máy chủ. Bạn không cần tự chuẩn bị API Key.
                      </span>
                    </div>
                  </label>

                  <label style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "12px",
                    borderRadius: "8px",
                    border: aiProvider === "gemini" ? "2px solid var(--primary)" : "1px solid var(--border)",
                    background: aiProvider === "gemini" ? "rgba(201, 35, 40, 0.03)" : "none",
                    cursor: "pointer"
                  }}>
                    <input
                      type="radio"
                      name="aiProvider"
                      value="gemini"
                      checked={aiProvider === "gemini"}
                      onChange={() => setAiProvider("gemini")}
                      style={{ marginTop: "4px" }}
                    />
                    <div>
                      <strong style={{ display: "block", fontSize: "0.95rem" }}>Google Gemini cá nhân</strong>
                      <span className="text-xs text-muted" style={{ display: "block", marginTop: "4px" }}>
                        Sử dụng API Key cá nhân của bạn để gọi mô hình Gemini từ Google AI Studio (miễn phí).
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Gemini API Key input (only active or shown when gemini is selected) */}
              {aiProvider === "gemini" && (
                <div className="animate-fade-in" style={{ padding: "16px", background: "var(--bg-light)", borderRadius: "8px", border: "1px solid var(--border)", marginBottom: "1.5rem" }}>
                  {user?.has_gemini_key && (
                    <div style={{
                      marginBottom: "1.2rem",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      background: "rgba(46, 117, 89, 0.1)",
                      color: "#2E7559",
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontWeight: 500,
                      border: "1px solid rgba(46, 117, 89, 0.2)"
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      Khóa API Gemini đã hoạt động trong tài khoản của bạn.
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: "1rem" }}>
                    <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
                      {user?.has_gemini_key ? "Cập nhật Gemini API Key mới" : "Nhập Gemini API Key"}
                    </label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder={user?.has_gemini_key ? "Nhập API Key mới để ghi đè (để trống nếu không đổi)" : "Nhập API Key từ Google AI Studio (AIzaSy...)"}
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", background: "#ffffff" }}
                    />
                  </div>

                  {/* Step-by-step instructions */}
                  <div style={{
                    marginTop: "1.2rem",
                    paddingTop: "1.2rem",
                    borderTop: "1px solid var(--border)",
                    fontSize: "0.85rem",
                    lineHeight: "1.5"
                  }}>
                    <strong style={{ color: "var(--text-primary)", display: "block", marginBottom: "8px" }}>Hướng dẫn lấy Google API Key miễn phí:</strong>
                    <ol style={{ paddingLeft: "18px", margin: 0, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "6px" }}>
                      <li>
                        Truy cập trang <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }}>Google AI Studio</a> và đăng nhập bằng tài khoản Google.
                      </li>
                      <li>
                        Nhấn nút <strong>"Get API key"</strong> hoặc <strong>"Create API Key"</strong> ở góc trên bên trái.
                      </li>
                      <li>
                        Chọn tạo key cho project mới (hoặc project có sẵn), sau đó sao chép (copy) chuỗi ký tự hiển thị (dạng bắt đầu bằng <code>AIzaSy</code>).
                      </li>
                      <li>
                        Dán (paste) chuỗi vừa copy vào ô nhập ở trên và nhấn <strong>Lưu cài đặt</strong>.
                      </li>
                    </ol>
                  </div>
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={savingSettings || (aiProvider === (user?.ai_provider || "default") && geminiKey.trim() === "")} style={{ width: "100%", marginTop: "1rem" }}>
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

            {/* API Key Guide Banner if not configured */}
            {!user?.has_gemini_key && (
              <div className="card glass animate-fade-in" style={{
                background: "rgba(245, 158, 11, 0.04)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "12px",
                padding: "24px",
                marginBottom: "2rem",
                boxShadow: "0 4px 15px rgba(245, 158, 11, 0.05)"
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                  <div style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    borderRadius: "50%",
                    width: "40px",
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", fontWeight: 700, color: "#d97706" }}>
                      Yêu cầu cấu hình Gemini API Key
                    </h3>
                    <p style={{ margin: "0 0 16px 0", fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                      Để sử dụng tính năng tự động chấm bài và phân tích tiêu chí đánh giá (Rubric) bằng trí tuệ nhân tạo, thầy/cô cần thiết lập khóa API cá nhân. Làm theo hướng dẫn dưới đây để lấy khóa và cấu hình cho tài khoản:
                    </p>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px", fontSize: "0.85rem", color: "var(--text-primary)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 700, color: "#d97706" }}>1.</span>
                        <span>Truy cập trang <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: "#d97706", fontWeight: 600, textDecoration: "underline" }}>Google AI Studio</a> và đăng nhập bằng tài khoản Google của thầy/cô.</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 700, color: "#d97706" }}>2.</span>
                        <span>Nhấp vào nút <strong>"Create API Key"</strong> (hoặc "Get API key"), sau đó sao chép (copy) khóa API vừa tạo (khóa có dạng bắt đầu bằng <code>AIzaSy</code> hoặc <code>AQ.</code>).</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <span style={{ fontWeight: 700, color: "#d97706" }}>3.</span>
                        <span>Nhấp vào nút dưới đây để chuyển đến trang Cài đặt tài khoản và dán khóa API vào để lưu cấu hình.</span>
                      </div>
                    </div>

                    <button 
                      className="btn-primary" 
                      onClick={() => navigate("/teacher?tab=settings")}
                      style={{
                        background: "#d97706",
                        color: "#ffffff",
                        fontWeight: 600,
                        border: "none",
                        boxShadow: "0 2px 4px rgba(217, 119, 6, 0.15)"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#b45309"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#d97706"}
                    >
                      Cấu hình API Key ngay
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <h3 className="section-title">Thao tác nhanh</h3>
            <div className="grid-3" style={{ marginBottom: "2.5rem" }}>
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

              <Link to="/teacher/quick-grading" className="card card-hover" style={{ 
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
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                </div>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "1rem" }}>Chấm bài nhanh</h4>
                  <p className="text-sm text-muted" style={{ margin: 0 }}>Chấm bài trực tiếp không cần tạo lớp học</p>
                </div>
              </Link>
              
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
