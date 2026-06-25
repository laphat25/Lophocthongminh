from app.config import (
    USERS_FILE, CLASSES_FILE, ENROLLMENTS_FILE, ASSIGNMENTS_FILE,
    NEW_SUBMISSIONS_FILE, GRADING_FILE, PLAGIARISM_FILE,
    RUBRIC_TEMPLATES_FILE, FEEDBACKS_FILE, QUESTIONS_FILE,
)

from .connection import get_db_cursor, is_postgres_active, db_pool
from .schema import init_pg_tables
from .pg_store import PgRelationalStore, PgRelationalListStore
from .json_store import JsonStore, ListStore

if is_postgres_active:
    # Initialize the tables in PostgreSQL first
    init_pg_tables()
    
    user_store = PgRelationalStore("users", ["id", "email", "password_hash", "full_name", "role", "student_id", "is_active", "gemini_api_key", "ai_provider", "created_at", "updated_at"])
    class_store = PgRelationalStore("classes", ["id", "class_name", "subject", "class_code", "teacher_id", "teacher_name", "description", "is_active", "created_at"])
    enrollment_store = PgRelationalListStore("enrollments", ["id", "class_id", "student_id", "student_name", "student_email", "joined_at", "status"])
    assignment_store = PgRelationalStore("assignments", ["id", "class_id", "class_name", "teacher_id", "teacher_name", "title", "description", "submission_type", "allow_resubmit", "open_at", "deadline", "status", "pass_threshold", "rubric", "created_at", "updated_at"], json_cols=["rubric"])
    submission_store = PgRelationalStore("new_submissions", ["id", "assignment_id", "student_id", "student_name", "version", "content_text", "file_url", "file_name", "submitted_at", "status", "word_count", "plagiarism_score", "plagiarism_flagged", "citation_report"], json_cols=["citation_report"])
    grading_store = PgRelationalStore("grading_results", ["id", "submission_id", "assignment_id", "student_id", "student_name", "graded_by", "criteria_scores", "total_score", "overall_comment", "graded_at", "published_at", "status"], json_cols=["criteria_scores"])
    plagiarism_store = PgRelationalStore("plagiarism_reports", ["id", "assignment_id", "generated_at", "status", "pairs", "summary"], json_cols=["pairs", "summary"])
    rubric_template_store = PgRelationalStore("rubric_templates", ["id", "name", "description", "criteria", "created_by", "created_at"], json_cols=["criteria"])
    feedback_store = PgRelationalStore("feedbacks", ["id", "submission_id", "char_offset_start", "char_offset_end", "severity", "category", "criteria_id", "comment", "suggested_fix", "is_resolved", "is_dismissed", "created_at"], json_cols=["suggested_fix"])
    question_store = PgRelationalStore("questions", ["id", "data"], json_cols=["data"])
else:
    user_store = JsonStore(USERS_FILE)
    class_store = JsonStore(CLASSES_FILE)
    enrollment_store = ListStore(ENROLLMENTS_FILE)
    assignment_store = JsonStore(ASSIGNMENTS_FILE)
    submission_store = JsonStore(NEW_SUBMISSIONS_FILE)
    grading_store = JsonStore(GRADING_FILE)
    plagiarism_store = JsonStore(PLAGIARISM_FILE)
    rubric_template_store = JsonStore(RUBRIC_TEMPLATES_FILE)
    feedback_store = JsonStore(FEEDBACKS_FILE)
    question_store = JsonStore(QUESTIONS_FILE)
