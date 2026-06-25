import Navbar from "../components/Navbar";
import FeedbackPanel from "../components/FeedbackPanel";
import { GradingProvider, useGrading } from "../context/GradingContext";
import GradingHeader from "../components/grading/GradingHeader";
import SubmissionPanel from "../components/grading/SubmissionPanel";
import RubricAssessmentPanel from "../components/grading/RubricAssessmentPanel";
import ManualFeedbackModal from "../components/grading/ManualFeedbackModal";

function GradingPageContent() {
  const {
    loading,
    msg,
    feedbacks,
    grading,
    activeFeedbackId,
    handleFeedbackClick,
    registerFeedbackRef,
    handleResolveFeedback,
    handleDismissFeedback,
  } = useGrading();

  if (loading) {
    return (
      <div className="page-layout">
        <Navbar />
        <div className="loading-state">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="page-layout">
      <Navbar />
      <main className="main-content" style={{ maxWidth: "1400px" }}>
        <GradingHeader />

        {msg && <div className={`alert ${msg.type === "success" ? "alert-success" : "alert-error"}`}>{msg.text}</div>}

        {/* Side-by-side layout */}
        <div className="grading-layout">
          <SubmissionPanel />
          <RubricAssessmentPanel />

          {/* Bottom panel: Feedback Panel */}
          {feedbacks.length > 0 && grading && (
            <div style={{ gridColumn: "1 / -1", marginTop: "8px" }}>
              <div className="card" style={{ padding: "16px 20px" }}>
                <FeedbackPanel
                  feedbacks={feedbacks}
                  activeFeedbackId={activeFeedbackId}
                  onFeedbackClick={handleFeedbackClick}
                  registerRef={registerFeedbackRef}
                  onResolve={handleResolveFeedback}
                  onDismiss={handleDismissFeedback}
                />
              </div>
            </div>
          )}
        </div>
      </main>

      <ManualFeedbackModal />
    </div>
  );
}

export default function GradingPage() {
  return (
    <GradingProvider>
      <GradingPageContent />
    </GradingProvider>
  );
}
