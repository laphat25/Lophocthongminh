import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import RubricBuilder from "../components/RubricBuilder";
import { 
  getRubricTemplatesApi, 
  createCustomRubricTemplateApi, 
  deleteCustomRubricTemplateApi,
  uploadRubricTemplateApi,
  type RubricTemplate
} from "../api/client";
import { getRubricTemplates } from "../data/rubricTemplates";
import type { RubricCriteria } from "../types";

export default function RubricsLibraryPage() {
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
