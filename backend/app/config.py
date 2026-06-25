import os
import secrets
from pathlib import Path
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import warnings

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR", str(BASE_DIR / "uploads")))
DATABASE_URL = os.getenv("DATABASE_URL", "")

# JSON storage files
USERS_FILE = DATA_DIR / "users.json"
CLASSES_FILE = DATA_DIR / "classes.json"
ENROLLMENTS_FILE = DATA_DIR / "enrollments.json"
ASSIGNMENTS_FILE = DATA_DIR / "assignments.json"
NEW_SUBMISSIONS_FILE = DATA_DIR / "new_submissions.json"
GRADING_FILE = DATA_DIR / "grading_results.json"
PLAGIARISM_FILE = DATA_DIR / "plagiarism_reports.json"
QUESTIONS_FILE = DATA_DIR / "questions.json"

# Old files (backward compat)
RUBRIC_TEMPLATES_FILE = DATA_DIR / "rubric_templates.json"
FEEDBACKS_FILE = DATA_DIR / "feedbacks.json"

DATA_DIR.mkdir(exist_ok=True)
UPLOADS_DIR.mkdir(exist_ok=True)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

JWT_SECRET = os.getenv("JWT_SECRET", "")
if not JWT_SECRET:
    JWT_SECRET = secrets.token_hex(32)
    warnings.warn("JWT_SECRET not set in .env! Using random key — sessions will reset on restart.")

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "8"))

# Encryption key for securing API Keys at rest
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "")
if not ENCRYPTION_KEY:
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    warnings.warn("ENCRYPTION_KEY not set in .env! Using temporary encryption key. Encrypted Gemini keys will not persist across restarts.")

_fernet = Fernet(ENCRYPTION_KEY.encode())

def encrypt_api_key(plain_key: str) -> str:
    if not plain_key:
        return ""
    return _fernet.encrypt(plain_key.encode()).decode()

def decrypt_api_key(cipher_key: str) -> str:
    if not cipher_key:
        return ""
    try:
        return _fernet.decrypt(cipher_key.encode()).decode()
    except Exception as e:
        if cipher_key.startswith("AIzaSy") or cipher_key.startswith("AQ."):
            return cipher_key
        warnings.warn(f"Failed to decrypt API key: {e}")
        return ""
