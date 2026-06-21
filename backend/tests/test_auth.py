import pytest

def test_register_success(client):
    payload = {
        "email": "new_user@test.com",
        "password": "securepassword",
        "full_name": "New Student",
        "role": "student",
        "student_id": "SV002"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "new_user@test.com"
    assert data["user"]["full_name"] == "New Student"
    assert data["user"]["role"] == "student"

def test_register_invalid_role(client):
    payload = {
        "email": "new_user@test.com",
        "password": "securepassword",
        "full_name": "New Student",
        "role": "admin",
        "student_id": "SV002"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 400
    assert "Role" in response.json()["detail"]

def test_register_duplicate_email(client, student_user):
    payload = {
        "email": student_user["email"],
        "password": "securepassword",
        "full_name": "Duplicate Student",
        "role": "student",
        "student_id": "SV999"
    }
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 400
    assert "Email đã được đăng ký" in response.json()["detail"]

def test_login_success(client, student_user):
    payload = {
        "email": student_user["email"],
        "password": "pass1234"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == student_user["email"]

def test_login_invalid_password(client, student_user):
    payload = {
        "email": student_user["email"],
        "password": "wrongpassword"
    }
    response = client.post("/api/auth/login", json=payload)
    assert response.status_code == 401
    assert "Email hoặc mật khẩu không đúng" in response.json()["detail"]

def test_get_me(client, student_headers, student_user):
    response = client.get("/api/auth/me", headers=student_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == student_user["id"]
    assert "password_hash" not in data

def test_update_settings(client, teacher_headers):
    payload = {
        "gemini_api_key": "AIzaSyTestApiKey12345"
    }
    response = client.put("/api/auth/settings", json=payload, headers=teacher_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["has_gemini_key"] is True

def test_reset_student_password_success(client, teacher_headers, student_user):
    payload = {
        "new_password": "newsecurepass"
    }
    response = client.post(
        f"/api/auth/users/{student_user['id']}/reset-password",
        json=payload,
        headers=teacher_headers
    )
    assert response.status_code == 200
    assert "Đặt lại mật khẩu thành công" in response.json()["message"]

def test_reset_student_password_unauthorized(client, student_headers, student_user):
    payload = {
        "new_password": "newsecurepass"
    }
    # Student trying to reset password (should be forbidden)
    response = client.post(
        f"/api/auth/users/{student_user['id']}/reset-password",
        json=payload,
        headers=student_headers
    )
    assert response.status_code == 403
