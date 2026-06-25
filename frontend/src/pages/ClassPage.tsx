import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getClass, getClassStudents, getAssignments, publishAssignment, closeAssignment, removeStudent, resetStudentPassword } from "../api/client";
import type { ClassItem, Enrollment, Assignment } from "../types";
import Navbar from "../components/Navbar";

export default function ClassPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [cls, setCls] = useState<ClassItem | null>(null);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tab, setTab] = useState<"assignments" | "students">("assignments");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!classId) return;
    try {
      const [clsData, studentsData, assignmentsData] = await Promise.all([
        getClass(classId),
        getClassStudents(classId),
        getAssignments(classId),
      ]);
      setCls(clsData);
      setStudents(studentsData.students);
      setAssignments(assignmentsData.assignments);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const statusBadge = (status: Assignment["status"]) => {
    const map = {
      draft: { label: "Nháp", cls: "badge-muted" },
      published: { label: "Đang mở", cls: "badge-success" },
      closed: { label: "Đã đóng", cls: "badge-danger" },
    };
    const info = map[status] || map.draft;
    return <span className={`badge ${info.cls}`}>{info.label}</span>;
  };

  const handlePublish = async (id: string) => {
    await publishAssignment(id);
    fetchData();
  };

  const handleClose = async (id: string) => {
    await closeAssignment(id);
    fetchData();
  };

  const handleRemoveStudent = async (studentId: string, studentName: string) => {
    if (!classId) return;
    if (confirm(`Bạn có chắc chắn muốn xóa sinh viên "${studentName}" khỏi lớp học?`)) {
      try {
        await removeStudent(classId, studentId);
        fetchData();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Lỗi khi xóa sinh viên");
      }
    }
  };

  const handleResetPassword = async (studentId: string, studentName: string) => {
    const newPass = prompt(`Nhập mật khẩu mới cho sinh viên "${studentName}":`, "123456");
    if (newPass === null) return;
    if (!newPass.trim()) {
      alert("Mật khẩu không được để trống");
      return;
    }
    try {
      const res = await resetStudentPassword(studentId, newPass.trim());
      alert(res.message);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi khi đặt lại mật khẩu");
    }
  };

  if (loading) return <div className="page-layout"><Navbar /><div className="loading-state">Đang tải...</div></div>;

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <div className="breadcrumb">
              <Link to="/teacher">Lớp học</Link> / {cls?.class_name}
            </div>
            <h1 className="page-title">{cls?.class_name}</h1>
            <p className="page-sub">{cls?.subject} · Mã lớp: <strong className="text-accent">{cls?.class_code}</strong></p>
          </div>
          <button className="btn-primary" onClick={() => navigate(`/teacher/assignments/new?class_id=${classId}`)}>
            + Tạo đề bài
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="tabs">
          <button className={`tab ${tab === "assignments" ? "tab-active" : ""}`} onClick={() => setTab("assignments")} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Đề bài ({assignments.length})
          </button>
          <button className={`tab ${tab === "students" ? "tab-active" : ""}`} onClick={() => setTab("students")} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Sinh viên ({students.length})
          </button>
        </div>

        {tab === "assignments" && (
          <div className="table-container">
            {assignments.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '16px' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p>Chưa có đề bài. Tạo đề bài đầu tiên!</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Tiêu đề</th>
                    <th>Hạn nộp</th>
                    <th>Trạng thái</th>
                    <th>Tiêu chí</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link to={`/teacher/assignments/${a.id}`} className="link-primary">
                          {a.title}
                        </Link>
                      </td>
                      <td className="text-muted text-sm">
                        {a.deadline ? new Date(a.deadline).toLocaleDateString("vi-VN") : "Không giới hạn"}
                      </td>
                      <td>{statusBadge(a.status)}</td>
                      <td className="text-muted">{a.rubric.length} tiêu chí</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <Link to={`/teacher/assignments/${a.id}`} className="btn-secondary btn-sm">Chi tiết</Link>
                          {a.status === "draft" && (
                            <button className="btn-success btn-sm" onClick={() => handlePublish(a.id)}>Phát hành</button>
                          )}
                          {a.status === "published" && (
                            <button className="btn-danger btn-sm" onClick={() => handleClose(a.id)}>Đóng</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "students" && (
          <div className="table-container">
            {students.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '16px' }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                <p>Chưa có sinh viên. Chia sẻ mã lớp <strong className="text-accent">{cls?.class_code}</strong> để sinh viên tham gia.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Họ tên</th>
                    <th>Email</th>
                    <th>Ngày tham gia</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td>{s.student_name}</td>
                      <td className="text-muted">{s.student_email}</td>
                      <td className="text-muted text-sm">{new Date(s.joined_at).toLocaleDateString("vi-VN")}</td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => handleResetPassword(s.student_id, s.student_name)}
                            className="btn-secondary btn-sm"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.8rem",
                              borderRadius: "4px",
                              cursor: "pointer"
                            }}
                          >
                            Đặt lại MK
                          </button>
                          <button
                            onClick={() => handleRemoveStudent(s.student_id, s.student_name)}
                            className="btn-danger btn-sm"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.8rem",
                              background: "#C92328",
                              border: "none",
                              borderRadius: "4px",
                              color: "#fff",
                              cursor: "pointer"
                            }}
                          >
                            Xóa khỏi lớp
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
