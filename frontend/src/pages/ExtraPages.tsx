import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import RubricBuilder from "../components/RubricBuilder";
import { 
  getRubricTemplatesApi, 
  createCustomRubricTemplateApi, 
  deleteCustomRubricTemplateApi,
  uploadRubricTemplateApi,
  type RubricTemplate,
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion
} from "../api/client";
import { getRubricTemplates } from "../data/rubricTemplates";
import type { Question, RubricCriteria } from "../types";
import { useAuth } from "../context/AuthContext";

// ─── 1. QUESTION BANK PAGE ───
export function QuestionBankPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal control
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [tagsInput, setTagsInput] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchQuestionsList = async () => {
    try {
      const data = await getQuestions();
      setQuestions(data.questions);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Lỗi khi tải câu hỏi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestionsList();
  }, []);

  const handleOpenCreate = () => {
    setModalMode("create");
    setSelectedQuestion(null);
    setTitle("");
    setTopic("");
    setDifficulty("medium");
    setTagsInput("");
    setContent("");
    setShowModal(true);
  };

  const handleOpenEdit = (q: Question) => {
    setModalMode("edit");
    setSelectedQuestion(q);
    setTitle(q.title);
    setTopic(q.topic);
    setDifficulty(q.difficulty);
    setTagsInput(q.tags.join(", "));
    setContent(q.content);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const tags = tagsInput
      .split(/[, ]+/)
      .map((t) => t.trim())
      .filter((t) => t.startsWith("#") ? t.slice(1) : t)
      .filter(Boolean);

    const payload = {
      title: title.trim(),
      topic: topic.trim(),
      difficulty,
      tags,
      content: content.trim()
    };

    try {
      if (modalMode === "create") {
        await createQuestion(payload);
      } else if (modalMode === "edit" && selectedQuestion) {
        await updateQuestion(selectedQuestion.id, payload);
      }
      setShowModal(false);
      fetchQuestionsList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi lưu câu hỏi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (q: Question) => {
    if (confirm(`Bạn có chắc chắn muốn xóa câu hỏi "${q.title}"?`)) {
      try {
        await deleteQuestion(q.id);
        fetchQuestionsList();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Lỗi khi xóa câu hỏi");
      }
    }
  };

  const difficultyText = (diff: string) => {
    const map: Record<string, string> = {
      easy: "Dễ",
      medium: "Trung bình",
      hard: "Khó"
    };
    return map[diff] || diff;
  };

  const filtered = questions.filter(
    (q) =>
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.topic.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Ngân hàng câu hỏi
            </h1>
            <p className="page-sub">Quản lý và biên soạn câu hỏi tự luận / thực hành lập trình</p>
          </div>
          {user?.role === "teacher" && (
            <button className="btn-primary" onClick={handleOpenCreate} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Tạo câu hỏi mới
            </button>
          )}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: "20px" }}>{error}</div>}

        <div className="glass card" style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Tìm kiếm câu hỏi bằng tiêu đề hoặc chủ đề..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading-state">Đang tải danh sách câu hỏi...</div>
        ) : (
          <div className="table-container animate-fade-in">
            <table>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tiêu đề câu hỏi</th>
                  <th>Chủ đề / Môn học</th>
                  <th style={{ width: "120px" }}>Độ khó</th>
                  <th>Tags</th>
                  {user?.role === "teacher" && <th style={{ width: "160px" }}>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, idx) => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600, color: "#C92328" }}>Q{(idx + 1).toString().padStart(3, "0")}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{q.title}</div>
                      <div className="text-sm text-secondary" style={{ marginTop: "4px", fontSize: "0.8rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "400px" }}>
                        {q.content}
                      </div>
                    </td>
                    <td>{q.topic}</td>
                    <td>
                      <span
                        className={`badge ${
                          q.difficulty === "easy"
                            ? "badge-success"
                            : q.difficulty === "medium"
                            ? "badge-warning"
                            : "badge-danger"
                        }`}
                      >
                        {difficultyText(q.difficulty)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                        {q.tags.map((t) => (
                          <span key={t} className="badge badge-accent" style={{ fontSize: "0.65rem" }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    </td>
                    {user?.role === "teacher" && (
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleOpenEdit(q)}
                            className="btn-secondary btn-sm"
                            disabled={q.created_by !== user?.id}
                            title={q.created_by !== user?.id ? "Không thể chỉnh sửa câu hỏi của người khác" : ""}
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(q)}
                            className="btn-danger btn-sm"
                            disabled={q.created_by !== user?.id}
                            title={q.created_by !== user?.id ? "Không thể xóa câu hỏi của người khác" : ""}
                            style={{ background: q.created_by === user?.id ? "#C92328" : "var(--border)" }}
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={user?.role === "teacher" ? 6 : 5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                      Không tìm thấy câu hỏi nào phù hợp.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal glass animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", width: "100%" }}>
              <h2>{modalMode === "create" ? "Tạo câu hỏi mới" : "Chỉnh sửa câu hỏi"}</h2>
              <form onSubmit={handleSave}>
                <div className="form-group">
                  <label>Tiêu đề câu hỏi</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Phân tích độ phức tạp Bubble Sort"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Chủ đề / Môn học</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="VD: Cấu trúc dữ liệu & Giải thuật"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Độ khó</label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", background: "var(--bg-card)" }}
                  >
                    <option value="easy">Dễ</option>
                    <option value="medium">Trung bình</option>
                    <option value="hard">Khó</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Tags (phân cách bằng dấu phẩy hoặc khoảng trắng)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="VD: sorting, complexity"
                  />
                </div>
                <div className="form-group">
                  <label>Nội dung chi tiết câu hỏi</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Nhập chi tiết đề bài hoặc câu hỏi tự luận..."
                    rows={8}
                    style={{ width: "100%", padding: "10px", borderRadius: "var(--radius)", border: "1px solid var(--border)", fontFamily: "inherit" }}
                    required
                  />
                </div>
                <div className="modal-actions" style={{ marginTop: "24px" }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Hủy</button>
                  <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Đang lưu..." : "Lưu lại"}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── 2. RUBRICS LIBRARY PAGE ───
export function RubricsLibraryPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<RubricTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState<Omit<RubricCriteria, "criteria_id">[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getRubricTemplatesApi()
      .then((res) => {
        setTemplates(res.templates);
        setLoading(false);
      })
      .catch(() => {
        // Fallback to local storage templates
        setTemplates(getRubricTemplates());
        setLoading(false);
      });
  }, []);

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (criteria.length === 0) {
      setError("Vui lòng thêm ít nhất 1 tiêu chí rubric");
      return;
    }
    const totalWeight = criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      setError(`Tổng trọng số = ${totalWeight}%. Phải bằng 100%.`);
      return;
    }

    try {
      await createCustomRubricTemplateApi({
        name,
        description,
        criteria
      });
      const res = await getRubricTemplatesApi();
      setTemplates(res.templates);
      setName("");
      setDescription("");
      setCriteria([]);
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi lưu mẫu rubric");
    }
  };

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              Thư viện Rubric mẫu
            </h1>
            <p className="page-sub">Các tiêu chí chấm điểm tự luận chuẩn hóa dùng chung</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button 
              className="btn-secondary" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              {uploading ? "Đang xử lý AI..." : "Tải file Rubric"}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              accept=".pdf,.docx,.txt"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  await uploadRubricTemplateApi(file);
                  const res = await getRubricTemplatesApi();
                  setTemplates(res.templates);
                  alert("Đã phân tích và lưu Rubric thành công!");
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Lỗi tải file");
                } finally {
                  setUploading(false);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }
              }}
            />
            <button 
              className="btn-primary" 
              onClick={() => setShowCreateModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Tạo Rubric mẫu mới
            </button>
          </div>
        </div>

        <div className="grid-2">
          {loading ? (
            <div style={{ gridColumn: "span 2", textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              Đang tải danh sách rubric mẫu...
            </div>
          ) : templates.map((r) => (
            <div key={r.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "24px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
                  <h3 style={{ color: "#C92328", fontSize: "1.05rem", margin: 0, lineHeight: "1.4", flex: 1, minWidth: 0, wordBreak: "break-word" }}>{r.name}</h3>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Bạn chắc chắn muốn xóa mẫu rubric "${r.name}"?`)) {
                        try {
                          await deleteCustomRubricTemplateApi(r.id);
                          const res = await getRubricTemplatesApi();
                          setTemplates(res.templates);
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Không thể xóa mẫu rubric này");
                        }
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      display: "inline-flex",
                      alignItems: "center",
                      flexShrink: 0,
                      opacity: 0.6,
                      borderRadius: "6px",
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0.6")}
                    title="Xóa mẫu này"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#C92328" }}>
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
                <p className="text-sm text-secondary" style={{ marginBottom: "16px", lineHeight: "1.4" }}>
                  {r.description}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                  {r.criteria.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        background: "var(--bg-primary)",
                        borderRadius: "var(--radius)",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, marginBottom: "4px" }}>
                        <span style={{ color: "var(--text-primary)" }}>{c.criteria_name}</span>
                        <span style={{ color: "#C92328" }}>{c.weight}%</span>
                      </div>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0 }}>
                        {c.levels[0]?.description ? `Xuất sắc: ${c.levels[0].description}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <button 
                className="btn-primary card-hover" 
                style={{ width: "100%", justifyContent: "center", gap: "8px", fontWeight: 600 }}
                onClick={() => navigate(`/teacher/assignments/new?template=${r.id}`)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
                Áp dụng cho bài tập mới
              </button>
            </div>
          ))}
        </div>

        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal glass animate-fade-in" style={{ maxWidth: "780px", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: "32px" }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ color: "#C92328", fontSize: "1.4rem", marginBottom: "16px", fontWeight: 700 }}>Tạo Rubric mẫu mới</h2>
              <form onSubmit={handleSaveTemplate}>
                <div className="form-group">
                  <label>Tên Rubric mẫu *</label>
                  <input 
                    type="text"
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="VD: Đánh giá mã nguồn Clean Code & Logic" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Mô tả mẫu *</label>
                  <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="VD: Dùng để chấm điểm các bài tập lập trình cơ bản và nâng cao."
                    required
                    style={{ minHeight: "80px" }}
                  />
                </div>
                
                <div style={{ marginTop: "24px", marginBottom: "20px" }}>
                  <h3 style={{ fontSize: "1.05rem", color: "var(--text-primary)", marginBottom: "12px", fontWeight: 700 }}>Cấu trúc tiêu chí Rubric mẫu</h3>
                  <RubricBuilder value={criteria} onChange={setCriteria} />
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: "16px" }}>{error}</div>}

                <div className="modal-actions" style={{ borderTop: "1px solid var(--border-light)", paddingTop: "16px" }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>Hủy</button>
                  <button type="submit" className="btn-primary">Lưu vào thư viện mẫu</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── 3. GUIDE / HELP PAGE ───
export function GuidePage() {
  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              Hướng dẫn sử dụng Hệ thống
            </h1>
            <p className="page-sub">Quy trình vận hành chấm bài tự động và kiểm tra đạo văn</p>
          </div>
        </div>

        <div className="glass card" style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
          <div>
            <h3 style={{ color: "#C92328", fontSize: "1.1rem", marginBottom: "8px" }}>🚀 Quy trình dành cho Giảng viên</h3>
            <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.875rem" }}>
              <li>
                <strong>Tạo lớp học mới:</strong> Vào Trang chủ → Click "Tạo lớp học mới" → Chia sẻ Mã lớp (VD: <code>NJU7I3</code>) cho sinh viên tham gia.
              </li>
              <li>
                <strong>Thiết lập đề bài & Rubric:</strong> Vào Lớp học → Click "Tạo đề bài mới" → Định nghĩa các tiêu chí Rubric chấm điểm (Tổng trọng số bắt buộc = 100%).
              </li>
              <li>
                <strong>AI chấm tự động:</strong> Khi sinh viên nộp bài, click vào bài nộp → Click "Chạy AI Chấm" để nhận gợi ý chấm điểm chi tiết từng tiêu chí từ Google Gemini.
              </li>
              <li>
                <strong>Kiểm tra đạo văn (Plagiarism Check):</strong> Vào trang chi tiết Đề bài → Click "Kiểm tra đạo văn" để hệ thống phân tích mức độ tương đồng giữa tất cả bài làm của sinh viên trong lớp.
              </li>
              <li>
                <strong>Công bố điểm:</strong> Kiểm tra lại điểm số, ghi nhận xét tổng thể → Click "Lưu điểm" → Click "Công bố" để sinh viên có thể xem được điểm của mình.
              </li>
            </ol>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />

          <div>
            <h3 style={{ color: "#C92328", fontSize: "1.1rem", marginBottom: "8px" }}>🎓 Quy trình dành cho Sinh viên</h3>
            <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.875rem" }}>
              <li>
                <strong>Tham gia lớp học:</strong> Lấy mã lớp từ Giảng viên → Nhập mã lớp tại màn hình Dashboard để tham gia vào lớp học.
              </li>
              <li>
                <strong>Nộp bài:</strong> Click vào đề bài được giao → Soạn bài viết trực tiếp hoặc tải file đính kèm (hỗ trợ PDF, DOCX, TXT) theo yêu cầu → Click "Nộp bài".
              </li>
              <li>
                <strong>Xem điểm và phản hồi:</strong> Khi giảng viên công bố điểm, kết quả chi tiết kèm theo điểm số từng tiêu chí và nhận xét của thầy cô sẽ hiển thị ở cuối trang đề bài.
              </li>
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
