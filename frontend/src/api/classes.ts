import { apiFetch } from "./base";
import type { ClassItem, Enrollment } from "../types";

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
