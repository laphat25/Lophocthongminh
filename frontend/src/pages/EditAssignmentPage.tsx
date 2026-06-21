import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getAssignment, updateAssignment, getRubricTemplatesApi, type RubricTemplate } from "../api/client";
import Navbar from "../components/Navbar";
import RubricBuilder from "../components/RubricBuilder";
import type { RubricCriteria, Assignment } from "../types";
import { getRubricTemplates } from "../data/rubricTemplates";

export default function EditAssignmentPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    submission_type: "both",
    allow_resubmit: false,
    deadline: "",
    pass_threshold: 50,
  });
  const [templates, setTemplates] = useState<RubricTemplate[]>([]);
  const [rubric, setRubric] = useState<Omit<RubricCriteria, "criteria_id">[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRubricTemplatesApi()
      .then((res) => setTemplates(res.templates))
      .catch(() => setTemplates(getRubricTemplates()));
  }, []);

  useEffect(() => {
    if (!assignmentId) return;
    getAssignment(assignmentId)
      .then((asgn) => {
        setAssignment(asgn);
        if (asgn.status !== "draft") {
          setError("Chỉ có thể chỉnh sửa đề bài ở trạng thái Nháp (draft).");
          setLoading(false);
          return;
        }
        setForm({
          title: asgn.title,
          description: asgn.description,
          submission_type: asgn.submission_type,
          allow_resubmit: asgn.allow_resubmit,
          deadline: asgn.deadline
            ? new Date(asgn.deadline).toISOString().slice(0, 16)
            : "",
          pass_threshold: asgn.pass_threshold,
        });
        // Strip criteria_id for the builder
        setRubric(
          asgn.rubric.map((item) => {
            const rest = { ...item } as Partial<RubricCriteria>;
            delete rest.criteria_id;
            return rest as Omit<RubricCriteria, "criteria_id">;
          })
        );
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Lỗi tải đề bài");
        setLoading(false);
      });
  }, [assignmentId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentId) return;
    setError(null);

    if (rubric.length === 0) {
      setError("Vui lòng thêm ít nhất 1 tiêu chí rubric");
      return;
    }
    const totalWeight = rubric.reduce((s, c) => s + c.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      setError(`Tổng trọng số = ${totalWeight}%. Phải bằng 100%.`);
      return;
    }

    setSubmitting(true);
    try {
      await updateAssignment(assignmentId, {
        ...form,
        submission_type: form.submission_type as "text" | "file" | "both",
        pass_threshold: Number(form.pass_threshold),
        deadline: form.deadline ? new Date(form.deadline).toISOString() : undefined,
        rubric,
      });
      navigate(`/teacher/assignments/${assignmentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi cập nhật đề bài");
    } finally {
      setSubmitting(false);
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
              <Link to="/teacher">Lớp học</Link> /
              <Link to={`/teacher/assignments/${assignmentId}`}> {assignment?.title}</Link> /
              Chỉnh sửa
            </div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Chỉnh sửa đề bài
            </h1>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {assignment?.status === "draft" && (
          <form onSubmit={handleSubmit}>
            <div className="glass form-section">
              <h2 className="section-header">Thông tin đề bài</h2>

              <div className="form-group">
                <label>Tiêu đề đề bài *</label>
                <input name="title" value={form.title} onChange={handleChange} placeholder="VD: Bài tập lớn cuối kỳ" required />
              </div>

              <div className="form-group">
                <label>Mô tả / Đề bài</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={5} placeholder="Nội dung đề bài, yêu cầu, hướng dẫn nộp bài..." />
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>Hình thức nộp</label>
                  <select name="submission_type" value={form.submission_type} onChange={handleChange}>
                    <option value="text">Văn bản trực tiếp</option>
                    <option value="file">Upload file</option>
                    <option value="both">Cả hai</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Hạn nộp bài</label>
                  <input name="deadline" type="datetime-local" value={form.deadline} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Ngưỡng đạt (%)</label>
                  <input name="pass_threshold" type="number" min={0} max={100} value={form.pass_threshold} onChange={handleChange} />
                </div>
              </div>

              <div className="form-group-inline">
                <input id="allow-resubmit" name="allow_resubmit" type="checkbox" checked={form.allow_resubmit} onChange={handleChange} />
                <label htmlFor="allow-resubmit">Cho phép nộp lại</label>
              </div>
            </div>

            {/* Rubric Builder */}
            <div className="glass form-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <div>
                  <h2 className="section-header" style={{ margin: 0, borderBottom: "none", paddingBottom: 0 }}>Rubric chấm điểm</h2>
                  <p className="text-muted text-sm" style={{ margin: "4px 0 0 0" }}>
                    Thêm các tiêu chí và mức điểm. Tổng trọng số phải = 100%.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Nhập mẫu nhanh:</label>
                  <select 
                    onChange={(e) => {
                      const tid = e.target.value;
                      if (!tid) return;
                      const template = templates.find((t) => t.id === tid);
                      if (template) {
                        setRubric(template.criteria.map((c) => ({
                          criteria_name: c.criteria_name,
                          max_score: c.max_score,
                          weight: c.weight,
                          keywords: c.keywords,
                          levels: c.levels.map((l) => ({ score: l.score, description: l.description }))
                        })));
                        setForm((f) => ({
                          ...f,
                          title: f.title || `Bài tập về ${template.name}`,
                          description: f.description || template.description
                        }));
                      }
                      e.target.value = ""; 
                    }}
                    style={{ width: "auto", minWidth: "200px", padding: "6px 10px", fontSize: "0.8rem" }}
                    defaultValue=""
                  >
                    <option value="" disabled>-- Chọn Rubric mẫu --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <RubricBuilder value={rubric} onChange={setRubric} />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Hủy</button>
              <button type="submit" className="btn-primary" disabled={submitting} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                {submitting ? (
                  "Đang lưu..."
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
