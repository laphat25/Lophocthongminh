import { apiFetch } from "./base";
import type { PlagiarismReport, PlagiarismPairDetail } from "../types";

export async function triggerPlagiarismCheck(assignmentId: string): Promise<{ message: string; status: string; task_id?: string }> {
  return apiFetch(`/assignments/${assignmentId}/plagiarism/check`, { method: "POST" });
}

export async function getPlagiarismReport(assignmentId: string): Promise<PlagiarismReport> {
  return apiFetch(`/assignments/${assignmentId}/plagiarism/report`);
}

export async function getPlagiarismPair(assignmentId: string, subA: string, subB: string): Promise<PlagiarismPairDetail> {
  return apiFetch(`/assignments/${assignmentId}/plagiarism/pair/${subA}/${subB}`);
}
