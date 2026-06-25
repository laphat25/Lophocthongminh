import { apiFetch } from "./base";
import type { AuthResponse, User } from "../types";

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

export async function updateUserSettings(data: { gemini_api_key?: string; ai_provider?: string }): Promise<{ message: string; user: User }> {
  return apiFetch("/auth/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function logoutUser(): Promise<{ message: string }> {
  return apiFetch("/auth/logout", {
    method: "POST",
  });
}
