import pytest

def test_create_class_success(client, teacher_headers):
    payload = {
        "class_name": "Web Development",
        "subject": "Computer Science",
        "description": "Learn modern web tech stack"
    }
    response = client.post("/api/classes", json=payload, headers=teacher_headers)
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "class_code" in data
    assert data["class_name"] == "Web Development"

def test_create_class_unauthorized(client, student_headers):
    payload = {
        "class_name": "Web Development",
        "subject": "Computer Science",
    }
    # Student trying to create class (forbidden)
    response = client.post("/api/classes", json=payload, headers=student_headers)
    assert response.status_code == 403

def test_list_classes(client, teacher_headers, student_headers, teacher_user):
    # 1. Create a class
    payload = {
        "class_name": "Maths 101",
        "subject": "Mathematics"
    }
    client.post("/api/classes", json=payload, headers=teacher_headers)
    
    # 2. Get list as teacher
    response = client.get("/api/classes", headers=teacher_headers)
    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["classes"][0]["class_name"] == "Maths 101"

def test_join_class_success(client, teacher_headers, student_headers, student_user):
    # 1. Create a class as teacher
    payload = {
        "class_name": "Maths 101",
        "subject": "Mathematics"
    }
    c_res = client.post("/api/classes", json=payload, headers=teacher_headers)
    class_code = c_res.json()["class_code"]
    class_id = c_res.json()["id"]

    # 2. Join class as student
    join_payload = {"class_code": class_code}
    response = client.post("/api/classes/join", json=join_payload, headers=student_headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Tham gia lớp thành công"

    # 3. List class students as teacher
    students_res = client.get(f"/api/classes/{class_id}/students", headers=teacher_headers)
    assert students_res.status_code == 200
    assert students_res.json()["total"] == 1
    assert students_res.json()["students"][0]["student_id"] == student_user["id"]

def test_remove_student(client, teacher_headers, student_headers, student_user):
    # 1. Create class & student joins
    payload = {
        "class_name": "History 101",
        "subject": "History"
    }
    c_res = client.post("/api/classes", json=payload, headers=teacher_headers)
    class_code = c_res.json()["class_code"]
    class_id = c_res.json()["id"]

    client.post("/api/classes/join", json={"class_code": class_code}, headers=student_headers)

    # 2. Remove student
    remove_res = client.delete(f"/api/classes/{class_id}/students/{student_user['id']}", headers=teacher_headers)
    assert remove_res.status_code == 200

    # 3. Verify students list is empty now
    students_res = client.get(f"/api/classes/{class_id}/students", headers=teacher_headers)
    assert students_res.json()["total"] == 0

def test_delete_class(client, teacher_headers):
    # 1. Create class
    c_res = client.post("/api/classes", json={"class_name": "Temp Class", "subject": "N/A"}, headers=teacher_headers)
    class_id = c_res.json()["id"]

    # 2. Delete class
    del_res = client.delete(f"/api/classes/{class_id}", headers=teacher_headers)
    assert del_res.status_code == 200

    # 3. Verify get class returns 404
    get_res = client.get(f"/api/classes/{class_id}", headers=teacher_headers)
    assert get_res.status_code == 404
