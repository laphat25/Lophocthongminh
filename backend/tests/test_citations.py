import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.services.citation_verifier import (
    extract_references_section,
    parse_citations,
    check_similarity,
    is_local_document,
    verify_single_citation
)
from app.storage import submission_store, user_store
from app.auth import create_access_token

client = TestClient(app)

def test_extract_references_section():
    # Standard headers
    text = "Intro text\nTài liệu tham khảo\n[1] Paper 1\n[2] Paper 2"
    assert extract_references_section(text) == "[1] Paper 1\n[2] Paper 2"
    
    text_en = "Intro text\nReferences\n[1] Paper 1"
    assert extract_references_section(text_en) == "[1] Paper 1"
    
    # Hash headings
    text_md = "Intro text\n## REFERENCES\n[1] Paper 1"
    assert extract_references_section(text_md) == "[1] Paper 1"
    
    # Missing headers
    text_none = "Intro text without references"
    assert extract_references_section(text_none) == ""

def test_parse_citations():
    ref_block = """
[1] Author A. (2020). First paper.
    Journal of Testing.
[2] Author B. (2021). Second paper.
- Bullet paper 3.
* Bullet paper 4.
    """
    citations = parse_citations(ref_block)
    assert len(citations) == 4
    assert citations[0] == "[1] Author A. (2020). First paper. Journal of Testing."
    assert citations[1] == "[2] Author B. (2021). Second paper."
    assert citations[2] == "- Bullet paper 3."
    assert citations[3] == "* Bullet paper 4."

def test_check_similarity():
    # Matching titles
    assert check_similarity("Taxonomy of educational objectives", "Taxonomy of Educational Objectives") == 1.0
    # Subset matching
    assert check_similarity("An educational psychology success story", "An educational psychology success story: Social interdependence theory") == 1.0
    # Mismatching
    assert check_similarity("An educational psychology success story", "A completely different title") < 0.3

def test_is_local_document():
    assert is_local_document("Bộ Giáo dục và Đào tạo (2018)") is True
    assert is_local_document("SGK Toán lớp 5 Cánh Diều") is True
    assert is_local_document("International Journal of Science") is False

@pytest.mark.asyncio
async def test_verify_single_citation_local():
    res = await verify_single_citation("[1] Bộ Giáo dục và Đào tạo (2018). Thông tư số 32/2018/TT-BGDĐT.")
    assert res["status"] == "local_document"

@pytest.mark.asyncio
async def test_verify_single_citation_crossref_verified():
    # Mock a successful CrossRef response
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "message": {
            "items": [
                {
                    "title": ["Taxonomy of Educational Objectives"],
                    "DOI": "10.1002/test.123",
                    "URL": "https://doi.org/10.1002/test.123"
                }
            ]
        }
    }
    mock_client = MagicMock()
    from unittest.mock import AsyncMock
    mock_client.get = AsyncMock(return_value=mock_resp)
    
    res = await verify_single_citation("[1] Bloom. (1956). Taxonomy of educational objectives.", client=mock_client)
    assert res["status"] == "verified"
    assert res["matched_doi"] == "10.1002/test.123"

@pytest.mark.asyncio
async def test_verify_single_citation_crossref_suspicious():
    # Mock a response that returns a mismatch
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "message": {
            "items": [
                {
                    "title": ["A completely unrelated book title"],
                    "DOI": "10.1002/test.999",
                    "URL": "https://doi.org/10.1002/test.999"
                }
            ]
        }
    }
    mock_client = MagicMock()
    from unittest.mock import AsyncMock
    mock_client.get = AsyncMock(return_value=mock_resp)
    
    res = await verify_single_citation("[1] Bloom. (1956). Taxonomy of educational objectives.", client=mock_client)
    assert res["status"] == "suspicious"


def test_api_verify_citations_route():
    # Setup a mock user and a mock submission
    user_id = "test_teacher_1"
    user_store.set(user_id, {
        "id": user_id,
        "email": "teacher@test.com",
        "full_name": "Test Teacher",
        "role": "teacher",
        "is_active": True
    })
    
    sub_id = "test_sub_1"
    submission_store.set(sub_id, {
        "id": sub_id,
        "assignment_id": "assign_1",
        "student_id": "student_1",
        "student_name": "Student A",
        "content_text": "Bài làm văn\nTài liệu tham khảo\n[1] Thông tư 32 Bộ Giáo dục",
        "status": "submitted",
        "word_count": 10
    })
    
    # Generate login token for the teacher
    token = create_access_token({"sub": user_id, "role": "teacher"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # Trigger API verify citations
    response = client.post(f"/api/submissions/{sub_id}/verify-citations", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["has_citations"] is True
    assert len(data["citations"]) == 1
    assert data["citations"][0]["status"] == "local_document"
    
    # Verify that it is saved in the store
    saved_sub = submission_store.get(sub_id)
    assert "citation_report" in saved_sub
    assert saved_sub["citation_report"]["has_citations"] is True

def test_extract_references_section_truncation():
    # Markdown heading truncation
    text_md = "Intro\nTài liệu tham khảo\n[1] Paper A\n[2] Paper B\n\n## ĐÁNH GIÁ ĐỒNG ĐẲNG\nInfo..."
    assert extract_references_section(text_md) == "[1] Paper A\n[2] Paper B"
    
    # Uppercase heading truncation
    text_upper = "Intro\nReferences\n[1] Paper A\n[2] Paper B\n\nĐÁNH GIÁ ĐỒNG ĐẲNG GIỮA CÁC THÀNH VIÊN\nInfo..."
    assert extract_references_section(text_upper) == "[1] Paper A\n[2] Paper B"

    # Uppercase heading with colon and number truncation
    text_colon = "Intro\nTài liệu tham khảo\n[1] Paper A\n[2] Paper B\n\nPHỤ LỤC: ĐÁNH GIÁ ĐỒNG ĐẲNG GIỮA CÁC THÀNH VIÊN\nInfo..."
    assert extract_references_section(text_colon) == "[1] Paper A\n[2] Paper B"

    # References header with page number prefix
    text_page_prefix = "Table of Contents\nTài liệu tham khảo\nSome intro text...\n\n29 TÀI LIỆU THAM KHẢO\n[1] Paper A\n[2] Paper B\n\nPHỤ LỤC: ĐÁNH GIÁ ĐỒNG ĐẲNG\n..."
    assert extract_references_section(text_page_prefix) == "[1] Paper A\n[2] Paper B"

def test_parse_citations_newline_merge():
    # Newline characters in citation should be replaced with spaces
    ref_block = "[1] Author A.\n(2020).\nTitle A.\n[2] Author B. (2021). Title B."
    citations = parse_citations(ref_block)
    assert len(citations) == 2
    assert citations[0] == "[1] Author A. (2020). Title A."
    assert citations[1] == "[2] Author B. (2021). Title B."

def test_extract_title_apa7():
    from app.services.citation_verifier import extract_title
    
    # 1. Standard APA 7 Article
    cit_std = "Author, A. A., & Author, B. B. (2020). Title of the journal article. Journal of Testing, 10(2), 100-110."
    assert extract_title(cit_std) == "Title of the journal article"
    
    # 2. APA 7 with full date (online source)
    cit_date = "Simon Kemp. (2021, January 27). Digital 2021: Global Overview Report. Datareportal."
    assert extract_title(cit_date) == "Digital 2021: Global Overview Report"
    
    # 3. APA 7 Book
    cit_book = "Author, C. C. (2018). Title of the book. Publisher."
    assert extract_title(cit_book) == "Title of the book"
    
    # 4. Short title (2 words)
    cit_short = "Doe, J. (2022). Quantum Mechanics. Science Press."
    assert extract_title(cit_short) == "Quantum Mechanics"
    
    # 5. No date
    cit_nd = "Smith, J. (n.d.). Internet usage trends. Web Journal."
    assert extract_title(cit_nd) == "Internet usage trends"
