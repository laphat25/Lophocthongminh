import pytest

def test_create_assignment_success(client, teacher_headers):
    # 1. Create a class
    c_res = client.post("/api/classes", json={"class_name": "Test Class", "subject": "CS"}, headers=teacher_headers)
    class_id = c_res.json()["id"]

    # 2. Create assignment
    payload = {
        "class_id": class_id,
        "title": "Assignment 1",
        "description": "Create a sorting app",
        "submission_type": "text",
        "allow_resubmit": True,
        "pass_threshold": 50,
        "rubric": [
            {
                "criteria_name": "Code Quality",
                "max_score": 10,
                "weight": 50.0,
                "keywords": ["clean", "readable"],
                "levels": [{"score": 10, "description": "Excellent"}]
            },
            {
                "criteria_name": "Correctness",
                "max_score": 10,
                "weight": 50.0,
                "keywords": ["correct"],
                "levels": [{"score": 10, "description": "Works perfectly"}]
            }
        ]
    }
    response = client.post("/api/assignments", json=payload, headers=teacher_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Assignment 1"
    assert len(data["rubric"]) == 2

def test_create_assignment_invalid_weight(client, teacher_headers):
    c_res = client.post("/api/classes", json={"class_name": "Test Class", "subject": "CS"}, headers=teacher_headers)
    class_id = c_res.json()["id"]

    payload = {
        "class_id": class_id,
        "title": "Assignment 1",
        "rubric": [
            {
                "criteria_name": "Code Quality",
                "max_score": 10,
                "weight": 40.0, # 40 + 50 = 90 (invalid)
                "levels": []
            },
            {
                "criteria_name": "Correctness",
                "max_score": 10,
                "weight": 50.0,
                "levels": []
            }
        ]
    }
    response = client.post("/api/assignments", json=payload, headers=teacher_headers)
    assert response.status_code == 400
    assert "Tổng trọng số phải bằng 100%" in response.json()["detail"]

def test_publish_and_close_assignment(client, teacher_headers):
    # 1. Create class & assignment
    c_res = client.post("/api/classes", json={"class_name": "Test Class", "subject": "CS"}, headers=teacher_headers)
    class_id = c_res.json()["id"]

    a_res = client.post(
        "/api/assignments",
        json={"class_id": class_id, "title": "Draft Assignment", "rubric": []},
        headers=teacher_headers
    )
    assignment_id = a_res.json()["id"]
    assert a_res.json()["status"] == "draft"

    # 2. Publish
    pub_res = client.patch(f"/api/assignments/{assignment_id}/publish", headers=teacher_headers)
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "published"

    # 3. Close
    close_res = client.patch(f"/api/assignments/{assignment_id}/close", headers=teacher_headers)
    assert close_res.status_code == 200
    assert close_res.json()["status"] == "closed"
