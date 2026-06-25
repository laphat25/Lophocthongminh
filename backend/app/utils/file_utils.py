import os
import re
import mimetypes
try:
    import magic
except ImportError:
    magic = None
from fastapi import HTTPException

def sanitize_filename(filename: str) -> str:
    # Only keep basename and remove any path characters
    base = os.path.basename(filename)
    base = re.sub(r"[/\\]", "", base)
    return base

def validate_uploaded_file(contents: bytes, filename: str):
    # Check file size (10MB limit)
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File {filename} quá lớn (tối đa 10MB)")

    ext = os.path.splitext(filename.lower())[1]
    if ext not in {".pdf", ".docx", ".txt"}:
        raise HTTPException(status_code=400, detail=f"Chỉ chấp nhận file PDF, DOCX hoặc TXT: {filename}")

    # Use python-magic if possible, fallback to guessed mimetype
    mime = None
    if magic is not None:
        try:
            mime = magic.from_buffer(contents, mime=True)
        except Exception:
            pass
    if not mime:
        mime, _ = mimetypes.guess_type(filename)

    allowed_mimes = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    }
    
    # Docx and PDF can sometimes be guessed differently depending on system env
    if mime not in allowed_mimes and mime not in {"application/zip", "application/octet-stream"}:
        raise HTTPException(status_code=400, detail=f"Loại file không được hỗ trợ: {mime}")

    # Double check header magic bytes
    if ext == ".pdf" and not contents.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail=f"File PDF không hợp lệ: {filename}")
    if ext == ".docx" and not contents.startswith(b"PK\x03\x04"):
        raise HTTPException(status_code=400, detail=f"File DOCX không hợp lệ: {filename}")
