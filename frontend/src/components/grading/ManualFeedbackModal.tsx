import { useGrading } from "../../context/GradingContext";
import { EditIcon } from "../Icons";

export default function ManualFeedbackModal() {
  const {
    showAddModal,
    setShowAddModal,
    manualFeedbackData,
    setManualFeedbackData,
    manualSeverity,
    setManualSeverity,
    manualCategory,
    setManualCategory,
    manualCriteriaId,
    setManualCriteriaId,
    manualComment,
    setManualComment,
    manualEvidence,
    setManualEvidence,
    hasSuggestedFix,
    setHasSuggestedFix,
    suggestedReplacement,
    setSuggestedReplacement,
    suggestedExplanation,
    setSuggestedExplanation,
    rubric,
    handleCreateManualFeedback,
  } = useGrading();

  if (!showAddModal || !manualFeedbackData) return null;

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: "560px" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <EditIcon size={20} />
          Thêm nhận xét thủ công
        </h2>
        <form onSubmit={handleCreateManualFeedback}>
          <div className="form-group mb-16">
            <label className="form-label">Đoạn văn bản đã chọn:</label>
            <div
              className="fb-card-quote"
              style={{
                maxHeight: "100px",
                overflowY: "auto",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >
              "{manualFeedbackData.text}"
            </div>
          </div>

          <div className="form-row mb-16" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div className="form-group">
              <label className="form-label">Mức độ:</label>
              <select
                className="form-input"
                value={manualSeverity}
                onChange={(e) => setManualSeverity(e.target.value)}
                required
              >
                <option value="error">Lỗi (Error)</option>
                <option value="warning">Cảnh báo (Warning)</option>
                <option value="info">Gợi ý (Info)</option>
                <option value="praise">Khen ngợi (Praise)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Phân loại:</label>
              <select
                className="form-input"
                value={manualCategory}
                onChange={(e) => setManualCategory(e.target.value)}
                required
              >
                <option value="grammar">Ngữ pháp (Grammar)</option>
                <option value="logic">Lập luận (Logic)</option>
                <option value="structure">Cấu trúc (Structure)</option>
                <option value="clarity">Rõ ràng (Clarity)</option>
                <option value="completeness">Đầy đủ (Completeness)</option>
                <option value="style">Phong cách (Style)</option>
                <option value="code_bug">Lỗi code (Code bug)</option>
                <option value="other">Khác (Other)</option>
              </select>
            </div>
          </div>

          <div className="form-group mb-16">
            <label className="form-label">Liên kết tiêu chí chấm điểm:</label>
            <select
              className="form-input"
              value={manualCriteriaId}
              onChange={(e) => setManualCriteriaId(e.target.value)}
            >
              <option value="">-- Không liên kết --</option>
              {rubric.map((c) => (
                <option key={c.criteria_id} value={c.criteria_id}>
                  {c.criteria_name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group mb-16">
            <label className="form-label">Nhận xét:</label>
            <textarea
              className="form-input"
              rows={3}
              value={manualComment}
              onChange={(e) => setManualComment(e.target.value)}
              placeholder="Nhập nội dung nhận xét chi tiết..."
              required
            />
          </div>

          <div className="form-group mb-16">
            <label className="form-label">Bằng chứng/Giải thích:</label>
            <input
              type="text"
              className="form-input"
              value={manualEvidence}
              onChange={(e) => setManualEvidence(e.target.value)}
              placeholder="Ví dụ: Theo quy tắc ngữ pháp tiếng Việt..."
            />
          </div>

          <div className="form-group mb-16">
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 500,
              }}
            >
              <input
                type="checkbox"
                checked={hasSuggestedFix}
                onChange={(e) => setHasSuggestedFix(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              Đề xuất cách sửa trực tiếp
            </label>
          </div>

          {hasSuggestedFix && (
            <div
              style={{
                background: "rgba(34, 197, 94, 0.03)",
                border: "1px solid rgba(34, 197, 94, 0.15)",
                borderRadius: "var(--radius)",
                padding: "12px",
                marginBottom: "16px",
              }}
            >
              <div className="form-group mb-12">
                <label className="form-label" style={{ color: "#059669" }}>
                  Văn bản thay thế:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={suggestedReplacement}
                  onChange={(e) => setSuggestedReplacement(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ color: "#059669" }}>
                  Giải thích cách sửa:
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={suggestedExplanation}
                  onChange={(e) => setSuggestedExplanation(e.target.value)}
                  placeholder="Ví dụ: Đổi sang từ viết đúng chính tả"
                />
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn-accent"
              style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              onClick={() => {
                setShowAddModal(false);
                setManualFeedbackData(null);
              }}
            >
              Hủy
            </button>
            <button type="submit" className="btn-primary">
              Tạo nhận xét
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
