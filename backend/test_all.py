"""
Full end-to-end API test for AI Assignment Marking System
Run: python test_all.py
"""
import requests
import json
import sys
import time

BASE = "http://localhost:8000/api"
OK = "✅"
FAIL = "❌"
SKIP = "⏭️"

results = []

def log(status, name, detail=""):
    icon = OK if status else FAIL
    msg = f"{icon} {name}"
    if detail:
        msg += f"  → {detail}"
    print(msg)
    results.append((status, name, detail))

def req(method, path, token=None, **kwargs):
    headers = kwargs.pop("headers", {})
    if token:
        headers["Authorization"] = f"Bearer {token}"
    headers["x-disable-rate-limit"] = "true"
    r = getattr(requests, method)(f"{BASE}{path}", headers=headers, **kwargs)
    return r

# ─── 1. HEALTH CHECK ──────────────────────────────────────────────────────────
print("\n═══ 1. HEALTH CHECK ═══")
r = req("get", "/health")
log(r.status_code == 200, "Health check", r.json().get("status","?"))

# ─── 2. REGISTER ACCOUNTS ─────────────────────────────────────────────────────
print("\n═══ 2. REGISTER ACCOUNTS ═══")

teacher_data = {"email":"teacher@test.com","password":"pass1234","full_name":"Phạm Tiến Đạt","role":"teacher"}
r = req("post", "/auth/register", json=teacher_data)
if r.status_code in (200, 201):
    teacher_token = r.json()["access_token"]
    log(True, "Register teacher", f"token: {teacher_token[:20]}...")
elif r.status_code == 400 and ("already" in r.text.lower() or "đăng ký" in r.text.lower()):
    # Already exists, login instead
    r2 = req("post", "/auth/login", json={"email":"teacher@test.com","password":"pass1234"})
    teacher_token = r2.json()["access_token"]
    log(True, "Login teacher (already exists)", f"token: {teacher_token[:20]}...")
else:
    log(False, "Register teacher", r.text[:100])
    teacher_token = None

if teacher_token:
    # Cấu hình Gemini API Key cho giáo viên dùng trong kiểm thử E2E (lấy từ .env cục bộ)
    import os
    from dotenv import load_dotenv
    load_dotenv()
    test_api_key = os.getenv("GEMINI_API_KEY", "")
    if test_api_key:
        # Giải mã API key từ .env để gửi bản rõ (raw key) lên endpoint /settings
        try:
            from app.config import decrypt_api_key
            raw_key = decrypt_api_key(test_api_key)
            if raw_key:
                test_api_key = raw_key
        except Exception as e:
            print(f"Bypass decryption in test_all.py: {e}")
        
        r_settings = req("put", "/auth/settings", token=teacher_token, json={"gemini_api_key": test_api_key})
        log(r_settings.ok, "Set teacher Gemini API key settings for E2E tests", f"starts with: {test_api_key[:10]}..." if r_settings.ok else r_settings.text[:80])
    else:
        log(False, "Set teacher Gemini API key settings", "No GEMINI_API_KEY found in .env")

student1_data = {"email":"student1@test.com","password":"pass1234","full_name":"Tran Thi A","role":"student","student_id":"SV001"}
r = req("post", "/auth/register", json=student1_data)
if r.status_code in (200, 201):
    s1_token = r.json()["access_token"]
    log(True, "Register student1", "SV001")
elif r.status_code == 400 and ("already" in r.text.lower() or "đăng ký" in r.text.lower()):
    r2 = req("post", "/auth/login", json={"email":"student1@test.com","password":"pass1234"})
    s1_token = r2.json()["access_token"]
    log(True, "Login student1 (already exists)", "SV001")
else:
    log(False, "Register student1", r.text[:100])
    s1_token = None

student2_data = {"email":"student2@test.com","password":"pass1234","full_name":"Le Van B","role":"student","student_id":"SV002"}
r = req("post", "/auth/register", json=student2_data)
if r.status_code in (200, 201):
    s2_token = r.json()["access_token"]
    log(True, "Register student2", "SV002")
elif r.status_code == 400 and ("already" in r.text.lower() or "đăng ký" in r.text.lower()):
    r2 = req("post", "/auth/login", json={"email":"student2@test.com","password":"pass1234"})
    s2_token = r2.json()["access_token"]
    log(True, "Login student2 (already exists)", "SV002")
else:
    log(False, "Register student2", r.text[:100])
    s2_token = None

# ─── 3. CREATE CLASS ──────────────────────────────────────────────────────────
print("\n═══ 3. CLASS MANAGEMENT ═══")

r = req("post", "/classes", token=teacher_token, json={
    "class_name": "Ky thuat lap trinh",
    "subject": "Lap trinh",
    "description": "Lop hoc co ban"
})
if r.ok:
    cls = r.json()
    class_id = cls["id"]
    class_code = cls["class_code"]
    log(True, "Create class", f"code={class_code}, id={class_id[:8]}...")
else:
    log(False, "Create class", r.text[:100])
    # Try to get existing
    r2 = req("get", "/classes", token=teacher_token)
    classes = r2.json().get("classes", [])
    if classes:
        cls = classes[0]
        class_id = cls["id"]
        class_code = cls["class_code"]
        log(True, "Use existing class", f"code={class_code}")
    else:
        sys.exit("No class available, exiting")

# Students join class
for token, name in [(s1_token, "student1"), (s2_token, "student2")]:
    r = req("post", "/classes/join", token=token, json={"class_code": class_code})
    if r.ok:
        log(True, f"{name} joined class", class_code)
    elif "already" in r.text.lower() or "da tham" in r.text.lower():
        log(True, f"{name} already in class", class_code)
    else:
        log(False, f"{name} join class", r.text[:80])

# List students
r = req("get", f"/classes/{class_id}/students", token=teacher_token)
if r.ok:
    total = r.json().get("total", 0)
    log(True, "List class students", f"{total} students enrolled")
else:
    log(False, "List class students", r.text[:80])

# ─── 4. CREATE ASSIGNMENT ─────────────────────────────────────────────────────
print("\n═══ 4. ASSIGNMENT ═══")

rubric = [
    {
        "criteria_name": "Noi dung va kien thuc",
        "max_score": 10,
        "weight": 50,
        "keywords": ["thuat toan", "phan tich", "do phuc tap", "bubble sort"],
        "levels": [
            {"score": 9, "description": "Trinh bay day du, chinh xac, co vi du"},
            {"score": 6, "description": "Trinh bay du y, con thieu mot so chi tiet"},
            {"score": 3, "description": "Trinh bay so sai, thieu nhieu noi dung"}
        ]
    },
    {
        "criteria_name": "Cau truc va trinh bay",
        "max_score": 10,
        "weight": 50,
        "keywords": ["cau truc", "ro rang", "mach lac", "trinh bay"],
        "levels": [
            {"score": 8, "description": "Cau truc ro rang, trinh bay mach lac"},
            {"score": 4, "description": "Cau truc con roi, kho theo doi"}
        ]
    }
]

r = req("post", "/assignments", token=teacher_token, json={
    "class_id": class_id,
    "title": "Bai tap 1: Phan tich thuat toan",
    "description": "Phan tich do phuc tap thuat toan Bubble Sort",
    "submission_type": "text",
    "allow_resubmit": False,
    "deadline": "2026-12-31T23:59:00Z",
    "pass_threshold": 50,
    "rubric": rubric
})
if r.ok:
    asgn = r.json()
    assignment_id = asgn["id"]
    log(True, "Create assignment (draft)", f"id={assignment_id[:8]}..., {len(asgn.get('rubric',[]))} criteria")
else:
    log(False, "Create assignment", r.text[:100])
    # Try existing
    r2 = req("get", f"/assignments?class_id={class_id}", token=teacher_token)
    asgns = r2.json().get("assignments", [])
    if asgns:
        assignment_id = asgns[0]["id"]
        log(True, "Use existing assignment", assignment_id[:8])
    else:
        sys.exit("No assignment, exiting")

# Get assignment
r = req("get", f"/assignments/{assignment_id}", token=teacher_token)
log(r.ok, "Get assignment detail", f"status={r.json().get('status','?')}" if r.ok else r.text[:80])

# Publish assignment
r = req("patch", f"/assignments/{assignment_id}/publish", token=teacher_token)
log(r.ok, "Publish assignment", r.json().get("status","?") if r.ok else r.text[:80])

# ─── 5. SUBMISSIONS ──────────────────────────────────────────────────────────
print("\n═══ 5. SUBMISSIONS ═══")

text1 = ("Thuat toan sap xep noi bot (Bubble Sort) la mot thuat toan sap xep don gian. "
         "Nguyen ly hoat dong: So sanh tung cap phan tu lien ke va doi cho neu chung khong dung thu tu. "
         "Qua trinh lap lai cho den khi khong con phan tu nao can doi cho. "
         "Do phuc tap thoi gian: O(n2) trong truong hop xau nhat va trung binh, O(n) trong truong hop tot nhat. "
         "Do phuc tap khong gian: O(1) vi chi can them mot bien tam de doi cho.")

r = req("post", f"/assignments/{assignment_id}/submit/text", token=s1_token,
        json={"assignment_id": assignment_id, "content_text": text1})
if r.ok:
    sub1 = r.json()
    sub1_id = sub1["id"]
    log(True, "Student1 submit text", f"id={sub1_id[:8]}..., {sub1.get('word_count',0)} words")
elif "da nop" in r.text.lower() or "already" in r.text.lower():
    # Get existing submission
    r2 = req("get", "/submissions/my", token=s1_token)
    subs = [s for s in r2.json().get("submissions",[]) if s["assignment_id"]==assignment_id]
    if subs:
        sub1_id = subs[0]["id"]
        log(True, "Student1 already submitted", sub1_id[:8])
    else:
        log(False, "Student1 submit", r.text[:80])
        sub1_id = None
else:
    log(False, "Student1 submit", r.text[:80])
    sub1_id = None

text2 = ("Bubble Sort la thuat toan sap xep don gian dua tren so sanh. "
         "Thuat toan hoat dong bang cach lap di lap lai qua danh sach, so sanh cac phan tu lien ke "
         "va hoan doi chung neu chung khong dung thu tu. "
         "Do phuc tap: O(n2) thoi gian, O(1) khong gian. "
         "Day la thuat toan khong hieu qua cho danh sach lon nhung de hieu va cai dat.")

r = req("post", f"/assignments/{assignment_id}/submit/text", token=s2_token,
        json={"assignment_id": assignment_id, "content_text": text2})
if r.ok:
    sub2 = r.json()
    sub2_id = sub2["id"]
    log(True, "Student2 submit text", f"id={sub2_id[:8]}..., {sub2.get('word_count',0)} words")
elif "da nop" in r.text.lower() or "already" in r.text.lower():
    r2 = req("get", "/submissions/my", token=s2_token)
    subs = [s for s in r2.json().get("submissions",[]) if s["assignment_id"]==assignment_id]
    if subs:
        sub2_id = subs[0]["id"]
        log(True, "Student2 already submitted", sub2_id[:8])
    else:
        log(False, "Student2 submit", r.text[:80])
        sub2_id = None
else:
    log(False, "Student2 submit", r.text[:80])
    sub2_id = None

# List submissions (teacher)
r = req("get", f"/assignments/{assignment_id}/submissions", token=teacher_token)
if r.ok:
    subs = r.json().get("submissions",[])
    log(True, "List submissions (teacher)", f"{len(subs)} submissions")
else:
    log(False, "List submissions", r.text[:80])

# ─── 6. AUTO GRADE ────────────────────────────────────────────────────────────
print("\n═══ 6. AI GRADING ═══")

# Single auto grade
if sub1_id:
    r = req("post", f"/submissions/{sub1_id}/grade/auto", token=teacher_token)
    if r.ok:
        g = r.json()
        log(True, "Auto grade student1", f"total={g.get('total_score','?'):.1f}/100")
    else:
        log(False, "Auto grade student1", r.text[:80])

# Batch grade all (asynchronous task)
r = req("post", f"/assignments/{assignment_id}/grade/auto-all", token=teacher_token)
if r.ok:
    task_id = r.json().get("task_id", "?")
    log(True, "Batch grade ALL triggered", f"task_id={task_id}, status={r.json().get('status','?')}")
    time.sleep(2)  # Wait for background auto grading to complete
else:
    log(False, "Batch grade all", r.text[:80])

# Get grade (teacher)
if sub1_id:
    r = req("get", f"/submissions/{sub1_id}/grade", token=teacher_token)
    if r.ok:
        g = r.json().get("grading") or {}
        criteria_count = len(g.get("criteria_scores",[]))
        log(True, "Get grade detail (teacher)", f"total={g.get('total_score','?')}, {criteria_count} criteria")
    else:
        log(False, "Get grade (teacher)", r.text[:80])

# Save/override grade (teacher)
if sub1_id:
    r_grade = req("get", f"/submissions/{sub1_id}/grade", token=teacher_token)
    if r_grade.ok:
        g = r_grade.json().get("grading") or {}
        criteria_scores = [
            {"criteria_id": cs["criteria_id"], "final_score": cs["final_score"], "teacher_comment": "Lam tot!"}
            for cs in g.get("criteria_scores", [])
        ]
        r = req("put", f"/submissions/{sub1_id}/grade", token=teacher_token,
                json={"criteria_scores": criteria_scores, "overall_comment": "Bai lam kha tot"})
        log(r.ok, "Save grade (teacher override)", f"total={r.json().get('total_score','?')}" if r.ok else r.text[:80])

# Publish single grade
if sub1_id:
    r = req("post", f"/submissions/{sub1_id}/grade/publish", token=teacher_token)
    log(r.ok, "Publish grade student1", r.json().get("message","?") if r.ok else r.text[:80])

# Batch publish all
r = req("post", f"/assignments/{assignment_id}/grade/publish-all", token=teacher_token)
if r.ok:
    log(True, "Batch publish ALL", f"{r.json().get('published_count',0)} published")
else:
    log(False, "Batch publish all", r.text[:80])

# Student views own grade
if sub1_id:
    r = req("get", f"/submissions/{sub1_id}/grade", token=s1_token)
    if r.ok:
        g = r.json().get("grading") or {}
        log(True, "Student1 view grade", f"total={g.get('total_score','?')}, status={g.get('status','?')}")
    else:
        log(False, "Student1 view grade", r.text[:80])

# ─── 7. GRADES REPORT ─────────────────────────────────────────────────────────
print("\n═══ 7. GRADES REPORT ═══")

r = req("get", f"/assignments/{assignment_id}/grades", token=teacher_token)
if r.ok:
    data = r.json()
    grades = data.get("grades", [])
    stats = data.get("stats", {})
    log(True, "Grades report", f"{len(grades)} rows, avg={stats.get('avg','N/A')}, max={stats.get('max','N/A')}")
else:
    log(False, "Grades report", r.text[:80])

r = req("get", f"/assignments/{assignment_id}/grades/export", token=teacher_token)
log(r.ok and "text/csv" in r.headers.get("content-type",""), "Export CSV", f"{len(r.content)} bytes" if r.ok else r.text[:80])

# ─── 8. PLAGIARISM ────────────────────────────────────────────────────────────
print("\n═══ 8. PLAGIARISM ═══")

r = req("post", f"/assignments/{assignment_id}/plagiarism/check", token=teacher_token)
if r.ok:
    log(True, "Trigger plagiarism check", r.json().get("status","?"))
    time.sleep(2)  # wait for background task
else:
    log(False, "Trigger plagiarism check", r.text[:80])

r = req("get", f"/assignments/{assignment_id}/plagiarism/report", token=teacher_token)
if r.ok:
    report = r.json()
    pairs = report.get("pairs", [])
    status = report.get("status","?")
    log(True, "Get plagiarism report", f"status={status}, {len(pairs)} pairs checked")
    if pairs:
        top = max(pairs, key=lambda p: p.get("similarity_pct",0))
        log(True, "Highest similarity pair", f"{top.get('student_a_name','?')} vs {top.get('student_b_name','?')}: {top.get('similarity_pct',0):.1f}%")
        # Pair detail
        if sub1_id and sub2_id:
            r2 = req("get", f"/assignments/{assignment_id}/plagiarism/pair/{sub1_id}/{sub2_id}", token=teacher_token)
            log(r2.ok, "Plagiarism pair detail", f"similarity={r2.json().get('pair',{}).get('similarity_pct','?')}%" if r2.ok else r2.text[:80])
else:
    log(False, "Plagiarism report", r.text[:80])

# ─── 9. CLOSE ASSIGNMENT ─────────────────────────────────────────────────────
print("\n═══ 9. ASSIGNMENT LIFECYCLE ═══")

r = req("patch", f"/assignments/{assignment_id}/close", token=teacher_token)
log(r.ok, "Close assignment", r.json().get("status","?") if r.ok else r.text[:80])

# ─── 10. STUDENT DASHBOARD ────────────────────────────────────────────────────
print("\n═══ 10. STUDENT VIEWS ═══")

r = req("get", "/submissions/my", token=s1_token)
if r.ok:
    my_subs = r.json().get("submissions",[])
    log(True, "Student1 get my submissions", f"{len(my_subs)} total")
else:
    log(False, "Student1 my submissions", r.text[:80])

# ─── 11. RUBRIC TEMPLATES API ────────────────────────────────────────────────
print("\n═══ 11. RUBRIC TEMPLATES API ═══")

# 1. Get templates list (verify request ok)
r = req("get", "/rubrics/templates")
if r.ok:
    initial_templates = r.json().get("templates", [])
    initial_count = len(initial_templates)
    log(True, "Get templates list", f"found {initial_count} templates initially")
else:
    log(False, "Get templates list", r.text[:80])
    initial_count = 0

# 2. Create custom rubric template
custom_template_payload = {
    "name": "Rubric Test Template",
    "description": "API Test Description",
    "criteria": [
        {
            "criteria_name": "API Test Criteria",
            "max_score": 10,
            "weight": 100.0,
            "keywords": ["test"],
            "levels": [
                {"score": 10, "description": "Good"},
                {"score": 5, "description": "Medium"}
            ]
        }
    ]
}
r = req("post", "/rubrics/templates", token=teacher_token, json=custom_template_payload)
if r.ok:
    custom_template = r.json()
    custom_template_id = custom_template.get("id", "")
    log(custom_template_id.startswith("CUSTOM_"), "Create custom rubric template", f"id={custom_template_id}")
else:
    log(False, "Create custom rubric template", r.text[:80])
    custom_template_id = None

# 3. Verify custom template is listed
if custom_template_id:
    r = req("get", "/rubrics/templates")
    if r.ok:
        templates2 = r.json().get("templates", [])
        found_custom = any(t["id"] == custom_template_id for t in templates2)
        log(found_custom and len(templates2) == initial_count + 1, "Verify custom template in list", f"found={found_custom}, count={len(templates2)}")
    else:
        log(False, "Verify custom template in list", r.text[:80])

# 4. Delete custom rubric template
if custom_template_id:
    r = req("delete", f"/rubrics/templates/{custom_template_id}", token=teacher_token)
    log(r.ok, "Delete custom template", r.json().get("message", "") if r.ok else r.text[:80])

# 5. Verify custom template is deleted
if custom_template_id:
    r = req("get", "/rubrics/templates")
    if r.ok:
        templates3 = r.json().get("templates", [])
        still_exists = any(t["id"] == custom_template_id for t in templates3)
        log(not still_exists and len(templates3) == initial_count, "Verify template is deleted from list", f"still_exists={still_exists}, count={len(templates3)}")
    else:
        log(False, "Verify template is deleted from list", r.text[:80])

# ─── 12. DELETE CLASS ────────────────────────────────────────────────────────
print("\n═══ 12. DELETE CLASS ═══")
r = req("delete", f"/classes/{class_id}", token=teacher_token)
log(r.ok, "Delete class", r.json().get("message", "") if r.ok else r.text[:80])

# ─── SUMMARY ──────────────────────────────────────────────────────────────────
print("\n" + "═"*50)
print("SUMMARY")
print("═"*50)
passed = sum(1 for s,_,_ in results if s)
failed = sum(1 for s,_,_ in results if not s)
print(f"{OK} Passed: {passed}")
print(f"{FAIL} Failed: {failed}")
print(f"Total:   {len(results)}")
print()
if failed:
    print("Failed cases:")
    for s, name, detail in results:
        if not s:
            print(f"  {FAIL} {name}: {detail}")
