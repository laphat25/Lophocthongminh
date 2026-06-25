import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import RubricBuilder from "../components/RubricBuilder";
import { quickGradeApi, getRubricTemplatesApi, getWebSocketUrl, type RubricTemplate } from "../api/client";
import { getRubricTemplates } from "../data/rubricTemplates";
import type { RubricCriteria } from "../types";

export default function QuickGradingPage() {
  const navigate = useNavigate();

  // Wizard State
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Title & Rubric
  const [title, setTitle] = useState(() => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString("vi-VN") + " " + now.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    return `Bài chấm nhanh - ${formattedDate}`;
  });
  const [templates, setTemplates] = useState<RubricTemplate[]>([]);
  const [rubric, setRubric] = useState<Omit<RubricCriteria, "criteria_id">[]>([]);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2: Upload Files
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  // Step 3: Progress & Websocket
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [gradingStatus, setGradingStatus] = useState<"pending" | "running" | "completed" | "failed">("pending");
  const [gradingError, setGradingError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Load Rubric Templates
  useEffect(() => {
    getRubricTemplatesApi()
      .then((res) => setTemplates(res.templates))
      .catch(() => setTemplates(getRubricTemplates()));
  }, []);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle template selection
  const handleSelectTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
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
      setStep1Error(null);
    }
    e.target.value = "";
  };

  // Step 1 validation & proceed
  const handleProceedToStep2 = () => {
    setStep1Error(null);
    if (!title.trim()) {
      setStep1Error("Vui lòng nhập tiêu đề bài chấm");
      return;
    }
    if (rubric.length === 0) {
      setStep1Error("Vui lòng thêm ít nhất 1 tiêu chí trong Rubric");
      return;
    }
    const totalWeight = rubric.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      setStep1Error(`Tổng trọng số của Rubric là ${totalWeight}%. Trọng số phải bằng đúng 100%.`);
      return;
    }
    setStep(2);
  };

  // Step 2 File handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addValidFiles(selectedFiles);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addValidFiles(droppedFiles);
    }
  };

  const addValidFiles = (incoming: File[]) => {
    setStep2Error(null);
    const validFiles: File[] = [];
    const invalidNames: string[] = [];

    incoming.forEach((file) => {
      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
      if ([".pdf", ".docx", ".txt"].includes(ext)) {
        if (file.size <= 10 * 1024 * 1024) {
          validFiles.push(file);
        } else {
          invalidNames.push(`${file.name} (Quá dung lượng 10MB)`);
        }
      } else {
        invalidNames.push(`${file.name} (Sai định dạng)`);
      }
    });

    if (invalidNames.length > 0) {
      setStep2Error(`Bỏ qua một số file lỗi: ${invalidNames.join(", ")}`);
    }

    setFiles((prev) => {
      const existingNames = prev.map((f) => f.name);
      const filteredIncoming = validFiles.filter((f) => !existingNames.includes(f.name));
      return [...prev, ...filteredIncoming];
    });
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Step 2 Submission & trigger grading
  const handleStartGrading = async () => {
    setStep2Error(null);
    if (files.length === 0) {
      setStep2Error("Vui lòng tải lên ít nhất một tệp bài làm");
      return;
    }

    setStep(3);
    setGradingStatus("pending");
    setProgress(0);
    setProgressMessage("Đang khởi tạo bài chấm nhanh...");
    setGradingError(null);

    try {
      const res = await quickGradeApi({
        title,
        rubric,
        files,
      });

      setAssignmentId(res.assignment_id);

      // Connect WebSocket
      const wsUrl = getWebSocketUrl(res.task_id);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined) {
          setProgress(data.progress);
        }
        if (data.message) {
          setProgressMessage(data.message);
        }
        if (data.status) {
          setGradingStatus(data.status);
        }

        if (data.status === "completed") {
          ws.close();
        } else if (data.status === "failed") {
          ws.close();
          setGradingError(data.error || "Quá trình chấm bài tự động gặp lỗi.");
        }
      };

      ws.onerror = () => {
        ws.close();
        setGradingStatus("failed");
        setGradingError("Lỗi kết nối thời gian thực WebSocket.");
      };

    } catch (err) {
      setGradingStatus("failed");
      setGradingError(err instanceof Error ? err.message : "Đã xảy ra lỗi hệ thống khi tải lên.");
    }
  };

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content">
        {/* Wizard Header */}
        <div className="page-header" style={{ marginBottom: "1.5rem" }}>
          <div>
            <div className="breadcrumb">
              <Link to="/teacher">Dashboard</Link> / Chấm bài nhanh
            </div>
            <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Chế độ chấm bài nhanh
            </h1>
            <p className="page-sub">
              Dành riêng cho giảng viên: Trực tiếp upload các bài tập dạng tệp và thực hiện chấm ngay theo Rubric mà không cần đăng ký tài khoản sinh viên.
            </p>
          </div>
        </div>

        {/* Wizard Stepper Progress Bar */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          maxWidth: "600px",
          margin: "0 auto 2.5rem auto",
          position: "relative"
        }}>
          {/* Connector Line */}
          <div style={{
            position: "absolute",
            top: "50%",
            left: "5%",
            right: "5%",
            height: "2px",
            background: step === 1 ? "var(--border)" : step === 2 ? "linear-gradient(90deg, var(--primary) 50%, var(--border) 50%)" : "var(--primary)",
            zIndex: 0,
            transform: "translateY(-50%)"
          }}></div>

          {/* Step 1 Circle */}
          <div style={{
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px"
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: step >= 1 ? "var(--primary)" : "var(--border)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              boxShadow: step === 1 ? "0 0 0 4px rgba(201, 35, 40, 0.2)" : "none",
              transition: "all 0.3s ease"
            }}>1</div>
            <span style={{ fontSize: "0.8rem", fontWeight: step === 1 ? 600 : 500, color: step === 1 ? "var(--text-primary)" : "var(--text-muted)" }}>Thiết lập Rubric</span>
          </div>

          {/* Step 2 Circle */}
          <div style={{
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px"
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: step >= 2 ? "var(--primary)" : "var(--border)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              boxShadow: step === 2 ? "0 0 0 4px rgba(201, 35, 40, 0.2)" : "none",
              transition: "all 0.3s ease"
            }}>{step > 2 ? "✓" : "2"}</div>
            <span style={{ fontSize: "0.8rem", fontWeight: step === 2 ? 600 : 500, color: step === 2 ? "var(--text-primary)" : "var(--text-muted)" }}>Upload bài làm</span>
          </div>

          {/* Step 3 Circle */}
          <div style={{
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px"
          }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: step >= 3 ? "var(--primary)" : "var(--border)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              boxShadow: step === 3 ? "0 0 0 4px rgba(201, 35, 40, 0.2)" : "none",
              transition: "all 0.3s ease"
            }}>{gradingStatus === "completed" ? "✓" : "3"}</div>
            <span style={{ fontSize: "0.8rem", fontWeight: step === 3 ? 600 : 500, color: step === 3 ? "var(--text-primary)" : "var(--text-muted)" }}>Tiến trình chấm</span>
          </div>
        </div>

        {/* Wizard Step Content */}

        {/* STEP 1 */}
        {step === 1 && (
          <div className="animate-fade-in">
            {step1Error && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{step1Error}</div>}
            
            <div className="glass form-section" style={{ padding: "24px" }}>
              <h2 className="section-header" style={{ borderBottom: "none", paddingBottom: 0, marginBottom: "1.5rem" }}>Thông tin bài chấm nhanh</h2>
              <div className="form-group">
                <label style={{ fontWeight: 600 }}>Tên bài kiểm tra / Lớp học nhanh *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Bài chấm giữa kỳ - Lớp CNTT1"
                  required
                />
              </div>
            </div>

            <div className="glass form-section" style={{ padding: "24px", marginTop: "1.5rem" }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
                flexWrap: "wrap",
                gap: "12px",
                borderBottom: "1px solid var(--border)",
                paddingBottom: "12px"
              }}>
                <div>
                  <h2 className="section-header" style={{ margin: 0, borderBottom: "none", paddingBottom: 0 }}>Rubric chấm điểm</h2>
                  <p className="text-muted text-sm" style={{ margin: "4px 0 0 0" }}>
                    Căn cứ chấm điểm bằng AI. Tổng trọng số phải bằng 100%.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>Mẫu sẵn có:</label>
                  <select
                    onChange={handleSelectTemplate}
                    style={{ width: "auto", minWidth: "220px", padding: "6px 10px", fontSize: "0.8rem" }}
                    defaultValue=""
                  >
                    <option value="" disabled>-- Chọn mẫu Rubric --</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <RubricBuilder value={rubric} onChange={setRubric} />
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "2rem" }}>
              <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Hủy bỏ</button>
              <button type="button" className="btn-primary" onClick={handleProceedToStep2}>
                Tiếp theo: Tải lên bài làm
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "4px" }}>
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div className="animate-fade-in" style={{ maxWidth: "800px", margin: "0 auto" }}>
            {step2Error && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{step2Error}</div>}

            <div className="glass form-section" style={{ padding: "24px" }}>
              <h2 className="section-header" style={{ marginBottom: "0.5rem" }}>Tải tệp bài nộp lên</h2>
              <p className="text-muted text-sm" style={{ marginBottom: "1.5rem" }}>
                Hỗ trợ các định dạng tệp <strong>.pdf</strong>, <strong>.docx</strong>, <strong>.txt</strong> (tối đa 10MB mỗi file). Tên tệp nên tuân theo định dạng <code>[MSSV]_[Họ tên]</code> để hệ thống nhận diện tự động chính xác nhất.
              </p>

              {/* Drag & Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                  border: dragOver ? "2px dashed var(--primary)" : "2px dashed var(--border)",
                  borderRadius: "8px",
                  padding: "40px 20px",
                  textAlign: "center",
                  background: dragOver ? "rgba(201, 35, 40, 0.02)" : "rgba(255, 255, 255, 0.2)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  marginBottom: "2rem"
                }}
                onClick={() => document.getElementById("file-picker-quick")?.click()}
              >
                <input
                  id="file-picker-quick"
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" style={{ marginBottom: "12px", opacity: 0.8 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "1.05rem" }}>Kéo thả hoặc Nhấp để chọn tệp</h4>
                <p className="text-sm text-muted" style={{ margin: 0 }}>Chọn đồng thời toàn bộ tệp bài làm của cả lớp để nộp</p>
              </div>

              {/* Files list */}
              {files.length > 0 && (
                <div>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 600, marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Danh sách bài đã chọn ({files.length})</span>
                    <button
                      className="text-xs"
                      onClick={() => setFiles([])}
                      style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      Xóa toàn bộ
                    </button>
                  </h3>
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    maxHeight: "350px",
                    overflowY: "auto",
                    paddingRight: "6px"
                  }}>
                    {files.map((file, idx) => {
                      const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
                      return (
                        <div key={idx} className="glass" style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "10px 14px",
                          borderRadius: "6px",
                          border: "1px solid var(--border-light)",
                          background: "#ffffff"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                            <span style={{
                              fontWeight: 600,
                              fontSize: "0.75rem",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              background: ext === ".pdf" ? "rgba(201, 35, 40, 0.1)" : ext === ".docx" ? "rgba(43, 108, 176, 0.1)" : "rgba(113, 128, 150, 0.1)",
                              color: ext === ".pdf" ? "var(--primary)" : ext === ".docx" ? "#2B6CB0" : "#4A5568"
                            }}>{ext.replace(".", "").toUpperCase()}</span>
                            <span style={{
                              fontSize: "0.9rem",
                              fontWeight: 500,
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap"
                            }} title={file.name}>{file.name}</span>
                            <span className="text-muted text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <button
                            onClick={() => handleRemoveFile(idx)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px",
                              color: "var(--text-muted)",
                              display: "inline-flex"
                            }}
                            title="Xóa bài nộp"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "space-between", marginTop: "2rem" }}>
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "4px" }}>
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Quay lại
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleStartGrading}
                disabled={files.length === 0}
                style={{
                  background: files.length === 0 ? "var(--border)" : "var(--primary)",
                  cursor: files.length === 0 ? "not-allowed" : "pointer"
                }}
              >
                Bắt đầu chấm bài ({files.length} tệp)
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "6px" }}>
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div className="animate-fade-in" style={{ maxWidth: "650px", margin: "0 auto" }}>
            <div className="card glass" style={{ padding: "30px", textAlign: "center" }}>
              {gradingStatus === "completed" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                  <div style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(46, 117, 89, 0.1)",
                    color: "#2E7559",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0 }}>Chấm bài hoàn tất!</h2>
                  <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", margin: 0, lineHeight: 1.5 }}>
                    Tất cả các bài nộp đã được chấm AI, đối chiếu đạo văn và kiểm định trích dẫn thành công.
                  </p>
                </div>
              ) : gradingStatus === "failed" ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                  <div style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(201, 35, 40, 0.1)",
                    color: "var(--primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: "var(--primary)" }}>Tiến trình thất bại</h2>
                  {gradingError && (
                    <div className="alert alert-error" style={{ fontSize: "0.85rem", width: "100%" }}>
                      Lỗi: {gradingError}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                  <svg className="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                  <div>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "1.2rem", fontWeight: 700 }}>Đang thực hiện chấm bài hàng loạt</h3>
                    <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>Hệ thống đang trích xuất, đối chiếu đạo văn chéo và chấm điểm AI...</p>
                  </div>
                </div>
              )}

              {/* Progress bar */}
              <div style={{ marginTop: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "600", marginBottom: "8px", color: "var(--text-secondary)" }}>
                  <span style={{ textAlign: "left", display: "inline-block", maxWidth: "80%", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {progressMessage}
                  </span>
                  <span>{progress}%</span>
                </div>
                <div style={{ background: "rgba(0,0,0,0.06)", height: "10px", borderRadius: "5px", overflow: "hidden" }}>
                  <div style={{
                    background: gradingStatus === "completed" ? "#2E7559" : gradingStatus === "failed" ? "var(--primary)" : "linear-gradient(90deg, var(--primary) 0%, #F58220 100%)",
                    width: `${progress}%`,
                    height: "100%",
                    transition: "width 0.3s ease"
                  }}></div>
                </div>
              </div>
            </div>

            {/* Step 3 Actions */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: "2rem" }}>
              {gradingStatus === "completed" && assignmentId && (
                <Link to={`/teacher/assignments/${assignmentId}`} className="btn-primary" style={{ padding: "12px 28px", fontSize: "1rem" }}>
                  Xem kết quả chấm bài
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: "6px" }}>
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              )}
              {gradingStatus === "failed" && (
                <button type="button" className="btn-secondary" onClick={() => setStep(2)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: "4px" }}>
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  Quay lại để sửa đổi
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
