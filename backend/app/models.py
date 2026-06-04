from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Submission(BaseModel):
    student_id: str
    filename: str
    extracted_text: str
    score: Optional[int] = None
    draft_feedback: Optional[str] = None
    plagiarism_risk_score: float = 0.0
    plagiarism_flagged: bool = False
    uploaded_at: str = ""
    graded_at: Optional[str] = None


class UploadResponse(BaseModel):
    student_id: str
    filename: str
    plagiarism_risk_score: float
    plagiarism_flagged: bool
    message: str


class GradeResponse(BaseModel):
    student_id: str
    score: int
    draft_feedback: str
    graded_at: str


class GradeAllResult(BaseModel):
    student_id: str
    score: Optional[int] = None
    success: bool
    error: Optional[str] = None


class GradeAllResponse(BaseModel):
    graded_count: int
    failed_count: int
    results: list[GradeAllResult]


class SubmissionOut(BaseModel):
    student_id: str
    filename: str
    uploaded_at: str
    score: Optional[int] = None
    draft_feedback: Optional[str] = None
    plagiarism_risk_score: float
    plagiarism_flagged: bool
    graded_at: Optional[str] = None


class SubmissionListResponse(BaseModel):
    submissions: list[SubmissionOut]
    total: int
    ungraded_count: int
