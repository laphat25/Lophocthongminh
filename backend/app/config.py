import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = BASE_DIR / "uploads"

# JSON storage files
USERS_FILE = DATA_DIR / "users.json"
CLASSES_FILE = DATA_DIR / "classes.json"
ENROLLMENTS_FILE = DATA_DIR / "enrollments.json"
ASSIGNMENTS_FILE = DATA_DIR / "assignments.json"
NEW_SUBMISSIONS_FILE = DATA_DIR / "new_submissions.json"
GRADING_FILE = DATA_DIR / "grading_results.json"
PLAGIARISM_FILE = DATA_DIR / "plagiarism_reports.json"

# Old files (backward compat)
SUBMISSIONS_FILE = DATA_DIR / "submissions.json"
RUBRIC_FILE = DATA_DIR / "rubric.json"
RUBRIC_TEMPLATES_FILE = DATA_DIR / "rubric_templates.json"

DATA_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24
