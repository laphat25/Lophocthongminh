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
}

export const RUBRIC_TEMPLATES: RubricTemplate[] = [];

export function getRubricTemplates(): RubricTemplate[] {
  const local = localStorage.getItem("custom_rubric_templates");
  const custom = local ? JSON.parse(local) : [];
  return [...RUBRIC_TEMPLATES, ...custom];
}

export function saveCustomRubricTemplate(template: Omit<RubricTemplate, "id">) {
  const local = localStorage.getItem("custom_rubric_templates");
  const custom: RubricTemplate[] = local ? JSON.parse(local) : [];
  const newTemplate: RubricTemplate = {
    ...template,
    id: `CUSTOM_${Date.now()}`
  };
  custom.push(newTemplate);
  localStorage.setItem("custom_rubric_templates", JSON.stringify(custom));
  return newTemplate;
}
