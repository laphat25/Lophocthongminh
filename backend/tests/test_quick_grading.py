import json
import pytest
from unittest.mock import patch
from app.routers.quick_grading import parse_student_info

def test_parse_student_info():
    # MSSV_Name format
    sid, name = parse_student_info("20206012_NguyenVanA_BT1.pdf")
    assert sid == "20206012"
    assert name == "Nguyen Van A"

    # Name-only format (PascalCase)
    sid, name = parse_student_info("TranThiB_BaoCao.docx")
    assert sid == "tranthib"
    assert name == "Tran Thi B"

    # Dash delimiter and space
    sid, name = parse_student_info("20211234 - Le Van C.txt")
    assert sid == "20211234"
    assert name == "Le Van C"


def test_quick_grade_endpoint_success(client, teacher_headers):
    # Prepare files and rubric payload
    files = [
        ("files", ("20206012_NguyenVanA_BT1.pdf", b"%PDF-1.4 mock pdf content", "application/pdf")),
        ("files", ("20210001_LeThiB_BTL.docx", b"PK\x03\x04mock docx content", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
    ]
    
    rubric_payload = [
        {
            "criteria_name": "Nội dung",
            "max_score": 10.0,
            "weight": 60.0,
            "levels": [{"score": 10.0, "description": "Tốt"}]
        },
        {
            "criteria_name": "Hình thức",
            "max_score": 10.0,
            "weight": 40.0,
            "levels": [{"score": 10.0, "description": "Tốt"}]
        }
    ]

    form_data = {
        "title": "Chấm bài kiểm tra 15p",
        "rubric": json.dumps(rubric_payload)
    }

    # Mock extract_text_from_file and grading services to prevent actual calls
    with patch("app.routers.quick_grading.extract_text_from_file", return_value="Nội dung bài làm mẫu của học sinh."), \
         patch("app.services.grading.grade_by_rubric_gemini", return_value=([], [])):
        
        response = client.post(
            "/api/assignments/quick-grade",
            data=form_data,
            files=files,
            headers=teacher_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        assert "assignment_id" in data
        assert "class_id" in data
        assert "Đang tiến hành" in data["message"]
