const API_BASE = "http://localhost:8000/api";

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
import type {
  AuthResponse, ClassItem, Enrollment,
  Assignment, Submission, GradingResult,
  GradeRow, GradeStats, RubricCriteria,
  PlagiarismReport,
  // Legacy
  SubmissionListResponse, UploadResponse, GradeResponse, GradeAllResponse,
} from "../types";

export async function registerUser(data: {
  email: string; password: string; full_name: string; role: string; student_id?: string;
}): Promise<AuthResponse> {
  return apiFetch("/auth/register", { method: "POST", body: JSON.stringify(data) });
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  return apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

// ─── Classes ──────────────────────────────────────────────────────────────────
export async function getClasses(): Promise<{ classes: ClassItem[]; total: number }> {
  return apiFetch("/classes");
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
export async function getAssignments(classId?: string): Promise<{ assignments: Assignment[]; total: number }> {
  const qs = classId ? `?class_id=${classId}` : "";
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

export async function getAssignmentSubmissions(assignmentId: string): Promise<{ submissions: Submission[]; total: number }> {
  return apiFetch(`/assignments/${assignmentId}/submissions`);
}

export async function getMySubmissions(): Promise<{ submissions: Submission[]; total: number }> {
  return apiFetch("/submissions/my");
}

export async function getSubmission(id: string): Promise<Submission> {
  return apiFetch(`/submissions/${id}`);
}

// ─── Grading ──────────────────────────────────────────────────────────────────
export async function autoGrade(submissionId: string): Promise<GradingResult> {
  return apiFetch(`/submissions/${submissionId}/grade/auto`, { method: "POST" });
}

export async function getGrade(submissionId: string): Promise<{ grading: GradingResult; submission: Submission; rubric: RubricCriteria[] }> {
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

export async function gradeAll(assignmentId: string): Promise<{ message: string; graded_count: number }> {
  return apiFetch(`/assignments/${assignmentId}/grade/auto-all`, { method: "POST" });
}

export async function publishAll(assignmentId: string): Promise<{ message: string; published_count: number }> {
  return apiFetch(`/assignments/${assignmentId}/grade/publish-all`, { method: "POST" });
}

export async function getAssignmentGrades(assignmentId: string): Promise<{ grades: GradeRow[]; stats: GradeStats; rubric: RubricCriteria[] }> {
  return apiFetch(`/assignments/${assignmentId}/grades`);
}

export function getGradesExportUrl(assignmentId: string): string {
  return `${API_BASE}/assignments/${assignmentId}/grades/export`;
}

// ─── Plagiarism ───────────────────────────────────────────────────────────────
export async function triggerPlagiarismCheck(assignmentId: string): Promise<{ message: string; status: string }> {
  return apiFetch(`/assignments/${assignmentId}/plagiarism/check`, { method: "POST" });
}

export async function getPlagiarismReport(assignmentId: string): Promise<PlagiarismReport> {
  return apiFetch(`/assignments/${assignmentId}/plagiarism/report`);
}

export async function getPlagiarismPair(assignmentId: string, subA: string, subB: string): Promise<any> {
  return apiFetch(`/assignments/${assignmentId}/plagiarism/pair/${subA}/${subB}`);
}

// ─── Legacy endpoints ─────────────────────────────────────────────────────────
export async function getSubmissions(): Promise<SubmissionListResponse> {
  const res = await fetch(`${API_BASE}/submissions`);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
  return res.json();
}

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Upload failed");
  }
  return res.json();
}

export async function gradeSubmission(studentId: string): Promise<GradeResponse> {
  const res = await fetch(`${API_BASE}/grade/${studentId}`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Grading failed");
  }
  return res.json();
}

// gradeAll(assignmentId) is defined above in the MVP grading section

export async function gradeAllLegacy(): Promise<GradeAllResponse> {
  const res = await fetch(`${API_BASE}/grade-all`, { method: "POST" });
  if (!res.ok) throw new Error(`Failed to grade: ${res.statusText}`);
  return res.json();
}

export async function getRubric(): Promise<{ content: string }> {
  const res = await fetch(`${API_BASE}/rubric`);
  if (!res.ok) throw new Error(`Failed to fetch rubric: ${res.statusText}`);
  return res.json();
}

export async function updateRubric(content: string): Promise<{ message: string; content: string }> {
  const res = await fetch(`${API_BASE}/rubric`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Failed to update rubric");
  }
  return res.json();
}

export async function updateUserSettings(data: { gemini_api_key: string }): Promise<{ message: string; user: any }> {
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

