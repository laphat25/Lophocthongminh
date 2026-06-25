import { apiFetch, API_BASE, getToken } from "./base";

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
