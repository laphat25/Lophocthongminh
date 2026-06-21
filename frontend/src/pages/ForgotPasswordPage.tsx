import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function ForgotPasswordPage() {
  return (
    <div className="page-layout" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main className="main-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <div className="card glass animate-fade-in" style={{ maxWidth: "450px", width: "100%", padding: "40px", textAlign: "center" }}>
          <div style={{
            background: "rgba(201, 35, 40, 0.08)",
            borderRadius: "50%",
            width: "64px",
            height: "64px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px auto"
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 style={{ marginBottom: "12px", fontSize: "1.5rem" }}>Quên mật khẩu?</h2>
          <p className="text-secondary" style={{ marginBottom: "24px", lineHeight: "1.6" }}>
            Hệ thống hiện tại sử dụng phương thức quản lý ngoại tuyến. Vui lòng **liên hệ trực tiếp với Giảng viên** phụ trách lớp học của bạn để yêu cầu đặt lại mật khẩu mới.
          </p>
          <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "20px" }}>
            <Link to="/login" className="link-primary" style={{ fontWeight: 500 }}>
              Quay lại trang Đăng nhập
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
