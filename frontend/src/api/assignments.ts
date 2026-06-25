import { apiFetch } from "./base";
import type { Assignment, RubricCriteria } from "../types";

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
