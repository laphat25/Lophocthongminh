import { useState } from "react";
import type { RubricCriteria, RubricLevel } from "../types";

type DraftCriteria = Omit<RubricCriteria, "criteria_id">;

interface RubricBuilderProps {
  value: DraftCriteria[];
  onChange: (rubric: DraftCriteria[]) => void;
}

const EMPTY_LEVEL: RubricLevel = { score: 0, description: "" };
const EMPTY_CRITERIA: DraftCriteria = {
  criteria_name: "",
  max_score: 10,
  weight: 0,
  keywords: [],
  levels: [
    { score: 10, description: "Xuất sắc" },
    { score: 7, description: "Khá" },
    { score: 5, description: "Trung bình" },
    { score: 2, description: "Yếu" },
  ],
};

export default function RubricBuilder({ value, onChange }: RubricBuilderProps) {
  const [kwInputs, setKwInputs] = useState<Record<number, string>>({});

  const totalWeight = value.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  const weightOk = value.length === 0 || Math.abs(totalWeight - 100) <= 0.01;

  const addCriteria = () => onChange([...value, { ...EMPTY_CRITERIA, levels: EMPTY_CRITERIA.levels.map((l) => ({ ...l })) }]);

  const removeCriteria = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const updateCriteria = (i: number, patch: Partial<DraftCriteria>) => {
    const updated = [...value];
    updated[i] = { ...updated[i], ...patch };
    onChange(updated);
  };

  const addLevel = (i: number) => {
    const updated = [...value];
    updated[i].levels = [...updated[i].levels, { ...EMPTY_LEVEL }];
    onChange(updated);
  };

  const removeLevel = (ci: number, li: number) => {
    const updated = [...value];
    updated[ci].levels = updated[ci].levels.filter((_, idx) => idx !== li);
    onChange(updated);
  };

  const updateLevel = (ci: number, li: number, patch: Partial<RubricLevel>) => {
    const updated = [...value];
    updated[ci].levels[li] = { ...updated[ci].levels[li], ...patch };
    onChange(updated);
  };

  const addKeyword = (i: number) => {
    const kw = (kwInputs[i] || "").trim();
    if (!kw) return;
    updateCriteria(i, { keywords: [...value[i].keywords, kw] });
    setKwInputs((prev) => ({ ...prev, [i]: "" }));
  };

  const removeKeyword = (ci: number, kw: string) => {
    updateCriteria(ci, { keywords: value[ci].keywords.filter((k) => k !== kw) });
  };

  return (
    <div className="rubric-builder">
      {/* Weight indicator */}
      {value.length > 0 && (
        <div className={`weight-indicator ${weightOk ? "weight-ok" : "weight-error"}`} style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
          Tổng trọng số: <strong>{totalWeight}%</strong>
          {!weightOk && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginLeft: "8px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Phải bằng 100%
            </span>
          )}
          {weightOk && value.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", marginLeft: "8px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
        </div>
      )}

      {value.map((criteria, ci) => (
        <div key={ci} className="criteria-builder-card glass">
          <div className="criteria-builder-header">
            <span className="criteria-index">Tiêu chí {ci + 1}</span>
            <button type="button" className="btn-danger btn-sm" onClick={() => removeCriteria(ci)}>✕ Xóa</button>
          </div>

          <div className="form-row-3">
            <div className="form-group" style={{ gridColumn: "span 1" }}>
              <label>Tên tiêu chí *</label>
              <input
                value={criteria.criteria_name}
                onChange={(e) => updateCriteria(ci, { criteria_name: e.target.value })}
                placeholder="VD: Lập luận & Bằng chứng"
                required
              />
            </div>
            <div className="form-group">
              <label>Điểm tối đa</label>
              <input
                type="number" min={1} value={criteria.max_score}
                onChange={(e) => updateCriteria(ci, { max_score: Number(e.target.value) })}
              />
            </div>
            <div className="form-group">
              <label>Trọng số (%)</label>
              <input
                type="number" min={0} max={100} value={criteria.weight}
                onChange={(e) => updateCriteria(ci, { weight: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Keywords */}
          <div className="form-group">
            <label>Từ khóa gợi ý (BM25)</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
              {criteria.keywords.map((kw) => (
                <span key={kw} className="keyword-tag">
                  {kw}
                  <button type="button" onClick={() => removeKeyword(ci, kw)}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={kwInputs[ci] || ""}
                onChange={(e) => setKwInputs((prev) => ({ ...prev, [ci]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(ci); } }}
                placeholder="Thêm từ khóa, Enter để xác nhận"
              />
              <button type="button" className="btn-secondary btn-sm" onClick={() => addKeyword(ci)}>Thêm</button>
            </div>
          </div>

          {/* Levels */}
          <div className="form-group">
            <label>Các mức điểm</label>
            <div className="levels-list">
              {criteria.levels.map((lv, li) => (
                <div key={li} className="level-row">
                  <input
                    type="number" min={0} max={criteria.max_score}
                    value={lv.score}
                    onChange={(e) => updateLevel(ci, li, { score: Number(e.target.value) })}
                    style={{ width: "70px" }}
                    placeholder="Điểm"
                  />
                  <input
                    value={lv.description}
                    onChange={(e) => updateLevel(ci, li, { description: e.target.value })}
                    placeholder="Mô tả mức điểm này..."
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn-ghost" onClick={() => removeLevel(ci, li)}>✕</button>
                </div>
              ))}
              <button type="button" className="btn-secondary btn-sm" onClick={() => addLevel(ci)} style={{ marginTop: "6px" }}>
                + Thêm mức điểm
              </button>
            </div>
          </div>
        </div>
      ))}

      <button type="button" className="btn-accent" onClick={addCriteria} style={{ width: "100%", marginTop: "8px" }}>
        + Thêm tiêu chí
      </button>
    </div>
  );
}
