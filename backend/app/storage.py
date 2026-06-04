import json
from pathlib import Path
from typing import Optional
from app.config import (
    USERS_FILE, CLASSES_FILE, ENROLLMENTS_FILE, ASSIGNMENTS_FILE,
    NEW_SUBMISSIONS_FILE, GRADING_FILE, PLAGIARISM_FILE,
    SUBMISSIONS_FILE, RUBRIC_TEMPLATES_FILE,
)


# ---------------------------------------------------------------------------
# Generic stores
# ---------------------------------------------------------------------------

class JsonStore:
    """Dict-based JSON store (key = item id)."""

    def __init__(self, filepath: Path):
        self._file = filepath
        self._data: dict = {}
        self._load()

    def _load(self):
        if self._file.exists():
            try:
                with open(self._file, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            except Exception:
                self._data = {}

    def _save(self):
        with open(self._file, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)

    def get(self, key: str) -> Optional[dict]:
        return self._data.get(key)

    def all(self) -> dict:
        return dict(self._data)

    def values(self) -> list:
        return list(self._data.values())

    def set(self, key: str, value: dict):
        self._data[key] = value
        self._save()

    def delete(self, key: str):
        if key in self._data:
            del self._data[key]
            self._save()

    def find(self, **kwargs) -> list:
        return [v for v in self._data.values() if all(v.get(k) == val for k, val in kwargs.items())]

    def find_one(self, **kwargs) -> Optional[dict]:
        for v in self._data.values():
            if all(v.get(k) == val for k, val in kwargs.items()):
                return v
        return None


class ListStore:
    """List-based JSON store."""

    def __init__(self, filepath: Path):
        self._file = filepath
        self._data: list = []
        self._load()

    def _load(self):
        if self._file.exists():
            try:
                with open(self._file, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            except Exception:
                self._data = []

    def _save(self):
        with open(self._file, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)

    def all(self) -> list:
        return list(self._data)

    def add(self, item: dict):
        self._data.append(item)
        self._save()

    def update_by_id(self, item_id: str, updates: dict, id_field: str = "id"):
        for item in self._data:
            if item.get(id_field) == item_id:
                item.update(updates)
                break
        self._save()

    def delete_by_id(self, item_id: str, id_field: str = "id"):
        self._data = [i for i in self._data if i.get(id_field) != item_id]
        self._save()

    def find(self, **kwargs) -> list:
        return [i for i in self._data if all(i.get(k) == v for k, v in kwargs.items())]

    def find_one(self, **kwargs) -> Optional[dict]:
        for i in self._data:
            if all(i.get(k) == v for k, v in kwargs.items()):
                return i
        return None


# ---------------------------------------------------------------------------
# Instantiate stores
# ---------------------------------------------------------------------------

user_store = JsonStore(USERS_FILE)
class_store = JsonStore(CLASSES_FILE)
enrollment_store = ListStore(ENROLLMENTS_FILE)
assignment_store = JsonStore(ASSIGNMENTS_FILE)
submission_store = JsonStore(NEW_SUBMISSIONS_FILE)
grading_store = JsonStore(GRADING_FILE)
plagiarism_store = JsonStore(PLAGIARISM_FILE)
rubric_template_store = JsonStore(RUBRIC_TEMPLATES_FILE)


# ---------------------------------------------------------------------------
# Old backward-compat Submission store (used by old upload/grade endpoints)
# ---------------------------------------------------------------------------

from app.models import Submission  # noqa: E402


class SubmissionStore:
    def __init__(self):
        self._store: dict[str, Submission] = {}
        self._load()

    def _load(self):
        if SUBMISSIONS_FILE.exists():
            with open(SUBMISSIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            for student_id, record in data.items():
                self._store[student_id] = Submission(**record)

    def _save(self):
        data = {sid: sub.model_dump() for sid, sub in self._store.items()}
        with open(SUBMISSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def get(self, student_id: str):
        return self._store.get(student_id)

    def get_all(self) -> dict:
        return self._store

    def upsert(self, submission: Submission):
        self._store[submission.student_id] = submission
        self._save()

    def get_all_texts_except(self, exclude_id: str) -> list[str]:
        return [
            sub.extracted_text
            for sid, sub in self._store.items()
            if sid != exclude_id and sub.extracted_text
        ]


store = SubmissionStore()
