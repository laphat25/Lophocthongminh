import pytest
from unittest.mock import patch

@pytest.fixture
def submission_setup(client, teacher_headers, student_headers):
    # Create class
    c_res = client.post("/api/classes", json={"class_name": "Maths", "subject": "Math"}, headers=teacher_headers)
    class_id = c_res.json()["id"]
    class_code = c_res.json()["class_code"]
    client.post("/api/classes/join", json={"class_code": class_code}, headers=student_headers)

    # Create assignment with 1 rubric criteria
    a_res = client.post(
        "/api/assignments",
        json={
            "class_id": class_id,
            "title": "Algebra HW",
            "submission_type": "text",
            "rubric": [
                {
                    "criteria_name": "Equations",
                    "max_score": 10,
                    "weight": 100.0,
                    "keywords": ["x", "y"],
                    "levels": [{"score": 10, "description": "Perfect"}]
                }
            ]
        },
        headers=teacher_headers
    )
    assignment_id = a_res.json()["id"]
    criteria_id = a_res.json()["rubric"][0]["criteria_id"]
    client.patch(f"/api/assignments/{assignment_id}/publish", headers=teacher_headers)

    # Submit text
    sub_res = client.post(
        f"/api/assignments/{assignment_id}/submit/text",
        json={"assignment_id": assignment_id, "content_text": "x + y = 10"},
        headers=student_headers
    )
    submission_id = sub_res.json()["id"]

    return {
        "assignment_id": assignment_id,
        "submission_id": submission_id,
        "criteria_id": criteria_id
    }

def test_auto_grading_mocked(client, teacher_headers, submission_setup):
    sub_id = submission_setup["submission_id"]
    criteria_id = submission_setup["criteria_id"]

    mock_scores = [{
        "criteria_id": criteria_id,
        "criteria_name": "Equations",
        "ai_suggested_score": 9.0,
        "ai_suggested_level": "Perfect",
        "final_score": 9.0,
        "max_score": 10,
        "weight": 100.0,
        "teacher_comment": "",
        "highlighted_text": []
    }]
    mock_feedbacks = [{
        "anchor": {
            "exact_quote": "x + y",
            "prefix_context": "",
            "suffix_context": "= 10",
            "paragraph_index": 0,
            "sentence_index": 0
        },
        "severity": "praise",
        "category": "logic",
        "criteria_id": criteria_id,
        "comment": "Good equation",
        "evidence": "Formula match",
        "suggested_fix": None
    }]

    with patch("app.routers.grading_v2.grade_by_rubric_gemini", return_value=(mock_scores, mock_feedbacks)):
        res = client.post(f"/api/submissions/{sub_id}/grade/auto", headers=teacher_headers)
        assert res.status_code == 200
        assert res.json()["total_score"] == 90.0  # 9.0 out of 10 is 90% (weight 100)

def test_save_grade_override(client, teacher_headers, submission_setup):
    sub_id = submission_setup["submission_id"]
    criteria_id = submission_setup["criteria_id"]

    # Initial auto grade setup in storage directly for test simplicity
    from app import storage
    storage.grading_store.set(sub_id, {
        "id": sub_id,
        "submission_id": sub_id,
        "assignment_id": submission_setup["assignment_id"],
        "student_id": "test_student_id",
        "graded_by": "test_teacher_id",
        "criteria_scores": [{
            "criteria_id": criteria_id,
            "criteria_name": "Equations",
            "ai_suggested_score": 8.0,
            "ai_suggested_level": "Good",
            "final_score": 8.0,
            "max_score": 10,
            "weight": 100.0,
            "teacher_comment": "",
            "highlighted_text": []
        }],
        "total_score": 80.0,
        "status": "graded"
    })

    # Override grade
    payload = {
        "criteria_scores": [{
            "criteria_id": criteria_id,
            "final_score": 10.0,
            "teacher_comment": "Excellent override"
        }],
        "overall_comment": "Superb work"
    }
    res = client.put(f"/api/submissions/{sub_id}/grade", json=payload, headers=teacher_headers)
    assert res.status_code == 200
    assert res.json()["total_score"] == 100.0
    assert res.json()["criteria_scores"][0]["teacher_comment"] == "Excellent override"

def test_publish_grade(client, teacher_headers, student_headers, submission_setup):
    sub_id = submission_setup["submission_id"]
    criteria_id = submission_setup["criteria_id"]

    from app import storage
    storage.grading_store.set(sub_id, {
        "id": sub_id,
        "submission_id": sub_id,
        "assignment_id": submission_setup["assignment_id"],
        "student_id": "test_student_id",
        "graded_by": "test_teacher_id",
        "criteria_scores": [{
            "criteria_id": criteria_id,
            "criteria_name": "Equations",
            "ai_suggested_score": 8.0,
            "ai_suggested_level": "Good",
            "final_score": 8.0,
            "max_score": 10,
            "weight": 100.0,
            "teacher_comment": "",
            "highlighted_text": []
        }],
        "total_score": 80.0,
        "status": "graded"
    })

    # Student views (should fail, not published yet)
    res_student_init = client.get(f"/api/submissions/{sub_id}/grade", headers=student_headers)
    assert res_student_init.status_code == 404

    # Publish
    res_pub = client.post(f"/api/submissions/{sub_id}/grade/publish", headers=teacher_headers)
    assert res_pub.status_code == 200

    # Student views (should succeed now)
    res_student = client.get(f"/api/submissions/{sub_id}/grade", headers=student_headers)
    assert res_student.status_code == 200
    assert res_student.json()["grading"]["status"] == "published"
