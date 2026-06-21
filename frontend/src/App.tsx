import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import ClassPage from "./pages/ClassPage";
import AssignmentPage from "./pages/AssignmentPage";
import NewAssignmentPage from "./pages/NewAssignmentPage";
import GradingPage from "./pages/GradingPage";
import PlagiarismReportPage from "./pages/PlagiarismReportPage";
import GradesReportPage from "./pages/GradesReportPage";
import StudentDashboard from "./pages/StudentDashboard";
import StudentAssignmentPage from "./pages/StudentAssignmentPage";
import EditAssignmentPage from "./pages/EditAssignmentPage";
import { getPlagiarismPair } from "./api/client";
import type { PlagiarismPairDetail } from "./types";
import Navbar from "./components/Navbar";
import { QuestionBankPage, RubricsLibraryPage, GuidePage } from "./pages/ExtraPages";

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="loading-state">Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role && user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="loading-state">Đang tải...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "teacher" ? "/teacher" : "/student"} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Teacher */}
      <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/classes/:classId" element={<ProtectedRoute role="teacher"><ClassPage /></ProtectedRoute>} />
      <Route path="/teacher/assignments/new" element={<ProtectedRoute role="teacher"><NewAssignmentPage /></ProtectedRoute>} />
      <Route path="/teacher/assignments/:assignmentId" element={<ProtectedRoute role="teacher"><AssignmentPage /></ProtectedRoute>} />
      <Route path="/teacher/assignments/:assignmentId/edit" element={<ProtectedRoute role="teacher"><EditAssignmentPage /></ProtectedRoute>} />
      <Route path="/teacher/assignments/:assignmentId/grades" element={<ProtectedRoute role="teacher"><GradesReportPage /></ProtectedRoute>} />
      <Route path="/teacher/assignments/:assignmentId/plagiarism" element={<ProtectedRoute role="teacher"><PlagiarismReportPage /></ProtectedRoute>} />
      <Route path="/teacher/assignments/:assignmentId/plagiarism/pair/:subAId/:subBId" element={<ProtectedRoute role="teacher"><PlagiarismPairPage /></ProtectedRoute>} />
      <Route path="/teacher/grade/:submissionId" element={<ProtectedRoute role="teacher"><GradingPage /></ProtectedRoute>} />
      <Route path="/teacher/questions" element={<ProtectedRoute role="teacher"><QuestionBankPage /></ProtectedRoute>} />
      <Route path="/teacher/rubrics" element={<ProtectedRoute role="teacher"><RubricsLibraryPage /></ProtectedRoute>} />
      <Route path="/teacher/guide" element={<ProtectedRoute role="teacher"><GuidePage /></ProtectedRoute>} />

      {/* Student */}
      <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/assignments/:assignmentId" element={<ProtectedRoute role="student"><StudentAssignmentPage /></ProtectedRoute>} />
      <Route path="/student/guide" element={<ProtectedRoute role="student"><GuidePage /></ProtectedRoute>} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Inline plagiarism pair comparison page

function PlagiarismPairPage() {
  const { assignmentId, subAId, subBId } = useParams<{ assignmentId: string; subAId: string; subBId: string }>();
  const [data, setData] = useState<PlagiarismPairDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assignmentId || !subAId || !subBId) return;
    getPlagiarismPair(assignmentId, subAId, subBId)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assignmentId, subAId, subBId]);

  if (loading) return <div className="page-layout"><Navbar /><div className="loading-state">Đang tải...</div></div>;

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link to={`/teacher/assignments/${assignmentId}/plagiarism`}>← Báo cáo đạo văn</Link>
            </div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              So sánh bài nộp
            </h1>
            {data?.pair && (
              <p className="page-sub">
                Tương đồng: <strong style={{ color: data.pair.flag === "severe" ? "var(--danger)" : "var(--warning)" }}>
                  {data.pair.similarity_pct?.toFixed(1)}%
                </strong>
              </p>
            )}
          </div>
        </div>

        {data && (
          <div className="grading-layout">
            <div className="grading-submission glass">
              <h3 className="panel-title">👤 {data.submission_a?.student_name}</h3>
              <div className="submission-text">{data.submission_a?.content_text}</div>
            </div>
            <div className="grading-submission glass">
              <h3 className="panel-title">👤 {data.submission_b?.student_name}</h3>
              <div className="submission-text">{data.submission_b?.content_text}</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
