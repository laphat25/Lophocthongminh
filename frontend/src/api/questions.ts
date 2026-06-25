import { apiFetch } from "./base";
import type { Question } from "../types";

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
