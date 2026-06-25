import { useGrading } from "../../context/GradingContext";

export default function RubricAssessmentPanel() {
  const {
    grading,
    rubric,
    localScores,
    setLocalScores,
    overallComment,
    setOverallComment
  } = useGrading();

  return (
    <div className="grading-rubric">
      {!grading ? (
        <div className="empty-state glass">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginBottom: '16px' }}>
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <p>Nhấn "Chạy AI Chấm" để nhận gợi ý điểm tự động</p>
        </div>
      ) : (
        <>
          {grading.criteria_scores.map((cs) => {
            const local = localScores[cs.criteria_id] || { final_score: cs.final_score, teacher_comment: cs.teacher_comment };
            const rubricCriteria = rubric.find((r) => r.criteria_id === cs.criteria_id);
            return (
              <div key={cs.criteria_id} className="criteria-card glass">
                <div className="criteria-header">
                  <h4>{cs.criteria_name}</h4>
                  <span className="text-muted text-sm">Tối đa: {cs.max_score} · Trọng số: {cs.weight}%</span>
                </div>

                {/* AI suggestion */}
                <div className="ai-suggestion">
                  <span className="ai-badge" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    AI đề xuất
                  </span>
                  <span className="ai-score">{cs.ai_suggested_score}/{cs.max_score}</span>
                  <span className="text-sm text-muted"> — {cs.ai_suggested_level}</span>
                </div>

                {/* Rubric levels reference */}
                {rubricCriteria && (
                  <div className="levels-ref">
                    {rubricCriteria.levels.map((lv, i) => (
                      <span key={i} className={`level-badge ${lv.score === cs.ai_suggested_score ? "level-active" : ""}`}>
                        {lv.score}: {lv.description.slice(0, 30)}…
                      </span>
                    ))}
                  </div>
                )}

                {/* Highlighted text */}
                {cs.highlighted_text.length > 0 && (
                  <div className="highlights">
                    {cs.highlighted_text.map((t, i) => (
                      <p key={i} className="highlight-item">"{t}"</p>
                    ))}
                  </div>
                )}

                {/* Score input */}
                <div className="score-input-row">
                  <label>Điểm giảng viên:</label>
                  <input
                    type="number"
                    min={0}
                    max={cs.max_score}
                    step={0.5}
                    value={local.final_score}
                    onChange={(e) =>
                      setLocalScores((prev) => ({
                        ...prev,
                        [cs.criteria_id]: { ...local, final_score: parseFloat(e.target.value) || 0 },
                      }))
                    }
                    className="score-input"
                  />
                  <span className="text-muted">/{cs.max_score}</span>
                </div>

                {/* Comment */}
                <textarea
                  placeholder="Nhận xét cho tiêu chí này..."
                  value={local.teacher_comment}
                  onChange={(e) =>
                    setLocalScores((prev) => ({
                      ...prev,
                      [cs.criteria_id]: { ...local, teacher_comment: e.target.value },
                    }))
                  }
                  rows={2}
                  className="comment-input"
                />
              </div>
            );
          })}

          {/* Overall comment */}
          <div className="criteria-card glass">
            <h4>💬 Nhận xét tổng thể</h4>
            <textarea
              placeholder="Nhận xét chung về bài làm..."
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              rows={3}
              className="comment-input"
            />
          </div>
        </>
      )}
    </div>
  );
}
