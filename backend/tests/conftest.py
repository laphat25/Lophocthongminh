import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token, hash_password

@pytest.fixture(autouse=True)
def mock_stores(tmp_path):
    from app import storage
    
    # Point stores to temp files
    storage.user_store._file = tmp_path / "users.json"
    storage.user_store._data = {}
    
    storage.class_store._file = tmp_path / "classes.json"
    storage.class_store._data = {}
    
    storage.enrollment_store._file = tmp_path / "enrollments.json"
    storage.enrollment_store._data = []
    
    storage.assignment_store._file = tmp_path / "assignments.json"
    storage.assignment_store._data = {}
    
    storage.submission_store._file = tmp_path / "new_submissions.json"
    storage.submission_store._data = {}
    
    storage.grading_store._file = tmp_path / "grading.json"
    storage.grading_store._data = {}
    
    storage.plagiarism_store._file = tmp_path / "plagiarism.json"
    storage.plagiarism_store._data = {}
    
    storage.rubric_template_store._file = tmp_path / "rubric_templates.json"
    storage.rubric_template_store._data = {}
    
    storage.feedback_store._file = tmp_path / "feedbacks.json"
    storage.feedback_store._data = {}
    
    storage.question_store._file = tmp_path / "questions.json"
    storage.question_store._data = {}
    
    # Save initial state
    storage.user_store._save()
    storage.class_store._save()
    storage.enrollment_store._save()
    storage.assignment_store._save()
    storage.submission_store._save()
    storage.grading_store._save()
    storage.plagiarism_store._save()
    storage.rubric_template_store._save()
    storage.feedback_store._save()
    storage.question_store._save()

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def teacher_user():
    from app import storage
    user_id = "test_teacher_id"
    user_data = {
        "id": user_id,
        "email": "teacher@test.com",
        "password_hash": hash_password("pass1234"),
        "full_name": "Test Teacher",
        "role": "teacher",
        "is_active": True,
        "created_at": "2026-06-20T12:00:00Z"
    }
    storage.user_store.set(user_id, user_data)
    return user_data

@pytest.fixture
def teacher_token(teacher_user):
    return create_access_token({"sub": teacher_user["id"]})

@pytest.fixture
def teacher_headers(teacher_token):
    return {"Authorization": f"Bearer {teacher_token}"}

@pytest.fixture
def student_user():
    from app import storage
    user_id = "test_student_id"
    user_data = {
        "id": user_id,
        "email": "student@test.com",
        "password_hash": hash_password("pass1234"),
        "full_name": "Test Student",
        "role": "student",
        "student_id": "SV001",
        "is_active": True,
        "created_at": "2026-06-20T12:00:00Z"
    }
    storage.user_store.set(user_id, user_data)
    return user_data

@pytest.fixture
def student_token(student_user):
    return create_access_token({"sub": student_user["id"]})

@pytest.fixture
def student_headers(student_token):
    return {"Authorization": f"Bearer {student_token}"}
