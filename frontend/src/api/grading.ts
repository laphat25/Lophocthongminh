import { apiFetch, API_BASE, getToken } from "./base";
import type { FeedbackItem } from "../types/feedback";
import type {
  GradingResult, Submission, RubricCriteria,
  GradeRow, GradeStats, CitationReport,
} from "../types";

export async function autoGrade(submissionId: string): Promise<GradingResult & { feedbacks?: FeedbackItem[] }> {
  return apiFetch(`/submissions/${submissionId}/grade/auto`, { method: "POST" });
}

export async function getGrade(submissionId: string): Promise<{
  grading: GradingResult;
  submission: Submission;
  rubric: RubricCriteria[];
  feedbacks?: FeedbackItem[];
}> {
  return apiFetch(`/submissions/${submissionId}/grade`);
}

export async function saveGrade(submissionId: string, data: {
  criteria_scores: { criteria_id: string; final_score: number; teacher_comment: string }[];
  overall_comment: string;
}): Promise<GradingResult> {
  return apiFetch(`/submissions/${submissionId}/grade`, { method: "PUT", body: JSON.stringify(data) });
}

export async function publishGrade(submissionId: string): Promise<void> {
  return apiFetch(`/submissions/${submissionId}/grade/publish`, { method: "POST" });
}

export async function gradeAll(assignmentId: string): Promise<{ message: string; graded_count: number; task_id?: string }> {
  return apiFetch(`/assignments/${assignmentId}/grade/auto-all`, { method: "POST" });
}

export async function publishAll(assignmentId: string): Promise<{ message: string; published_count: number }> {
  return apiFetch(`/assignments/${assignmentId}/grade/publish-all`, { method: "POST" });
}

export async function getAssignmentGrades(assignmentId: string, skip?: number, limit?: number): Promise<{ grades: GradeRow[]; stats: GradeStats; rubric: RubricCriteria[] }> {
  const params = new URLSearchParams();
  if (skip !== undefined) params.append("skip", skip.toString());
  if (limit !== undefined) params.append("limit", limit.toString());
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/assignments/${assignmentId}/grades${qs}`);
}

export function getGradesExportUrl(assignmentId: string): string {
  return `${API_BASE}/assignments/${assignmentId}/grades/export`;
}

export async function verifyCitations(submissionId: string): Promise<CitationReport> {
  return apiFetch(`/submissions/${submissionId}/verify-citations`, { method: "POST" });
}

export function getWebSocketUrl(taskId: string): string {
  const base = API_BASE;
  if (!base.startsWith("http")) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws/tasks/${taskId}`;
  }
  const wsProtocol = base.startsWith("https") ? "wss:" : "ws:";
  const url = new URL(base);
  return `${wsProtocol}//${url.host}/ws/tasks/${taskId}`;
}

export async function quickGradeApi(data: {
  title: string;
  rubric: unknown[];
  files: File[];
}): Promise<{ message: string; class_id: string; assignment_id: string; task_id: string }> {
  const formData = new FormData();
  formData.append("title", data.title);
  formData.append("rubric", JSON.stringify(data.rubric));
  data.files.forEach((file) => {
    formData.append("files", file);
  });
  
  const token = getToken();
  const res = await fetch(`${API_BASE}/assignments/quick-grade`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Khởi tạo chấm nhanh thất bại");
  }
  return res.json();
}
