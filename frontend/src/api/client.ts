const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

// ─── Helper ──────────────────────────────────────────────────────────────────

function getToken(): string {
  return localStorage.getItem("auth_token") || "";
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Auth ────────────────────────────────────────────────────────────────────
import type { FeedbackItem } from "../types/feedback";
import type {
  AuthResponse, ClassItem, Enrollment,
  Assignment, Submission, GradingResult,
  GradeRow, GradeStats, RubricCriteria,
  PlagiarismReport, User, PlagiarismPairDetail, Question,
} from "../types";

export async function registerUser(data: {
  email: string; password: string; full_name: string; role: string; student_id?: string;
}): Promise<AuthResponse> {
  return apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) });
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  return apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function resetStudentPassword(studentId: string, newPassword: string): Promise<{ message: string }> {
  return apiFetch(`/auth/users/${studentId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ new_password: newPassword }),
  });
}

// ─── Classes ──────────────────────────────────────────────────────────────────
export async function getClasses(skip?: number, limit?: number): Promise<{ classes: ClassItem[]; total: number }> {
  const params = new URLSearchParams();
  if (skip !== undefined) params.append("skip", skip.toString());
  if (limit !== undefined) params.append("limit", limit.toString());
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/classes${qs}`);
}

export async function getClass(id: string): Promise<ClassItem> {
  return apiFetch(`/classes/${id}`);
}

export async function createClass(data: { class_name: string; subject: string; description: string }): Promise<ClassItem> {
  return apiFetch("/classes", { method: "POST", body: JSON.stringify(data) });
}

export async function joinClass(class_code: string): Promise<{ message: string; class: ClassItem }> {
  return apiFetch("/classes/join", { method: "POST", body: JSON.stringify({ class_code }) });
}

export async function getClassStudents(classId: string): Promise<{ students: Enrollment[]; total: number }> {
  return apiFetch(`/classes/${classId}/students`);
}

export async function removeStudent(classId: string, studentId: string): Promise<void> {
  return apiFetch(`/classes/${classId}/students/${studentId}`, { method: "DELETE" });
}

export async function deleteClassApi(classId: string): Promise<{ message: string }> {
  return apiFetch(`/classes/${classId}`, { method: "DELETE" });
}


// ─── Assignments ──────────────────────────────────────────────────────────────
export async function getAssignments(classId?: string, skip?: number, limit?: number): Promise<{ assignments: Assignment[]; total: number }> {
  const params = new URLSearchParams();
  if (classId) params.append("class_id", classId);
  if (skip !== undefined) params.append("skip", skip.toString());
  if (limit !== undefined) params.append("limit", limit.toString());
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/assignments${qs}`);
}

export async function getAssignment(id: string): Promise<Assignment> {
  return apiFetch(`/assignments/${id}`);
}

export async function createAssignment(data: {
  class_id: string; title: string; description: string; submission_type: string;
  allow_resubmit: boolean; open_at?: string; deadline?: string; pass_threshold: number;
  rubric: Omit<RubricCriteria, "criteria_id">[];
}): Promise<Assignment> {
  return apiFetch("/assignments", { method: "POST", body: JSON.stringify(data) });
}

export async function updateAssignment(id: string, data: Omit<Partial<Assignment>, "rubric"> & { rubric?: Omit<RubricCriteria, "criteria_id">[] }): Promise<Assignment> {
  return apiFetch(`/assignments/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function publishAssignment(id: string): Promise<void> {
  return apiFetch(`/assignments/${id}/publish`, { method: "PATCH" });
}

export async function closeAssignment(id: string): Promise<void> {
  return apiFetch(`/assignments/${id}/close`, { method: "PATCH" });
}

// ─── Submissions ──────────────────────────────────────────────────────────────
export async function submitText(assignmentId: string, content_text: string): Promise<Submission> {
  return apiFetch(`/assignments/${assignmentId}/submit/text`, {
    method: "POST",
    body: JSON.stringify({ assignment_id: assignmentId, content_text }),
  });
}

export async function submitFile(assignmentId: string, file: File): Promise<Submission> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/assignments/${assignmentId}/submit/file`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function getAssignmentSubmissions(assignmentId: string, skip?: number, limit?: number): Promise<{ submissions: Submission[]; total: number }> {
  const params = new URLSearchParams();
  if (skip !== undefined) params.append("skip", skip.toString());
  if (limit !== undefined) params.append("limit", limit.toString());
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/assignments/${assignmentId}/submissions${qs}`);
}

export async function getMySubmissions(): Promise<{ submissions: Submission[]; total: number }> {
  return apiFetch("/submissions/my");
}

export async function getSubmission(id: string): Promise<Submission> {
  return apiFetch(`/submissions/${id}`);
}

// ─── Grading ──────────────────────────────────────────────────────────────────
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

// ─── Plagiarism ───────────────────────────────────────────────────────────────
export async function triggerPlagiarismCheck(assignmentId: string): Promise<{ message: string; status: string; task_id?: string }> {
  return apiFetch(`/assignments/${assignmentId}/plagiarism/check`, { method: "POST" });
}

export async function getPlagiarismReport(assignmentId: string): Promise<PlagiarismReport> {
  return apiFetch(`/assignments/${assignmentId}/plagiarism/report`);
}

export async function getPlagiarismPair(assignmentId: string, subA: string, subB: string): Promise<PlagiarismPairDetail> {
  return apiFetch(`/assignments/${assignmentId}/plagiarism/pair/${subA}/${subB}`);
}

// ─── Questions ────────────────────────────────────────────────────────────────
export async function getQuestions(skip?: number, limit?: number): Promise<{ questions: Question[]; total: number }> {
  const params = new URLSearchParams();
  if (skip !== undefined) params.append("skip", skip.toString());
  if (limit !== undefined) params.append("limit", limit.toString());
  const qs = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/questions${qs}`);
}

export async function getQuestion(id: string): Promise<Question> {
  return apiFetch(`/questions/${id}`);
}

export async function createQuestion(data: {
  title: string; topic: string; difficulty: string; tags: string[]; content: string;
}): Promise<Question> {
  return apiFetch("/questions", { method: "POST", body: JSON.stringify(data) });
}

export async function updateQuestion(id: string, data: {
  title: string; topic: string; difficulty: string; tags: string[]; content: string;
}): Promise<Question> {
  return apiFetch(`/questions/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteQuestion(id: string): Promise<{ message: string }> {
  return apiFetch(`/questions/${id}`, { method: "DELETE" });
}

// ─── Question APIs ────────────────────────────────────────────────────────────

export async function updateUserSettings(data: { gemini_api_key: string }): Promise<{ message: string; user: User }> {
  return apiFetch("/auth/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export interface TemplateCriteria {
  criteria_name: string;
  max_score: number;
  weight: number;
  keywords: string[];
  levels: { score: number; description: string }[];
}

export interface RubricTemplate {
  id: string;
  name: string;
  description: string;
  criteria: TemplateCriteria[];
  created_by?: string;
}

export async function getRubricTemplatesApi(): Promise<{ templates: RubricTemplate[] }> {
  return apiFetch("/rubrics/templates");
}

export async function createCustomRubricTemplateApi(data: {
  name: string;
  description: string;
  criteria: Omit<TemplateCriteria, "id">[];
}): Promise<RubricTemplate> {
  return apiFetch("/rubrics/templates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteCustomRubricTemplateApi(templateId: string): Promise<{ message: string }> {
  return apiFetch(`/rubrics/templates/${templateId}`, {
    method: "DELETE",
  });
}

export async function uploadRubricTemplateApi(file: File): Promise<RubricTemplate> {
  const formData = new FormData();
  formData.append("file", file);
  const token = getToken();
  const res = await fetch(`${API_BASE}/rubrics/templates/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

// ─── Feedbacks ────────────────────────────────────────────────────────────────
import type { FeedbacksResponse } from "../types/feedback";

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

