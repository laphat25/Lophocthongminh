/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";

import {
  getGrade, autoGrade, saveGrade, publishGrade,
  addFeedback, resolveFeedback, dismissFeedback, verifyCitations
} from "../api/client";
import type { GradingResult, Submission, RubricCriteria } from "../types";
import type { FeedbackItem } from "../types/feedback";
import { useAnchorNavigation } from "../hooks/useAnchorNavigation";

interface GradingContextProps {
  submissionId: string | undefined;
  grading: GradingResult | null;
  submission: Submission | null;
  rubric: RubricCriteria[];
  localScores: Record<string, { final_score: number; teacher_comment: string }>;
  loading: boolean;
  saving: boolean;
  overallComment: string;
  msg: { text: string; type: "success" | "error" } | null;
  running: boolean;
  viewMode: "text" | "file" | "citations";
  docxHtml: string | null;
  docxLoading: boolean;
  verifyingCitations: boolean;
  feedbacks: FeedbackItem[];
  activeFeedbackId: string | null;
  showAddModal: boolean;
  manualFeedbackData: { start: number; end: number; text: string } | null;
  
  // Manual feedback modal states
  manualSeverity: string;
  manualCategory: string;
  manualCriteriaId: string;
  manualComment: string;
  manualEvidence: string;
  hasSuggestedFix: boolean;
  suggestedReplacement: string;
  suggestedExplanation: string;
  
  // State Setters
  setLocalScores: React.Dispatch<React.SetStateAction<Record<string, { final_score: number; teacher_comment: string }>>>;
  setOverallComment: (comment: string) => void;
  setViewMode: (mode: "text" | "file" | "citations") => void;
  setActiveFeedbackId: (id: string | null) => void;
  setShowAddModal: (show: boolean) => void;
  setManualFeedbackData: (data: { start: number; end: number; text: string } | null) => void;
  setManualSeverity: (sev: string) => void;
  setManualCategory: (cat: string) => void;
  setManualCriteriaId: (id: string) => void;
  setManualComment: (comment: string) => void;
  setManualEvidence: (ev: string) => void;
  setHasSuggestedFix: (has: boolean) => void;
  setSuggestedReplacement: (rep: string) => void;
  setSuggestedExplanation: (exp: string) => void;
  setMsg: (msg: { text: string; type: "success" | "error" } | null) => void;

  // Handlers
  fetchData: () => Promise<void>;
  handleAutoGrade: () => Promise<void>;
  handleVerifyCitations: () => Promise<void>;
  handleSave: () => Promise<void>;
  handlePublish: () => Promise<void>;
  handleResolveFeedback: (id: string) => Promise<void>;
  handleDismissFeedback: (id: string) => Promise<void>;
  handleHighlightClick: (feedbackIds: string[]) => void;
  handleFeedbackClick: (feedbackId: string) => void;
  handleOpenAddModal: (start: number, end: number, text: string) => void;
  handleCreateManualFeedback: (e: React.FormEvent) => Promise<void>;
  computeTotal: () => number;
  
  // Navigation refs
  submissionRef: React.RefObject<HTMLDivElement | null>;
  registerFeedbackRef: (id: string, el: HTMLDivElement | null) => void;
  scrollToAnchor: (id: string) => void;
  scrollToFeedback: (id: string) => void;
}

const GradingContext = createContext<GradingContextProps | undefined>(undefined);

const API_HOST = import.meta.env.VITE_API_HOST || "http://localhost:8000";

export function GradingProvider({ children }: { children: React.ReactNode }) {
  const { submissionId } = useParams<{ submissionId: string }>();
  const [grading, setGrading] = useState<GradingResult | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [rubric, setRubric] = useState<RubricCriteria[]>([]);
  const [localScores, setLocalScores] = useState<Record<string, { final_score: number; teacher_comment: string }>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [overallComment, setOverallComment] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [running, setRunning] = useState(false);
  const [viewMode, setViewMode] = useState<"text" | "file" | "citations">("text");
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [verifyingCitations, setVerifyingCitations] = useState(false);

  // Feedback anchoring state
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [activeFeedbackId, setActiveFeedbackId] = useState<string | null>(null);
  const { submissionRef, scrollToAnchor, scrollToFeedback, registerFeedbackRef } = useAnchorNavigation();

  // Manual feedback creation state
  const [showAddModal, setShowAddModal] = useState(false);
  const [manualFeedbackData, setManualFeedbackData] = useState<{ start: number; end: number; text: string } | null>(null);
  const [manualSeverity, setManualSeverity] = useState<string>("warning");
  const [manualCategory, setManualCategory] = useState<string>("grammar");
  const [manualCriteriaId, setManualCriteriaId] = useState<string>("");
  const [manualComment, setManualComment] = useState<string>("");
  const [manualEvidence, setManualEvidence] = useState<string>("");
  const [hasSuggestedFix, setHasSuggestedFix] = useState<boolean>(false);
  const [suggestedReplacement, setSuggestedReplacement] = useState<string>("");
  const [suggestedExplanation, setSuggestedExplanation] = useState<string>("");

  const fetchData = useCallback(async () => {
    if (!submissionId) return;
    try {
      const data = await getGrade(submissionId);
      setGrading(data.grading);
      setSubmission(data.submission);
      setRubric(data.rubric);
      setOverallComment(data.grading?.overall_comment || "");
      const scores: Record<string, { final_score: number; teacher_comment: string }> = {};
      if (data.grading && Array.isArray(data.grading.criteria_scores)) {
        data.grading.criteria_scores.forEach((cs) => {
          scores[cs.criteria_id] = { final_score: cs.final_score, teacher_comment: cs.teacher_comment };
        });
      }
      setLocalScores(scores);
      if (data.feedbacks) {
        setFeedbacks(data.feedbacks);
      }
    } catch (e) {
      console.error("Lỗi lấy thông tin chấm điểm:", e);
    } finally {
      setLoading(false);
    }
  }, [submissionId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResolveFeedback = async (id: string) => {
    try {
      const updated = await resolveFeedback(id);
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi giải quyết nhận xét");
    }
  };

  const handleDismissFeedback = async (id: string) => {
    try {
      const updated = await dismissFeedback(id);
      setFeedbacks((prev) => prev.map((f) => (f.id === id ? updated : f)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi bỏ qua nhận xét");
    }
  };

  const handleHighlightClick = useCallback((feedbackIds: string[]) => {
    if (feedbackIds.length > 0) {
      setActiveFeedbackId(feedbackIds[0]);
      scrollToFeedback(feedbackIds[0]);
    }
  }, [scrollToFeedback]);

  const handleFeedbackClick = useCallback((feedbackId: string) => {
    setActiveFeedbackId(feedbackId);
    scrollToAnchor(feedbackId);
  }, [scrollToAnchor]);

  const handleOpenAddModal = useCallback((start: number, end: number, text: string) => {
    setManualFeedbackData({ start, end, text });
    setSuggestedReplacement(text);
    setManualComment("");
    setManualEvidence("");
    setHasSuggestedFix(false);
    setSuggestedExplanation("");
    setManualSeverity("warning");
    setManualCategory("grammar");
    setManualCriteriaId("");
    setShowAddModal(true);
  }, []);

  const handleCreateManualFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionId || !manualFeedbackData) return;
    try {
      const fixPayload = hasSuggestedFix ? {
        replacement_text: suggestedReplacement,
        explanation: suggestedExplanation,
      } : null;

      const newFb = await addFeedback(submissionId, {
        char_offset_start: manualFeedbackData.start,
        char_offset_end: manualFeedbackData.end,
        severity: manualSeverity,
        category: manualCategory,
        criteria_id: manualCriteriaId,
        comment: manualComment,
        suggested_fix: fixPayload,
      });

      setFeedbacks((prev) => [...prev, newFb]);
      setShowAddModal(false);
      setManualFeedbackData(null);
      setMsg({ text: "Thêm nhận xét thành công!", type: "success" });
      setTimeout(() => setMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setMsg({ text: err instanceof Error ? err.message : "Không thể thêm nhận xét", type: "error" });
    }
  };

  // Pre-load Word Doc preview if needed
  useEffect(() => {
    if (viewMode === "file" && submission?.file_url && submission.file_name?.toLowerCase().endsWith(".docx")) {
      if (!docxHtml && !docxLoading) {
        setDocxLoading(true);
        const url = `${API_HOST}${submission.file_url}`;
        fetch(url)
          .then((res) => {
            if (!res.ok) throw new Error("Không thể tải file Word");
            return res.arrayBuffer();
          })
          .then((arrayBuffer) => {
            const mammoth = (window as { mammoth?: { convertToHtml: (arg: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> } }).mammoth;
            if (mammoth) {
              return mammoth.convertToHtml({ arrayBuffer });
            } else {
              throw new Error("Thư viện Mammoth chưa được nạp");
            }
          })
          .then((result) => {
            setDocxHtml(result.value || "<p>File rỗng</p>");
          })
          .catch((err) => {
            console.error(err);
            setDocxHtml(`<p style="color:var(--error); padding: 20px;">Lỗi nạp bản xem trước file Word: ${err.message}</p>`);
          })
          .finally(() => {
            setDocxLoading(false);
          });
      }
    }
  }, [viewMode, submission, docxHtml, docxLoading]);

  const handleAutoGrade = async () => {
    if (!submissionId) return;
    setRunning(true);
    setMsg(null);
    try {
      const result = await autoGrade(submissionId);
      setGrading(result);
      setOverallComment(result.overall_comment || "");
      const scores: Record<string, { final_score: number; teacher_comment: string }> = {};
      result.criteria_scores.forEach((cs) => {
        scores[cs.criteria_id] = { final_score: cs.final_score, teacher_comment: cs.teacher_comment };
      });
      setLocalScores(scores);
      if (result.feedbacks) {
        setFeedbacks(result.feedbacks);
      }
      setMsg({ text: "AI đã chấm xong!", type: "success" });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Lỗi AI chấm", type: "error" });
    } finally {
      setRunning(false);
    }
  };

  const handleVerifyCitations = async () => {
    if (!submissionId) return;
    setVerifyingCitations(true);
    setMsg(null);
    try {
      const report = await verifyCitations(submissionId);
      setSubmission((prev) => prev ? { ...prev, citation_report: report } : null);
      setMsg({ text: "Đã kiểm chứng xong tài liệu tham khảo!", type: "success" });
    } catch (err) {
      console.error(err);
      setMsg({ text: err instanceof Error ? err.message : "Lỗi kiểm chứng tài liệu tham khảo", type: "error" });
    } finally {
      setVerifyingCitations(false);
    }
  };

  const handleSave = async () => {
    if (!submissionId || !grading) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        criteria_scores: grading.criteria_scores.map((cs) => ({
          criteria_id: cs.criteria_id,
          final_score: localScores[cs.criteria_id]?.final_score ?? cs.final_score,
          teacher_comment: localScores[cs.criteria_id]?.teacher_comment ?? cs.teacher_comment,
        })),
        overall_comment: overallComment,
      };
      const updated = await saveGrade(submissionId, payload);
      setGrading(updated);
      setMsg({ text: "Đã lưu điểm thành công!", type: "success" });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Lỗi lưu điểm", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!submissionId) return;
    try {
      await publishGrade(submissionId);
      setMsg({ text: "Đã công bố điểm cho sinh viên!", type: "success" });
      fetchData();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Lỗi công bố", type: "error" });
    }
  };

  const computeTotal = () => {
    if (!grading) return 0;
    let total = 0;
    grading.criteria_scores.forEach((cs) => {
      const score = localScores[cs.criteria_id]?.final_score ?? cs.final_score;
      if (cs.max_score > 0) total += (score / cs.max_score) * cs.weight;
    });
    return Math.round(total * 10) / 10;
  };

  return (
    <GradingContext.Provider value={{
      submissionId,
      grading,
      submission,
      rubric,
      localScores,
      loading,
      saving,
      overallComment,
      msg,
      running,
      viewMode,
      docxHtml,
      docxLoading,
      verifyingCitations,
      feedbacks,
      activeFeedbackId,
      showAddModal,
      manualFeedbackData,
      
      manualSeverity,
      manualCategory,
      manualCriteriaId,
      manualComment,
      manualEvidence,
      hasSuggestedFix,
      suggestedReplacement,
      suggestedExplanation,
      
      setLocalScores,
      setOverallComment,
      setViewMode,
      setActiveFeedbackId,
      setShowAddModal,
      setManualFeedbackData,
      setManualSeverity,
      setManualCategory,
      setManualCriteriaId,
      setManualComment,
      setManualEvidence,
      setHasSuggestedFix,
      setSuggestedReplacement,
      setSuggestedExplanation,
      setMsg,

      fetchData,
      handleAutoGrade,
      handleVerifyCitations,
      handleSave,
      handlePublish,
      handleResolveFeedback,
      handleDismissFeedback,
      handleHighlightClick,
      handleFeedbackClick,
      handleOpenAddModal,
      handleCreateManualFeedback,
      computeTotal,

      submissionRef,
      registerFeedbackRef,
      scrollToAnchor,
      scrollToFeedback
    }}>
      {children}
    </GradingContext.Provider>
  );
}

export function useGrading() {
  const context = useContext(GradingContext);
  if (!context) {
    throw new Error("useGrading must be used within a GradingProvider");
  }
  return context;
}
