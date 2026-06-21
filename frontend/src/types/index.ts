// ─── Auth ───────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "teacher" | "student" | "admin";
  student_id?: string;
  is_active: boolean;
  created_at: string;
  has_gemini_key?: boolean;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// ─── Classes ─────────────────────────────────────────────────────────────────
export interface ClassItem {
  id: string;
  class_name: string;
  subject: string;
  class_code: string;
  teacher_id: string;
  teacher_name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export interface Enrollment {
  id: string;
  class_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  joined_at: string;
  status: "active" | "removed";
}

// ─── Assignments ──────────────────────────────────────────────────────────────
export interface RubricLevel {
  score: number;
  description: string;
}

export interface RubricCriteria {
  criteria_id: string;
  criteria_name: string;
  max_score: number;
  weight: number;
  keywords: string[];
  levels: RubricLevel[];
}

export interface Assignment {
  id: string;
  class_id: string;
  class_name: string;
  teacher_id: string;
  teacher_name: string;
  title: string;
  description: string;
  submission_type: "text" | "file" | "both";
  allow_resubmit: boolean;
  open_at: string | null;
  deadline: string | null;
  status: "draft" | "published" | "closed";
  pass_threshold: number;
  rubric: RubricCriteria[];
  created_at: string;
  updated_at: string;
}

// ─── Submissions ──────────────────────────────────────────────────────────────
export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  version: number;
  content_text: string;
  file_url: string | null;
  file_name: string | null;
  submitted_at: string;
  status: "submitted" | "grading" | "graded" | "published";
  word_count: number;
  plagiarism_score: number;
  plagiarism_flagged: boolean;
}

// ─── Grading ──────────────────────────────────────────────────────────────────
export interface CriteriaScore {
  criteria_id: string;
  criteria_name: string;
  ai_suggested_score: number;
  ai_suggested_level: string;
  final_score: number;
  max_score: number;
  weight: number;
  teacher_comment: string;
  highlighted_text: string[];
}

export interface GradingResult {
  id: string;
  submission_id: string;
  assignment_id: string;
  student_id: string;
  student_name: string;
  graded_by: string;
  criteria_scores: CriteriaScore[];
  total_score: number;
  overall_comment: string;
  graded_at: string;
  published_at: string | null;
  status: "graded" | "published";
}

export interface GradeRow {
  submission_id: string;
  student_id: string;
  student_name: string;
  submitted_at: string;
  status: string;
  total_score: number | null;
  criteria_scores: CriteriaScore[];
  overall_comment: string;
}

export interface GradeStats {
  count: number;
  avg: number;
  max: number;
  min: number;
  pass_count: number;
  fail_count: number;
}

// ─── Plagiarism ───────────────────────────────────────────────────────────────
export interface PlagiarismPair {
  submission_a: string;
  student_a_name: string;
  submission_b: string;
  student_b_name: string;
  similarity_score: number;
  similarity_pct: number;
  flag: "ok" | "warning" | "severe";
}

export interface PlagiarismPairDetail {
  pair: PlagiarismPair | null;
  submission_a: {
    id: string;
    student_name: string;
    content_text: string;
    submitted_at: string;
  };
  submission_b: {
    id: string;
    student_name: string;
    content_text: string;
    submitted_at: string;
  };
}

export interface PlagiarismReport {
  id: string;
  assignment_id: string;
  generated_at: string;
  status: "pending" | "completed";
  pairs: PlagiarismPair[];
  summary: {
    total_submissions: number;
    total_pairs: number;
    flagged_pairs: number;
    severe_pairs: number;
    max_similarity_pct: number;
  };
}

// ─── Questions ────────────────────────────────────────────────────────────────
export interface Question {
  id: string;
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard" | string;
  tags: string[];
  content: string;
  created_by: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

