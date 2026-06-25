import { useState, useEffect } from "react";
import Navbar from "../components/Navbar";

interface Highlight {
  id: string;
  text: string;
  type: "logic" | "citation" | "spelling" | "good";
  title: string;
  comment: string;
  suggestion: string;
}

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState<"teacher" | "student" | "tech">("teacher");
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [faqSearch, setFaqSearch] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Playground state
  const [pgStep, setPgStep] = useState<"idle" | "loading" | "result">("idle");
  const [pgProgress, setPgProgress] = useState(0);
  const [pgLog, setPgLog] = useState("");
  const [selectedHighlight, setSelectedHighlight] = useState<string | null>(null);

  // FAQ Data (Clean text only, no emojis)
  const faqs = [
    {
      q: "Tại sao hệ thống báo lỗi API Key không hợp lệ khi tôi chấm bài?",
      a: "Lỗi này xảy ra khi khóa Gemini API Key cấu hình trong phần Cài đặt cá nhân hoặc tệp `.env` không đúng cấu trúc hoặc đã bị vô hiệu hóa bởi Google. Hãy truy cập Google AI Studio để tạo khóa mới và cập nhật lại. Hệ thống cũng đã tích hợp sẵn cơ chế giả lập (Mock Mode) giúp bạn chạy thử nghiệm chấm bài trơn tru ngay cả khi không có khóa thật.",
      tag: "API & AI"
    },
    {
      q: "Tổng trọng số của các tiêu chí chấm điểm (Rubric) phải bằng bao nhiêu?",
      a: "Hệ thống quy định tổng tỷ trọng (%) của toàn bộ các tiêu chí trong bảng Rubric của đề bài phải chính xác bằng 100%. Nếu tổng tỷ trọng khác 100%, hệ thống sẽ cảnh báo đỏ và ngăn không cho phép lưu cấu hình đề bài để tránh lỗi chia điểm.",
      tag: "Rubric"
    },
    {
      q: "Kiểm tra đạo văn đối chiếu bài viết của sinh viên với những nguồn nào?",
      a: "Hệ thống thực hiện so sánh đối chiếu chuỗi văn bản nâng cao (dùng thuật toán Rabin-Karp cải tiến) giữa tất cả các bài nộp của sinh viên trong cùng một Đề bài. Việc này giúp giáo viên phát hiện ngay tình trạng sinh viên sao chép bài của nhau trực tiếp trong lớp học.",
      tag: "Đạo văn"
    },
    {
      q: "Tính năng kiểm chứng tài liệu tham khảo hoạt động như thế nào?",
      a: "Hệ thống tự động phân tích và trích xuất các trích dẫn học thuật ở cuối bài làm của sinh viên, sau đó kết nối trực tiếp với API của CrossRef (hệ thống liên kết học thuật quốc tế) để xác thực sự tồn tại của bài viết, tác giả và nhà xuất bản. Nếu nguồn bịa đặt hoặc sai lệch, hệ thống sẽ dán nhãn cảnh báo đỏ.",
      tag: "Xác thực"
    },
    {
      q: "Làm thế nào để tắt Rate Limit khi triển khai trên môi trường phát triển cục bộ?",
      a: "Bạn có thể cấu hình biến môi trường `DISABLE_RATE_LIMIT=true` trong tệp `backend/.env`. Điều này giúp các lệnh test tự động hoặc thao tác click liên tục của lập trình viên không bị chặn bởi cơ chế giới hạn tần suất gửi request.",
      tag: "Cấu hình"
    }
  ];

  // Playground Mock Highlights
  const highlights: Highlight[] = [
    {
      id: "h1",
      text: "giúp học sinh tiến bộ vượt bậc mà không cần giáo viên hỗ trợ quá nhiều",
      type: "logic",
      title: "Lỗi Lập Luận",
      comment: "Lập luận mang tính chủ quan, cảm tính và tuyệt đối hóa.",
      suggestion: "Cần bổ sung số liệu thống kê hoặc nghiên cứu thực tiễn để chứng minh (ví dụ: nghiên cứu đối chiếu kết quả học tập)."
    },
    {
      id: "h2",
      text: "Nguyễn Văn A (2024)",
      type: "citation",
      title: "Nghi Vấn Tài Liệu Giả Mạo",
      comment: "Không tìm thấy ấn phẩm học thuật tương ứng trong danh mục CrossRef.",
      suggestion: "Kiểm tra lại tên tác giả hoặc năm xuất bản. Đảm bảo tài liệu tham khảo thực sự tồn tại trên hệ thống dữ liệu quốc tế."
    },
    {
      id: "h3",
      text: "giáo dụt",
      type: "spelling",
      title: "Sai Lỗi Chính Tả",
      comment: "Từ viết sai chính tả tiếng Việt.",
      suggestion: "Sửa lại thành 'giáo dục'."
    },
    {
      id: "h4",
      text: "cá nhân hóa học tập cực kỳ hiệu quả",
      type: "good",
      title: "Lập Luận Tốt",
      comment: "Luận điểm rõ ràng, sử dụng thuật ngữ chuyên ngành chuẩn xác.",
      suggestion: "Giữ vững phong cách lập luận mạch lạc này cho các luận điểm tiếp theo."
    }
  ];

  const handleCopyEnv = () => {
    const envText = `# Environment Configuration Example
PORT=8000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/assignment_marking
DISABLE_RATE_LIMIT=true
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere_ForRealGrading
AI_PROVIDER=gemini`;
    navigator.clipboard.writeText(envText);
    setCopiedEnv(true);
    setTimeout(() => setCopiedEnv(false), 2000);
  };

  const startSimulation = () => {
    setPgStep("loading");
    setPgProgress(0);
    setSelectedHighlight(null);
    setPgLog("Đang khởi chạy AI Engine...");
  };

  useEffect(() => {
    if (pgStep !== "loading") return;

    const timer = setInterval(() => {
      setPgProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setPgStep("result");
          setSelectedHighlight("h1"); // Auto select first issue to show popover
          return 100;
        }
        const next = prev + 10;
        if (next === 20) setPgLog("Đang trích xuất nội dung văn bản học thuật...");
        else if (next === 50) setPgLog("Đang gọi Gemini AI phân tích lỗi và so khớp tiêu chí Rubric...");
        else if (next === 80) setPgLog("Đang truy xuất API học thuật CrossRef để xác minh nguồn...");
        else if (next === 90) setPgLog("Đang so sánh đối chiếu đạo văn nội bộ...");
        return next;
      });
    }, 150);

    return () => clearInterval(timer);
  }, [pgStep]);

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      faq.a.toLowerCase().includes(faqSearch.toLowerCase()) ||
      faq.tag.toLowerCase().includes(faqSearch.toLowerCase())
  );

  const activeHighlightObj = highlights.find((h) => h.id === selectedHighlight);

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content" style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 24px 80px" }}>
        
        {/* Custom Styling block */}
        <style dangerouslySetInnerHTML={{ __html: `
          .gradient-text {
            background: linear-gradient(135deg, var(--primary) 0%, #A80A0A 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .guide-header {
            background: linear-gradient(180deg, rgba(201, 35, 40, 0.04) 0%, rgba(255, 255, 255, 0) 100%);
            border-bottom: 1px solid rgba(201, 35, 40, 0.08);
            padding: 50px 20px 40px;
            text-align: center;
            border-radius: 0 0 24px 24px;
            margin-bottom: 40px;
          }
          .guide-tabs {
            display: flex;
            justify-content: center;
            gap: 16px;
            margin-bottom: 40px;
            flex-wrap: wrap;
          }
          .guide-tab-btn {
            padding: 14px 28px;
            border-radius: 14px;
            border: 1px solid var(--border);
            background: var(--bg-surface);
            color: var(--text-secondary);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 0.95rem;
            box-shadow: 0 2px 5px rgba(0,0,0,0.02);
          }
          .guide-tab-btn:hover {
            border-color: var(--primary);
            color: var(--primary);
            transform: translateY(-2px);
          }
          .guide-tab-btn.active {
            background: var(--primary);
            border-color: var(--primary);
            color: #ffffff;
            box-shadow: 0 6px 20px rgba(201, 35, 40, 0.2);
          }
          .timeline-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            display: flex;
            gap: 20px;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            box-shadow: var(--shadow);
          }
          .timeline-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: var(--primary);
            opacity: 0;
            transition: opacity 0.3s ease;
          }
          .timeline-card:hover {
            transform: translateX(6px);
            border-color: rgba(201, 35, 40, 0.2);
            box-shadow: 0 6px 20px rgba(0,0,0,0.05);
          }
          .timeline-card:hover::before {
            opacity: 1;
          }
          .timeline-num {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: var(--accent-dim);
            color: var(--primary);
            font-size: 1.2rem;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            border: 1px solid rgba(201, 35, 40, 0.15);
          }
          .playground-container {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 20px;
            padding: 32px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
            margin-bottom: 50px;
          }
          .essay-box {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            font-family: 'Inter', system-ui, sans-serif;
            line-height: 1.8;
            color: var(--text-primary);
            font-size: 1rem;
            min-height: 220px;
            position: relative;
          }
          .highlight-span {
            padding: 2px 6px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
            display: inline;
            border-bottom: 2.5px solid transparent;
          }
          .highlight-span:hover {
            filter: brightness(0.92);
            transform: scale(1.02);
          }
          .highlight-span.active {
            box-shadow: 0 0 0 2px var(--text-primary);
          }
          .highlight-span.logic {
            background: rgba(245, 158, 11, 0.15);
            color: #b45309;
            border-bottom-color: #f59e0b;
          }
          .highlight-span.citation {
            background: rgba(239, 68, 68, 0.12);
            color: #b91c1c;
            border-bottom-color: #ef4444;
          }
          .highlight-span.spelling {
            background: rgba(168, 85, 247, 0.12);
            color: #7e22ce;
            border-bottom-color: #a855f7;
          }
          .highlight-span.good {
            background: rgba(16, 185, 129, 0.12);
            color: #047857;
            border-bottom-color: #10b981;
          }
          .comment-popover {
            background: #1e293b;
            color: #f8fafc;
            border-radius: 12px;
            padding: 20px;
            font-size: 0.9rem;
            box-shadow: 0 12px 28px rgba(0,0,0,0.18);
            margin-top: 16px;
            border: 1px solid #334155;
            animation: fadeIn 0.25s ease-out;
          }
          .rubric-pill {
            background: var(--bg-primary);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 0.9rem;
            transition: all 0.2s ease;
          }
          .rubric-pill:hover {
            border-color: var(--primary);
            background: var(--bg-surface);
          }
          .faq-item {
            border: 1px solid var(--border);
            background: var(--bg-card);
            border-radius: 14px;
            margin-bottom: 14px;
            overflow: hidden;
            transition: all 0.25s ease;
            box-shadow: var(--shadow);
          }
          .faq-item:hover {
            border-color: var(--primary);
            box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          }
          .faq-q {
            padding: 20px 24px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: none;
            border: none;
            width: 100%;
            text-align: left;
            color: var(--text-primary);
            font-size: 1rem;
            transition: color 0.2s ease;
          }
          .faq-q:hover {
            color: var(--primary);
          }
          .faq-a {
            padding: 0 24px 20px;
            color: var(--text-secondary);
            font-size: 0.92rem;
            line-height: 1.7;
            border-top: 1px solid var(--border-light);
            padding-top: 18px;
            animation: fadeIn 0.25s ease-out;
          }
          .tech-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 14px;
            box-shadow: var(--shadow);
            transition: all 0.3s ease;
          }
          .tech-card:hover {
            transform: translateY(-4px);
            border-color: var(--primary);
            box-shadow: 0 8px 24px rgba(201,35,40,0.06);
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        ` }} />

        {/* Header Section */}
        <div className="guide-header">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px" }}>
            <div style={{
              padding: "18px",
              background: "linear-gradient(135deg, rgba(201, 35, 40, 0.1) 0%, rgba(201, 35, 40, 0.02) 100%)",
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(201, 35, 40, 0.2)",
              boxShadow: "0 4px 10px rgba(201, 35, 40, 0.05)"
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h1 className="page-title" style={{ fontSize: "2.4rem", fontWeight: 800, letterSpacing: "-0.8px", margin: "10px 0 0" }}>
              Hướng Dẫn <span className="gradient-text">Vận Hành Hệ Thống</span>
            </h1>
            <p className="page-sub" style={{ fontSize: "1.1rem", maxWidth: "680px", margin: "0 auto", color: "var(--text-secondary)" }}>
              Khám phá giải pháp chấm điểm thông minh bằng AI, xác thực tài liệu tham khảo CrossRef quốc tế và kiểm soát đạo văn toàn diện.
            </p>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="guide-tabs">
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === "teacher" ? "active" : ""}`}
            onClick={() => setActiveTab("teacher")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-3-3H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Dành Cho Giảng Viên
          </button>
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === "student" ? "active" : ""}`}
            onClick={() => setActiveTab("student")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
            </svg>
            Dành Cho Sinh Viên
          </button>
          <button
            type="button"
            className={`guide-tab-btn ${activeTab === "tech" ? "active" : ""}`}
            onClick={() => setActiveTab("tech")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Cấu Hình Kỹ Thuật
          </button>
        </div>

        {/* INTERACTIVE PLAYGROUND */}
        <div className="playground-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3 style={{ fontSize: "1.25rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2v7.31L3.39 19A2 2 0 0 0 5 22h14a2 2 0 0 0 1.61-3L14 9.31V2z" />
                  <path d="M8.5 2h7" />
                  <path d="M6 16h12" />
                </svg>
                Hộp Cát Trải Nghiệm AI (Interactive AI Sandbox)
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: "4px 0 0" }}>
                Thao tác mô phỏng quy trình chấm điểm và kiểm chứng tài liệu thực tế của hệ thống.
              </p>
            </div>
            {pgStep !== "loading" && (
              <button
                type="button"
                className="btn-primary"
                onClick={startSimulation}
                style={{ padding: "10px 20px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                Chạy Thử AI Chấm Điểm
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", minHeight: "340px" }} className="grading-layout">
            
            {/* Left Panel: Raw text input view */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>
                  Bài viết của học sinh (Bản xem trước)
                </span>
                <span className={`badge ${pgStep === "result" ? "badge-success" : "badge-muted"}`}>
                  {pgStep === "idle" ? "Trạng thái: Chờ" : pgStep === "loading" ? "Đang xử lý" : "Chấm hoàn tất"}
                </span>
              </div>

              {pgStep !== "result" ? (
                <div className="essay-box" style={{ opacity: pgStep === "loading" ? 0.6 : 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <p style={{ margin: 0, fontStyle: "italic", color: "var(--text-secondary)" }}>
                    "Sử dụng trí tuệ nhân tạo (AI) trong giáo dục giúp cá nhân hóa học tập cực kỳ hiệu quả, giúp học sinh tiến bộ vượt bậc mà không cần giáo viên hỗ trợ quá nhiều. Tuy nhiên, việc lạm dụng có thể gây ra suy giảm tư duy phản biện. Ngoài ra, việc nghiên cứu của Nguyễn Văn A (2024) tại trường đại học X cho thấy 85% sinh viên thích học với AI. Đồng thời, ta cần lưu ý lỗi chính tả như giáo dụt..."
                  </p>
                  {pgStep === "loading" && (
                    <div style={{ margin: "20px 0 10px" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--primary)", display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span>{pgLog}</span>
                        <span>{pgProgress}%</span>
                      </div>
                      <div style={{ height: "6px", background: "var(--border)", borderRadius: "4px", overflow: "hidden" }}>
                        <div style={{ width: `${pgProgress}%`, height: "100%", background: "var(--primary)", transition: "width 0.15s ease" }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="essay-box">
                  <span>Sử dụng trí tuệ nhân tạo (AI) trong giáo dục giúp </span>
                  <span
                    className={`highlight-span good ${selectedHighlight === "h4" ? "active" : ""}`}
                    onClick={() => setSelectedHighlight("h4")}
                  >
                    cá nhân hóa học tập cực kỳ hiệu quả
                  </span>
                  <span>, </span>
                  <span
                    className={`highlight-span logic ${selectedHighlight === "h1" ? "active" : ""}`}
                    onClick={() => setSelectedHighlight("h1")}
                  >
                    giúp học sinh tiến bộ vượt bậc mà không cần giáo viên hỗ trợ quá nhiều
                  </span>
                  <span>. Tuy nhiên, việc lạm dụng có thể gây ra suy giảm tư duy phản biện. Ngoài ra, việc nghiên cứu của </span>
                  <span
                    className={`highlight-span citation ${selectedHighlight === "h2" ? "active" : ""}`}
                    onClick={() => setSelectedHighlight("h2")}
                  >
                    Nguyễn Văn A (2024)
                  </span>
                  <span> tại trường đại học X cho thấy 85% sinh viên thích học với AI. Đồng thời, ta cần lưu ý lỗi chính tả như </span>
                  <span
                    className={`highlight-span spelling ${selectedHighlight === "h3" ? "active" : ""}`}
                    onClick={() => setSelectedHighlight("h3")}
                  >
                    giáo dụt
                  </span>
                  <span>.</span>
                </div>
              )}
            </div>

            {/* Right Panel: Analyzed results / Feedback view */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>
                Nhận xét chi tiết từ AI & Điểm số Rubric
              </span>

              {pgStep === "idle" && (
                <div style={{
                  border: "2px dashed var(--border)", borderRadius: "12px", height: "100%", minHeight: "220px",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "30px", textAlign: "center", color: "var(--text-secondary)"
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" style={{ marginBottom: "12px" }}>
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                  <p style={{ fontWeight: 600, fontSize: "0.95rem", margin: "0 0 4px", color: "var(--text-primary)" }}>
                    Sẵn sàng phân tích
                  </p>
                  <p style={{ fontSize: "0.82rem", maxWidth: "260px", margin: 0 }}>
                    Nhấn nút "Chạy Thử AI Chấm Điểm" ở trên để chạy giả lập phân tích.
                  </p>
                </div>
              )}

              {pgStep === "loading" && (
                <div style={{
                  border: "1px solid var(--border)", borderRadius: "12px", height: "100%", minHeight: "220px",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "30px", background: "var(--bg-primary)"
                }}>
                  <div style={{
                    width: "40px", height: "40px", borderRadius: "50%",
                    border: "3px solid var(--border)", borderTopColor: "var(--primary)",
                    animation: "spin 1s linear infinite", marginBottom: "16px"
                  }} />
                  <span style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-primary)" }}>
                    Đang tính toán kết quả...
                  </span>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {pgStep === "result" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  
                  {/* Miniature Rubric scores */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div className="rubric-pill">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1 .3 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                          <path d="M9 18h6" />
                          <path d="M10 22h4" />
                        </svg>
                        Lập luận:
                      </span>
                      <strong style={{ color: "#d97706" }}>6.5/10</strong>
                    </div>
                    <div className="rubric-pill">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                        </svg>
                        Học thuật:
                      </span>
                      <strong style={{ color: "#dc2626" }}>5.0/10</strong>
                    </div>
                    <div className="rubric-pill">
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                        </svg>
                        Chính tả:
                      </span>
                      <strong style={{ color: "#7e22ce" }}>8.0/10</strong>
                    </div>
                    <div className="rubric-pill" style={{ borderLeft: "3px solid var(--success)", background: "rgba(16, 185, 129, 0.04)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                          <path d="M4 22h16" />
                          <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                          <path d="M12 2a6 6 0 0 1 6 6v3.5c0 1.66-1.34 3-3 3H9a3 3 0 0 1-3-3V8a6 6 0 0 1 6-6z" />
                        </svg>
                        Tổng Điểm:
                      </span>
                      <strong style={{ color: "var(--success)", fontSize: "1rem" }}>6.5/10</strong>
                    </div>
                  </div>

                  {/* Interactive Selected Highlight feedback card */}
                  {selectedHighlight && activeHighlightObj && (
                    <div className="comment-popover">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "1px solid #475569", paddingBottom: "8px" }}>
                        <span style={{ 
                          fontWeight: 700, 
                          color: activeHighlightObj.type === "good" ? "#34d399" : activeHighlightObj.type === "logic" ? "#fbbf24" : activeHighlightObj.type === "spelling" ? "#c084fc" : "#f87171",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}>
                          {activeHighlightObj.type === "good" && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                          )}
                          {activeHighlightObj.type === "logic" && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                          )}
                          {activeHighlightObj.type === "spelling" && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                            </svg>
                          )}
                          {activeHighlightObj.type === "citation" && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="15" y1="9" x2="9" y2="15" />
                              <line x1="9" y1="9" x2="15" y2="15" />
                            </svg>
                          )}
                          {activeHighlightObj.title}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Nhận xét AI</span>
                      </div>
                      <p style={{ color: "#e2e8f0", margin: "0 0 10px", lineHeight: "1.5", fontSize: "0.85rem" }}>
                        <strong>Văn bản bị đánh dấu:</strong> "{activeHighlightObj.text}"
                      </p>
                      <p style={{ color: "#cbd5e1", margin: "0 0 10px", lineHeight: "1.5", fontSize: "0.85rem" }}>
                        <strong>Nhận xét:</strong> {activeHighlightObj.comment}
                      </p>
                      <div style={{ background: "#0f172a", padding: "10px 12px", borderRadius: "6px", borderLeft: "2px solid var(--primary)", fontSize: "0.82rem" }}>
                        <span style={{ color: "#38bdf8", fontWeight: 600 }}>Gợi ý khắc phục:</span> {activeHighlightObj.suggestion}
                      </div>
                    </div>
                  )}

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>
                    <span>Đạo văn nội bộ: <strong>12% (An toàn)</strong></span>
                    <span>Nguồn CrossRef: <strong>1 lỗi / 0 khớp</strong></span>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setPgStep("idle")}
                    style={{ alignSelf: "flex-end", padding: "6px 12px", fontSize: "0.8rem" }}
                  >
                    Reset mô phỏng
                  </button>

                </div>
              )}

            </div>
          </div>
        </div>

        {/* TAB 1: TEACHER WORKFLOW */}
        {activeTab === "teacher" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }} className="fadeIn">
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "1.5rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-3-3H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Quy Trình Nghiệp Vụ Của Giảng Viên
              </h2>
              <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginTop: "6px", margin: "6px 0 0" }}>
                Hướng dẫn chi tiết cách quản lý lớp học, cấu hình thang tiêu chí Rubric chuẩn và chấm điểm thông minh.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }} className="grading-layout">
              
              {/* Step 1 */}
              <div className="timeline-card">
                <div className="timeline-num">1</div>
                <div>
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-primary)" }}>
                    Khởi tạo lớp học & Phân phát mã tham gia
                  </h4>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                    Tại trang quản lý tổng quan, click <strong>"Tạo lớp học mới"</strong>, điền tên lớp và mô tả. Hệ thống sẽ tự động cấp một <strong>Mã lớp (Class Code)</strong> ngẫu nhiên không trùng lặp. Giảng viên gửi mã này để sinh viên chủ động đăng ký vào lớp.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="timeline-card">
                <div className="timeline-num">2</div>
                <div>
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-primary)" }}>
                    Thiết lập Đề bài & Rubric chấm điểm
                  </h4>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                    Tạo đề bài mới cùng thời hạn nộp bài. Khai báo bảng tiêu chí Rubric chấm điểm bao gồm: tên tiêu chí, số điểm tối đa, tỷ trọng phần trăm (%) và các từ khóa định hướng cho AI. <br />
                    <span style={{ color: "var(--primary)", fontWeight: 600 }}>Lưu ý bắt buộc:</span> Tổng tỷ trọng các tiêu chí phải đạt chính xác <strong>100%</strong>.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="timeline-card">
                <div className="timeline-num">3</div>
                <div>
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-primary)" }}>
                    Chạy AI chấm điểm tự động (Auto-grading)
                  </h4>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                    Khi sinh viên nộp bài làm, hệ thống tự động bóc tách văn bản. Giảng viên chỉ cần click <strong>"Chạy AI Chấm"</strong>. Mô hình AI sẽ chấm điểm cho từng tiêu chí trong Rubric và bôi màu highlight chỉ ra các điểm lập luận chưa tốt, lỗi chính tả trực tiếp trên bài viết.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="timeline-card">
                <div className="timeline-num">4</div>
                <div>
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-primary)" }}>
                    Xác thực học thuật CrossRef & Đạo văn
                  </h4>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                    Hệ thống tự động liên kết với API CrossRef để xác nhận các nguồn tài liệu tham khảo ở cuối bài viết của sinh viên xem có bịa đặt hay không. Đồng thời, công cụ kiểm tra đạo văn nội bộ sẽ so sánh các bài làm trong lớp để phát hiện chéo hành vi sao chép.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="timeline-card" style={{ gridColumn: "1 / -1" }}>
                <div className="timeline-num" style={{ background: "var(--success-dim)", color: "var(--success)", borderColor: "rgba(16, 185, 129, 0.2)" }}>5</div>
                <div>
                  <h4 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-primary)" }}>
                    Điều chỉnh điểm thủ công & Công bố điểm số
                  </h4>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                    Kết quả AI đề xuất chỉ mang tính tham khảo. Giảng viên có toàn quyền thay đổi điểm số, bôi đen văn bản để viết tay nhận xét riêng. Khi đã hài lòng, click <strong>"Lưu điểm"</strong> và <strong>"Công bố"</strong> để cập nhật kết quả chính thức cho sinh viên.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: STUDENT WORKFLOW */}
        {activeTab === "student" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }} className="fadeIn">
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "1.5rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                </svg>
                Quy Trình Học Tập Của Sinh Viên
              </h2>
              <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginTop: "6px", margin: "6px 0 0" }}>
                Cổng thông tin hướng dẫn sinh viên đăng ký lớp học, làm bài tập và theo dõi đánh giá học tập.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px" }} className="grading-layout">
              
              {/* Step 1 */}
              <div className="timeline-card" style={{ flexDirection: "column", gap: "14px" }}>
                <div className="timeline-num" style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--success)", borderColor: "rgba(16, 185, 129, 0.2)" }}>1</div>
                <div>
                  <h4 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-primary)" }}>
                    Tham gia lớp học
                  </h4>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                    Nhận <strong>Class Code</strong> do giảng viên giảng dạy cung cấp. Nhập mã này tại ô "Tham gia lớp" ở Dashboard sinh viên để tự động đăng ký vào danh sách thành viên của lớp học.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="timeline-card" style={{ flexDirection: "column", gap: "14px" }}>
                <div className="timeline-num" style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--success)", borderColor: "rgba(16, 185, 129, 0.2)" }}>2</div>
                <div>
                  <h4 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-primary)" }}>
                    Làm bài & Nộp bài làm
                  </h4>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                    Chọn bài tập đang mở. Sinh viên soạn thảo trực tiếp trên khung soạn thảo của hệ thống hoặc đăng tải file tài liệu đính kèm định dạng <strong>PDF, Word (DOCX) hoặc TXT</strong>. Bấm nút <strong>"Nộp bài"</strong>.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="timeline-card" style={{ flexDirection: "column", gap: "14px" }}>
                <div className="timeline-num" style={{ background: "rgba(16, 185, 129, 0.08)", color: "var(--success)", borderColor: "rgba(16, 185, 129, 0.2)" }}>3</div>
                <div>
                  <h4 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "6px", color: "var(--text-primary)" }}>
                    Nhận phản hồi & Sửa bài
                  </h4>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                    Khi giáo viên công bố kết quả, bạn sẽ nhận được thông báo. Mở bài làm để xem điểm số chi tiết từng mục tiêu chí Rubric, các nhận xét phê duyệt và các lỗi bôi màu nổi bật để điều chỉnh cách hành văn.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: TECHNICAL CONFIGURATION */}
        {activeTab === "tech" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }} className="fadeIn">
            <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "1.5rem", color: "var(--primary)", display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Cấu Hợp Kỹ Thuật & Tích Hợp API
              </h2>
              <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginTop: "6px", margin: "6px 0 0" }}>
                Tổng quan kiến trúc kỹ thuật dành cho lập trình viên quản trị và vận hành hệ thống.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }} className="grading-layout">
              
              {/* Technical Card 1: Env Vars */}
              <div className="tech-card" style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <h4 style={{ color: "var(--primary)", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                    Khởi Tạo Các Biến Môi Trường (Environment Variables)
                  </h4>
                  <button
                    type="button"
                    className="btn-accent btn-sm"
                    onClick={handleCopyEnv}
                    style={{ borderRadius: "8px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {copiedEnv ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Đã Sao Chép
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Sao chép cấu hình .env
                      </>
                    )}
                  </button>
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                  Để hệ thống chạy ổn định và đầy đủ tính năng, vui lòng tạo tệp <code>.env</code> tại thư mục gốc <code>backend/</code> và thiết lập các biến số môi trường như bên dưới:
                </p>
                <pre style={{
                  background: "#1e293b", color: "#f8fafc", padding: "16px 20px", borderRadius: "10px",
                  fontSize: "0.82rem", overflowX: "auto", fontFamily: "monospace", border: "1px solid #334155",
                  lineHeight: "1.5", margin: 0
                }}>
{`# Environment Configuration Example
PORT=8000
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/assignment_marking
DISABLE_RATE_LIMIT=true
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere_ForRealGrading
AI_PROVIDER=gemini`}
                </pre>
              </div>

              {/* Technical Card 2: Database options */}
              <div className="tech-card">
                <h4 style={{ color: "var(--success)", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  Tùy Chọn Cơ Sở Dữ Liệu
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                  Hệ thống hỗ trợ cơ chế lưu trữ kép linh hoạt:
                  <ul style={{ paddingLeft: "20px", marginTop: "8px" }}>
                    <li><strong>Mặc định cục bộ:</strong> Lưu dưới dạng tệp tin JSON tĩnh trong thư mục <code>backend/app/storage/</code> (rất tiện lợi cho việc phát triển nhanh không cần cài đặt SQL).</li>
                    <li><strong>Môi trường Production:</strong> Hỗ trợ kết nối SQL thông qua <strong>PostgreSQL 15</strong> (cung cấp qua <code>DATABASE_URL</code>). Hệ thống tự động đồng bộ lược đồ bảng khi start backend.</li>
                  </ul>
                </p>
              </div>

              {/* Technical Card 3: Safe Mocking */}
              <div className="tech-card">
                <h4 style={{ color: "var(--warning)", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  Cơ Chế Mock AI Grading Fallback
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                  Nếu bạn cấu hình sai hoặc không có khóa API Google Gemini thật, backend sẽ kích hoạt <strong>Chế độ Mock Fallback</strong>. Thay vì ném lỗi crash chương trình, AI Engine sẽ tự động trích xuất các từ khóa của Rubric và tạo điểm số/highlight giả lập chất lượng cao để trải nghiệm giao diện người dùng không bị đứt quãng.
                </p>
              </div>

              {/* Technical Card 4: Encryption */}
              <div className="tech-card">
                <h4 style={{ color: "#7e22ce", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  Bảo Mật & Mã Hóa API Keys
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                  Để đảm bảo an toàn tuyệt đối cho khóa API cá nhân của giảng viên lưu trong hệ thống dữ liệu dùng chung, backend sử dụng thuật toán mã hóa đối xứng <strong>Fernet AES</strong> cực kỳ bảo mật. Khóa API sẽ được giải mã tức thời trong RAM tại thời điểm gọi API chấm điểm và không bao giờ bị lộ dưới dạng văn bản thô.
                </p>
              </div>

              {/* Technical Card 5: Rate Limiter */}
              <div className="tech-card">
                <h4 style={{ color: "#ef4444", fontSize: "1.05rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
                  Rate Limit & Rate Limiter Control
                </h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", margin: 0 }}>
                  Hệ thống thiết lập bộ đếm tần suất gửi request ở backend nhằm tránh tấn công DDoS. Trên môi trường thử nghiệm cục bộ, cơ chế này có thể gây phiền phức khi reload liên tục. Do đó, bạn có thể thiết lập <code>DISABLE_RATE_LIMIT=true</code> trong tệp <code>.env</code> để tắt hoàn toàn Rate Limit.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* FAQ Section */}
        <div style={{ marginTop: "60px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
            <h3 style={{ fontSize: "1.4rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Câu Hỏi Thường Gặp (FAQs)
            </h3>
            <div style={{ position: "relative", width: "100%", maxWidth: "320px" }}>
              <input
                type="text"
                placeholder="Tìm câu hỏi/chủ đề..."
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                style={{
                  width: "100%", padding: "10px 16px", borderRadius: "10px", border: "1px solid var(--border)",
                  fontSize: "0.88rem", outline: "none", background: "var(--bg-surface)", transition: "all 0.2s"
                }}
              />
            </div>
          </div>

          {filteredFaqs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {filteredFaqs.map((faq) => {
                const globalIndex = faqs.findIndex(f => f.q === faq.q);
                const isOpen = openFaq === globalIndex;
                return (
                  <div className="faq-item" key={globalIndex}>
                    <button
                      type="button"
                      className="faq-q"
                      onClick={() => setOpenFaq(isOpen ? null : globalIndex)}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span className="badge badge-accent" style={{ fontSize: "0.68rem" }}>{faq.tag}</span>
                        {faq.q}
                      </span>
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        style={{
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.25s ease",
                          color: "var(--text-secondary)"
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="faq-a">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)", border: "1px dashed var(--border)", borderRadius: "12px" }}>
              Không tìm thấy câu hỏi nào phù hợp với tìm kiếm của bạn.
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
