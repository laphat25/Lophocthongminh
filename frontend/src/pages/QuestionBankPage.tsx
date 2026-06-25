import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { 
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion
} from "../api/client";
import type { Question } from "../types";
import { useAuth } from "../context/AuthContext";

export default function QuestionBankPage() {
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
