import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const initials = user?.full_name
    ? user.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (path: string) => {
    const currentPath = location.pathname + location.search;
    if (path.includes("?")) {
      return currentPath === path;
    }
    if (path === "/student") {
      return location.pathname === "/student" && !location.search;
    }
    if (path === "/teacher") {
      return location.pathname === "/teacher";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* ─── SIDEBAR NAVIGATION ─── */}
      <aside className="sidebar">
        <div className="sidebar-brand-container">
          <Link to={user?.role === "teacher" ? "/teacher" : "/student"} className="sidebar-brand">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="brand-logo-icon">
              {/* Simplified Red Gear and Compass (HUST Bách Khoa Style) */}
              <circle cx="12" cy="12" r="8" stroke="#C92328" strokeWidth="2.5" />
              <circle cx="12" cy="12" r="3.5" stroke="#C92328" strokeWidth="1.5" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2.5 2.5M16.5 16.5l2.5 2.5M5 19l2.5-2.5M16.5 7.5l2.5-2.5" stroke="#C92328" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="brand-text-red">BÁCH KHOA</span>
            <span className="brand-text-dark">ONLINE</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {user?.role === "teacher" ? (
            <>
              <Link to="/teacher" className={`sidebar-link ${isActive("/teacher") ? "sidebar-link-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Trang chủ
              </Link>
              <Link to="/teacher?tab=classes" className={`sidebar-link ${isActive("/teacher?tab=classes") || location.pathname.includes("/classes/") ? "sidebar-link-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Quản lý lớp học
              </Link>
              <Link to="/teacher/rubrics" className={`sidebar-link ${isActive("/teacher/rubrics") ? "sidebar-link-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                Thư viện Rubric
              </Link>
              <Link to="/teacher/guide" className={`sidebar-link ${isActive("/teacher/guide") ? "sidebar-link-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Hướng dẫn sử dụng
              </Link>
              <Link to="/teacher?tab=settings" className={`sidebar-link ${isActive("/teacher?tab=settings") ? "sidebar-link-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Cài đặt hệ thống
              </Link>
            </>
          ) : (
            <>
              <Link to="/student" className={`sidebar-link ${isActive("/student") ? "sidebar-link-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Trang chủ
              </Link>
              <Link to="/student?tab=assignments" className={`sidebar-link ${isActive("/student?tab=assignments") || location.pathname.includes("/assignments/") ? "sidebar-link-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
                Bài tập của tôi
              </Link>
              <Link to="/student?tab=classes" className={`sidebar-link ${isActive("/student?tab=classes") ? "sidebar-link-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                Lớp học của tôi
              </Link>
              <Link to="/student/guide" className={`sidebar-link ${isActive("/student/guide") ? "sidebar-link-active" : ""}`}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Hướng dẫn sử dụng
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="btn-switch-version-outlined" onClick={handleLogout}>
            Đăng xuất
          </button>
          <div className="sidebar-copyright">
            <p>Bách Khoa Online © 2026</p>
            <p>Copyright by HUST</p>
          </div>
        </div>
      </aside>

      <header className="top-header" style={{ justifyContent: "flex-end" }}>
        <div className="header-right">
          <div className="header-user-profile" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className="header-avatar" style={{
              width: "32px",
              height: "32px",
              background: "var(--accent-dim)",
              color: "var(--accent)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.78rem",
              fontWeight: 700,
              border: "1px solid rgba(201, 35, 40, 0.15)",
              flexShrink: 0
            }}>{initials}</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: "1.2" }}>
              <span className="header-user-name" style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{user?.full_name}</span>
              <span className="header-user-role" style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>{user?.role === "teacher" ? "Giảng viên" : "Sinh viên"}</span>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
