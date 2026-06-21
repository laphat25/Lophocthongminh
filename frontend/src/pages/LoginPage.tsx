import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await loginUser(email, password);
      login(res.access_token, res.user);
      navigate(res.user.role === "teacher" ? "/teacher" : "/student");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass animate-fade-in">
        <div className="auth-logo">
          <span className="auth-logo-icon">🎓</span>
          <h1>AI Grading</h1>
          <p>Hệ thống chấm bài tự động</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2>Đăng nhập</h2>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Mật khẩu</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <div style={{ textAlign: "right", marginTop: "6px" }}>
              <Link to="/forgot-password" style={{ fontSize: "0.85rem", color: "var(--primary)" }}>
                Quên mật khẩu?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary btn-full"
            id="login-submit"
            disabled={loading}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>

          <p className="auth-switch">
            Chưa có tài khoản?{" "}
            <Link to="/register">Đăng ký ngay</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
