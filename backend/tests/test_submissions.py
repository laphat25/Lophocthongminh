import pytest
import io

def test_submit_text_success(client, teacher_headers, student_headers):
    # 1. Setup class and publish assignment
    c_res = client.post("/api/classes", json={"class_name": "Web Dev", "subject": "CS"}, headers=teacher_headers)
    class_id = c_res.json()["id"]
    class_code = c_res.json()["class_code"]

    client.post("/api/classes/join", json={"class_code": class_code}, headers=student_headers)

    a_res = client.post(
        "/api/assignments",
        json={"class_id": class_id, "title": "HW1", "submission_type": "text", "rubric": []},
        headers=teacher_headers
    )
    assignment_id = a_res.json()["id"]
    client.patch(f"/api/assignments/{assignment_id}/publish", headers=teacher_headers)

    # 2. Student submits text
    payload = {
        "assignment_id": assignment_id,
        "content_text": "This is a basic coding assignment submission text."
    }
    response = client.post(f"/api/assignments/{assignment_id}/submit/text", json=payload, headers=student_headers)
    assert response.status_code == 200
    assert response.json()["content_text"] == payload["content_text"]
    assert response.json()["version"] == 1

def test_submit_text_duplicate_not_allowed(client, teacher_headers, student_headers):
    c_res = client.post("/api/classes", json={"class_name": "Web Dev", "subject": "CS"}, headers=teacher_headers)
    class_id = c_res.json()["id"]
    class_code = c_res.json()["class_code"]
    client.post("/api/classes/join", json={"class_code": class_code}, headers=student_headers)

    a_res = client.post(
        "/api/assignments",
        json={"class_id": class_id, "title": "HW1", "submission_type": "text", "allow_resubmit": False, "rubric": []},
        headers=teacher_headers
    )
    assignment_id = a_res.json()["id"]
    client.patch(f"/api/assignments/{assignment_id}/publish", headers=teacher_headers)

    payload = {"assignment_id": assignment_id, "content_text": "First draft"}
    client.post(f"/api/assignments/{assignment_id}/submit/text", json=payload, headers=student_headers)

    # Second submission (should fail because allow_resubmit is False)
    payload2 = {"assignment_id": assignment_id, "content_text": "Second draft"}
    response = client.post(f"/api/assignments/{assignment_id}/submit/text", json=payload2, headers=student_headers)
    assert response.status_code == 400
    assert "không cho phép nộp lại" in response.json()["detail"]

def test_submit_text_resubmit_allowed(client, teacher_headers, student_headers):
    c_res = client.post("/api/classes", json={"class_name": "Web Dev", "subject": "CS"}, headers=teacher_headers)
    class_id = c_res.json()["id"]
    class_code = c_res.json()["class_code"]
    client.post("/api/classes/join", json={"class_code": class_code}, headers=student_headers)

    a_res = client.post(
        "/api/assignments",
        json={"class_id": class_id, "title": "HW1", "submission_type": "text", "allow_resubmit": True, "rubric": []},
        headers=teacher_headers
    )
    assignment_id = a_res.json()["id"]
    client.patch(f"/api/assignments/{assignment_id}/publish", headers=teacher_headers)

    payload = {"assignment_id": assignment_id, "content_text": "First draft"}
    client.post(f"/api/assignments/{assignment_id}/submit/text", json=payload, headers=student_headers)

    payload2 = {"assignment_id": assignment_id, "content_text": "Second draft"}
    response = client.post(f"/api/assignments/{assignment_id}/submit/text", json=payload2, headers=student_headers)
    assert response.status_code == 200
    assert response.json()["version"] == 2

def test_submit_file_validation(client, teacher_headers, student_headers):
    c_res = client.post("/api/classes", json={"class_name": "Web Dev", "subject": "CS"}, headers=teacher_headers)
    class_id = c_res.json()["id"]
    class_code = c_res.json()["class_code"]
    client.post("/api/classes/join", json={"class_code": class_code}, headers=student_headers)

    a_res = client.post(
        "/api/assignments",
        json={"class_id": class_id, "title": "HW1", "submission_type": "file", "rubric": []},
        headers=teacher_headers
    )
    assignment_id = a_res.json()["id"]
    client.patch(f"/api/assignments/{assignment_id}/publish", headers=teacher_headers)

    # 1. Invalid extension
    file_invalid_ext = ("test.exe", io.BytesIO(b"dummy content"))
    res = client.post(
        f"/api/assignments/{assignment_id}/submit/file",
        files={"file": file_invalid_ext},
        headers=student_headers
    )
    assert res.status_code == 400
    assert "PDF, DOCX hoặc TXT" in res.json()["detail"]

    # 2. Invalid PDF (missing %PDF header)
    file_invalid_pdf = ("test.pdf", io.BytesIO(b"dummy pdf content without header"))
    res2 = client.post(
        f"/api/assignments/{assignment_id}/submit/file",
        files={"file": file_invalid_pdf},
        headers=student_headers
    )
    assert res2.status_code == 400
    assert "PDF không hợp lệ" in res2.json()["detail"]

    # 3. Invalid DOCX (missing ZIP PK\x03\x04 header)
    file_invalid_docx = ("test.docx", io.BytesIO(b"dummy docx content"))
    res3 = client.post(
        f"/api/assignments/{assignment_id}/submit/file",
        files={"file": file_invalid_docx},
        headers=student_headers
    )
    assert res3.status_code == 400
    assert "DOCX không hợp lệ" in res3.json()["detail"]
