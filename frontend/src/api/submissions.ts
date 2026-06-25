import { apiFetch, API_BASE, getToken } from "./base";
import type { Submission } from "../types";

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
