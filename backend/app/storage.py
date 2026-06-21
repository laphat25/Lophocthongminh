import json
from pathlib import Path
from typing import Optional
from app.config import (
    USERS_FILE, CLASSES_FILE, ENROLLMENTS_FILE, ASSIGNMENTS_FILE,
    NEW_SUBMISSIONS_FILE, GRADING_FILE, PLAGIARISM_FILE,
    RUBRIC_TEMPLATES_FILE, FEEDBACKS_FILE, QUESTIONS_FILE,
)


# ---------------------------------------------------------------------------
# Generic stores
# ---------------------------------------------------------------------------

import shutil
import threading
import warnings

class JsonStore:
    """Dict-based JSON store (key = item id) with file locking and backups."""

    def __init__(self, filepath: Path):
        self._file = filepath
        self._data: dict = {}
        self._lock = threading.Lock()
        self._load()

    def _load(self):
        if self._file.exists():
            try:
                with open(self._file, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            except Exception as e:
                warnings.warn(f"Failed to load JSON from {self._file}: {e}. Attempting recovery from backup...")
                backup = self._file.with_suffix(".json.bak")
                if backup.exists():
                    try:
                        with open(backup, "r", encoding="utf-8") as bf:
                            self._data = json.load(bf)
                        warnings.warn(f"Successfully recovered {self._file} from backup.")
                    except Exception as be:
                        warnings.warn(f"Failed to recover from backup {backup}: {be}")
                        self._data = {}
                else:
                    self._data = {}

    def _save(self):
        if self._file.exists():
            try:
                backup = self._file.with_suffix(".json.bak")
                shutil.copy2(self._file, backup)
            except Exception as e:
                warnings.warn(f"Failed to create backup for {self._file}: {e}")
        try:
            with open(self._file, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            warnings.warn(f"Failed to save JSON to {self._file}: {e}")

    def get(self, key: str) -> Optional[dict]:
        with self._lock:
            return self._data.get(key)

    def all(self) -> dict:
        with self._lock:
            return dict(self._data)

    def values(self) -> list:
        with self._lock:
            return list(self._data.values())

    def set(self, key: str, value: dict):
        with self._lock:
            self._data[key] = value
            self._save()

    def delete(self, key: str):
        with self._lock:
            if key in self._data:
                del self._data[key]
                self._save()

    def find(self, **kwargs) -> list:
        with self._lock:
            return [v for v in self._data.values() if all(v.get(k) == val for k, val in kwargs.items())]

    def find_one(self, **kwargs) -> Optional[dict]:
        with self._lock:
            for v in self._data.values():
                if all(v.get(k) == val for k, val in kwargs.items()):
                    return v
            return None


class ListStore:
    """List-based JSON store with file locking and backups."""

    def __init__(self, filepath: Path):
        self._file = filepath
        self._data: list = []
        self._lock = threading.Lock()
        self._load()

    def _load(self):
        if self._file.exists():
            try:
                with open(self._file, "r", encoding="utf-8") as f:
                    self._data = json.load(f)
            except Exception as e:
                warnings.warn(f"Failed to load JSON from {self._file}: {e}. Attempting recovery from backup...")
                backup = self._file.with_suffix(".json.bak")
                if backup.exists():
                    try:
                        with open(backup, "r", encoding="utf-8") as bf:
                            self._data = json.load(bf)
                        warnings.warn(f"Successfully recovered {self._file} from backup.")
                    except Exception as be:
                        warnings.warn(f"Failed to recover from backup {backup}: {be}")
                        self._data = []
                else:
                    self._data = []

    def _save(self):
        if self._file.exists():
            try:
                backup = self._file.with_suffix(".json.bak")
                shutil.copy2(self._file, backup)
            except Exception as e:
                warnings.warn(f"Failed to create backup for {self._file}: {e}")
        try:
            with open(self._file, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            warnings.warn(f"Failed to save JSON to {self._file}: {e}")

    def all(self) -> list:
        with self._lock:
            return list(self._data)

    def add(self, item: dict):
        with self._lock:
            self._data.append(item)
            self._save()

    def update_by_id(self, item_id: str, updates: dict, id_field: str = "id"):
        with self._lock:
            for item in self._data:
                if item.get(id_field) == item_id:
                    item.update(updates)
                    break
            self._save()

    def delete_by_id(self, item_id: str, id_field: str = "id"):
        with self._lock:
            self._data = [i for i in self._data if i.get(id_field) != item_id]
            self._save()

    def find(self, **kwargs) -> list:
        with self._lock:
            return [i for i in self._data if all(i.get(k) == v for k, v in kwargs.items())]

    def find_one(self, **kwargs) -> Optional[dict]:
        with self._lock:
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
feedback_store = JsonStore(FEEDBACKS_FILE)
question_store = JsonStore(QUESTIONS_FILE)



