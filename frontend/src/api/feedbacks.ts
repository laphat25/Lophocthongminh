import { apiFetch } from "./base";
import type { FeedbackItem, FeedbacksResponse } from "../types/feedback";

export async function getFeedbacks(
  submissionId: string,
  filters?: { severity?: string; category?: string; status?: string; criteria_id?: string }
): Promise<FeedbacksResponse> {
  const params = new URLSearchParams();
  if (filters?.severity) params.set("severity", filters.severity);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.status) params.set("status", filters.status);
  if (filters?.criteria_id) params.set("criteria_id", filters.criteria_id);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/submissions/${submissionId}/feedbacks${qs}`);
}

export async function addFeedback(
  submissionId: string,
  data: {
    char_offset_start: number;
    char_offset_end: number;
    severity: string;
    category: string;
    criteria_id: string;
    comment: string;
    suggested_fix?: { replacement_text: string; explanation: string } | null;
  }
): Promise<FeedbackItem> {
  return apiFetch(`/submissions/${submissionId}/feedbacks`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function resolveFeedback(feedbackId: string): Promise<FeedbackItem> {
  return apiFetch(`/feedbacks/${feedbackId}/resolve`, { method: "PUT" });
}

export async function dismissFeedback(feedbackId: string): Promise<FeedbackItem> {
  return apiFetch(`/feedbacks/${feedbackId}/dismiss`, { method: "PUT" });
}

export async function acceptFix(feedbackId: string): Promise<FeedbackItem> {
  return apiFetch(`/feedbacks/${feedbackId}/fix/accept`, { method: "PUT" });
}

export async function rejectFix(feedbackId: string): Promise<FeedbackItem> {
  return apiFetch(`/feedbacks/${feedbackId}/fix/reject`, { method: "PUT" });
}
