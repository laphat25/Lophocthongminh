import json
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone

# Password hash for 'pass1234'
PW_HASH = "$2b$12$B/SEVbnaVE96xITjrH0UzuqoB6B2jZc4CtPEO3RGzkbgAySKvLrWW"

# Directories
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# Generate consistent IDs
TEACHER_ID = "31b0977d-b73a-4a15-9811-dd30021f6b7e"
STUDENT1_ID = "e66e92f3-9dce-4ab0-95eb-975425c6f603"
STUDENT2_ID = "05f3df4e-a317-4444-b71b-304a09852c0b"
STUDENT3_ID = "c7d12f3e-8bc3-4d22-bf4f-12c8a98f12a3"
STUDENT4_ID = "d8a23e4f-9cd4-5e33-ae5f-23d9b09a23b4"

CLASS1_ID = "deb3307e-976c-46a0-8bc5-4bb94ea19990"
CLASS2_ID = "d4a5b6c7-1234-5678-abcd-ef0123456789"

ASGN1_ID = "ae5f865d-2060-492c-bb62-226713c7398a"  # Closed Bubble Sort
ASGN2_ID = "b6a7c8d9-3456-7890-abcd-ef0123456789"  # Active Binary Search
ASGN3_ID = "c7a8b9c0-4567-8901-abcd-ef0123456789"  # Active Stack & Queue

SUB1_ID = "ea37e826-b611-4758-9c08-516be8aa251a"   # Student 1 Bubble Sort
SUB2_ID = "b67cf225-daed-40d8-bfe3-edc6d50ee287"   # Student 2 Bubble Sort (plagiarized)
SUB3_ID = "sub3-bin-search-s1"                      # Student 1 Binary Search (ungraded)
SUB4_ID = "sub4-bin-search-s3"                      # Student 3 Binary Search (graded but not published)

now = datetime.now(timezone.utc)

# 1. users.json
users = {
    TEACHER_ID: {
        "id": TEACHER_ID,
        "email": "teacher@test.com",
        "password_hash": PW_HASH,
        "full_name": "Phạm Tiến Đạt",
        "role": "teacher",
        "student_id": "",
        "is_active": True,
        "created_at": (now - timedelta(days=30)).isoformat(),
        "updated_at": (now - timedelta(days=30)).isoformat()
    },
    STUDENT1_ID: {
        "id": STUDENT1_ID,
        "email": "student1@test.com",
        "password_hash": PW_HASH,
        "full_name": "Trần Thị A",
        "role": "student",
        "student_id": "SV001",
        "is_active": True,
        "created_at": (now - timedelta(days=29)).isoformat(),
        "updated_at": (now - timedelta(days=29)).isoformat()
    },
    STUDENT2_ID: {
        "id": STUDENT2_ID,
        "email": "student2@test.com",
        "password_hash": PW_HASH,
        "full_name": "Lê Văn B",
        "role": "student",
        "student_id": "SV002",
        "is_active": True,
        "created_at": (now - timedelta(days=28)).isoformat(),
        "updated_at": (now - timedelta(days=28)).isoformat()
    },
    STUDENT3_ID: {
        "id": STUDENT3_ID,
        "email": "student3@test.com",
        "password_hash": PW_HASH,
        "full_name": "Phạm Văn C",
        "role": "student",
        "student_id": "SV003",
        "is_active": True,
        "created_at": (now - timedelta(days=27)).isoformat(),
        "updated_at": (now - timedelta(days=27)).isoformat()
    },
    STUDENT4_ID: {
        "id": STUDENT4_ID,
        "email": "student4@test.com",
        "password_hash": PW_HASH,
        "full_name": "Hoàng Văn D",
        "role": "student",
        "student_id": "SV004",
        "is_active": True,
        "created_at": (now - timedelta(days=26)).isoformat(),
        "updated_at": (now - timedelta(days=26)).isoformat()
    }
}

# 2. classes.json
classes = {
    CLASS1_ID: {
        "id": CLASS1_ID,
        "class_name": "Kỹ thuật lập trình",
        "subject": "Lập trình",
        "class_code": "NJU7I3",
        "teacher_id": TEACHER_ID,
        "teacher_name": "Phạm Tiến Đạt",
        "description": "Lớp học kỹ thuật lập trình cơ bản C/C++",
        "is_active": True,
        "created_at": (now - timedelta(days=29)).isoformat()
    },
    CLASS2_ID: {
        "id": CLASS2_ID,
        "class_name": "Cấu trúc dữ liệu và giải thuật",
        "subject": "Cấu trúc dữ liệu",
        "class_code": "DSA2026",
        "teacher_id": TEACHER_ID,
        "teacher_name": "Phạm Tiến Đạt",
        "description": "Môn học cấu trúc dữ liệu và giải thuật thực hành",
        "is_active": True,
        "created_at": (now - timedelta(days=28)).isoformat()
    }
}

# 3. enrollments.json
enrollments = [
    # Class 1
    {
        "id": str(uuid.uuid4()),
        "class_id": CLASS1_ID,
        "student_id": STUDENT1_ID,
        "student_name": "Trần Thị A",
        "student_email": "student1@test.com",
        "joined_at": (now - timedelta(days=28)).isoformat(),
        "status": "active"
    },
    {
        "id": str(uuid.uuid4()),
        "class_id": CLASS1_ID,
        "student_id": STUDENT2_ID,
        "student_name": "Lê Văn B",
        "student_email": "student2@test.com",
        "joined_at": (now - timedelta(days=28)).isoformat(),
        "status": "active"
    },
    {
        "id": str(uuid.uuid4()),
        "class_id": CLASS1_ID,
        "student_id": STUDENT3_ID,
        "student_name": "Phạm Văn C",
        "student_email": "student3@test.com",
        "joined_at": (now - timedelta(days=27)).isoformat(),
        "status": "active"
    },
    # Class 2
    {
        "id": str(uuid.uuid4()),
        "class_id": CLASS2_ID,
        "student_id": STUDENT1_ID,
        "student_name": "Trần Thị A",
        "student_email": "student1@test.com",
        "joined_at": (now - timedelta(days=27)).isoformat(),
        "status": "active"
    },
    {
        "id": str(uuid.uuid4()),
        "class_id": CLASS2_ID,
        "student_id": STUDENT4_ID,
        "student_name": "Hoàng Văn D",
        "student_email": "student4@test.com",
        "joined_at": (now - timedelta(days=26)).isoformat(),
        "status": "active"
    }
]

# Rubric definitions
rubric_sorting = [
    {
        "criteria_id": "c1",
        "criteria_name": "Nội dung và kiến thức",
        "max_score": 10.0,
        "weight": 50.0,
        "keywords": ["thuật toán", "phân tích", "độ phức tạp", "bubble sort", "quick sort"],
        "levels": [
            {"score": 9.0, "description": "Trình bày đầy đủ, chính xác, có ví dụ minh họa"},
            {"score": 6.0, "description": "Trình bày đủ ý chính nhưng thiếu một số chi tiết kỹ thuật"},
            {"score": 3.0, "description": "Trình bày sơ sài, sai sót nhiều nội dung"}
        ]
    },
    {
        "criteria_id": "c2",
        "criteria_name": "Cấu trúc và trình bày",
        "max_score": 10.0,
        "weight": 50.0,
        "keywords": ["cấu trúc", "rõ ràng", "mạch lạc", "trình bày"],
        "levels": [
            {"score": 8.0, "description": "Bố cục rõ ràng, trình bày mạch lạc, dễ hiểu"},
            {"score": 4.0, "description": "Bố cục lộn xộn, khó theo dõi ý chính"}
        ]
    }
]

rubric_dsa = [
    {
        "criteria_id": "c3",
        "criteria_name": "Hiện thực cấu trúc dữ liệu",
        "max_score": 10.0,
        "weight": 60.0,
        "keywords": ["stack", "queue", "push", "pop", "enqueue", "dequeue"],
        "levels": [
            {"score": 10.0, "description": "Hiện thực đúng tất cả các hàm và cấu trúc lớp"},
            {"score": 7.0, "description": "Có lỗi logic nhỏ trong một số hàm phụ"},
            {"score": 4.0, "description": "Chỉ hiện thực được khung sườn, nhiều lỗi biên dịch"}
        ]
    },
    {
        "criteria_id": "c4",
        "criteria_name": "Tối ưu hóa bộ nhớ",
        "max_score": 10.0,
        "weight": 40.0,
        "keywords": ["bộ nhớ", "con trỏ", "leak", "độ phức tạp"],
        "levels": [
            {"score": 10.0, "description": "Không rò rỉ bộ nhớ, giải phóng vùng nhớ đầy đủ"},
            {"score": 5.0, "description": "Bỏ quên giải phóng một số node phụ"}
        ]
    }
]

# 4. assignments.json
assignments = {
    ASGN1_ID: {
        "id": ASGN1_ID,
        "class_id": CLASS1_ID,
        "class_name": "Kỹ thuật lập trình",
        "teacher_id": TEACHER_ID,
        "teacher_name": "Phạm Tiến Đạt",
        "title": "Bài tập 1: Phân tích thuật toán Bubble Sort",
        "description": "Hãy phân tích độ phức tạp thời gian và không gian của thuật toán sắp xếp nổi bọt (Bubble Sort). Minh họa bằng code C++.",
        "submission_type": "text",
        "allow_resubmit": False,
        "open_at": (now - timedelta(days=15)).isoformat(),
        "deadline": (now - timedelta(days=2)).isoformat(),
        "status": "closed",
        "pass_threshold": 50.0,
        "rubric": rubric_sorting,
        "created_at": (now - timedelta(days=15)).isoformat(),
        "updated_at": (now - timedelta(days=15)).isoformat()
    },
    ASGN2_ID: {
        "id": ASGN2_ID,
        "class_id": CLASS1_ID,
        "class_name": "Kỹ thuật lập trình",
        "teacher_id": TEACHER_ID,
        "teacher_name": "Phạm Tiến Đạt",
        "title": "Bài tập 2: Thuật toán Tìm kiếm nhị phân (Binary Search)",
        "description": "Viết chương trình tìm kiếm nhị phân trên mảng đã sắp xếp và giải thích điều kiện dừng của thuật toán. Nộp code trực tiếp hoặc file text.",
        "submission_type": "both",
        "allow_resubmit": True,
        "open_at": (now - timedelta(days=5)).isoformat(),
        "deadline": (now + timedelta(days=10)).isoformat(),
        "status": "published",
        "pass_threshold": 50.0,
        "rubric": rubric_sorting,
        "created_at": (now - timedelta(days=5)).isoformat(),
        "updated_at": (now - timedelta(days=5)).isoformat()
    },
    ASGN3_ID: {
        "id": ASGN3_ID,
        "class_id": CLASS2_ID,
        "class_name": "Cấu trúc dữ liệu và giải thuật",
        "teacher_id": TEACHER_ID,
        "teacher_name": "Phạm Tiến Đạt",
        "title": "Bài tập 1: Cấu trúc Stack và Queue bằng danh sách liên kết",
        "description": "Hiện thực hai cấu trúc dữ liệu Stack (ngăn xếp) và Queue (hàng đợi) bằng danh sách liên kết đơn. Viết các hàm push, pop, enqueue, dequeue.",
        "submission_type": "file",
        "allow_resubmit": False,
        "open_at": (now - timedelta(days=3)).isoformat(),
        "deadline": (now + timedelta(days=12)).isoformat(),
        "status": "published",
        "pass_threshold": 50.0,
        "rubric": rubric_dsa,
        "created_at": (now - timedelta(days=3)).isoformat(),
        "updated_at": (now - timedelta(days=3)).isoformat()
    }
}

# 5. new_submissions.json
submissions_v2 = {
    # Bubble Sort submissions (ASGN1)
    SUB1_ID: {
        "id": SUB1_ID,
        "assignment_id": ASGN1_ID,
        "student_id": STUDENT1_ID,
        "student_name": "Trần Thị A",
        "version": 1,
        "content_text": "Thuật toán sắp xếp nổi bọt (Bubble Sort) là một thuật toán sắp xếp đơn giản. Nguyên lý hoạt động: So sánh từng cặp phần tử liền kề và đổi chỗ nếu chúng không đúng thứ tự. Quá trình lặp lại cho đến khi không còn phần tử nào cần đổi chỗ. Độ phức tạp thời gian: O(n2) trong trường hợp xấu nhất và trung bình, O(n) trong trường hợp tốt nhất. Độ phức tạp không gian: O(1) vì chỉ cần thêm một biến tạm để đổi chỗ.",
        "file_url": None,
        "file_name": None,
        "submitted_at": (now - timedelta(days=14)).isoformat(),
        "status": "published",
        "word_count": 88,
        "plagiarism_score": 0.0,
        "plagiarism_flagged": False
    },
    SUB2_ID: {
        "id": SUB2_ID,
        "assignment_id": ASGN1_ID,
        "student_id": STUDENT2_ID,
        "student_name": "Lê Văn B",
        "version": 1,
        "content_text": "Thuật toán sắp xếp nổi bọt (Bubble Sort) là một thuật toán sắp xếp cơ bản. Hoạt động bằng cách lặp đi lặp lại qua danh sách, so sánh các phần tử liền kề và hoán đổi chúng nếu chúng không đúng thứ tự. Độ phức tạp thời gian: O(n2) trong trường hợp xấu nhất, O(n) trong trường hợp tốt nhất. Độ phức tạp không gian: O(1) do sử dụng thuật toán tại chỗ.",
        "file_url": None,
        "file_name": None,
        "submitted_at": (now - timedelta(days=13)).isoformat(),
        "status": "published",
        "word_count": 69,
        "plagiarism_score": 75.2,
        "plagiarism_flagged": True
    },
    # Binary Search submissions (ASGN2)
    SUB3_ID: {
        "id": SUB3_ID,
        "assignment_id": ASGN2_ID,
        "student_id": STUDENT1_ID,
        "student_name": "Trần Thị A",
        "version": 1,
        "content_text": "Thuật toán tìm kiếm nhị phân hoạt động trên mảng đã được sắp xếp. Trong mỗi bước, nó so sánh phần tử cần tìm với phần tử ở giữa mảng. Nếu bằng nhau, trả về vị trí. Nếu lớn hơn, tìm kiếm ở nửa bên phải. Nếu nhỏ hơn, tìm kiếm ở nửa bên trái. Điều kiện dừng: Khi tìm thấy phần tử hoặc khi chỉ số bên trái lớn hơn chỉ số bên phải.",
        "file_url": None,
        "file_name": None,
        "submitted_at": (now - timedelta(days=4)).isoformat(),
        "status": "submitted",
        "word_count": 78,
        "plagiarism_score": 0.0,
        "plagiarism_flagged": False
    },
    SUB4_ID: {
        "id": SUB4_ID,
        "assignment_id": ASGN2_ID,
        "student_id": STUDENT3_ID,
        "student_name": "Phạm Văn C",
        "version": 1,
        "content_text": "Tìm kiếm nhị phân là một thuật toán tìm kiếm hiệu quả có độ phức tạp thời gian O(log n). Thuật toán liên tục chia đôi không gian tìm kiếm. Chúng ta có ba biến: left, right và mid. Điều kiện lặp lại là left <= right. Nếu mảng[mid] == key, trả về mid. Nếu mảng[mid] < key, left = mid + 1. Ngược lại, right = mid - 1.",
        "file_url": None,
        "file_name": None,
        "submitted_at": (now - timedelta(days=3)).isoformat(),
        "status": "graded",
        "word_count": 72,
        "plagiarism_score": 0.0,
        "plagiarism_flagged": False
    }
}

# 6. grading_results.json
grading_results = {
    SUB1_ID: {
        "id": SUB1_ID,
        "submission_id": SUB1_ID,
        "assignment_id": ASGN1_ID,
        "student_id": STUDENT1_ID,
        "student_name": "Trần Thị A",
        "graded_by": TEACHER_ID,
        "criteria_scores": [
            {
                "criteria_id": "c1",
                "criteria_name": "Nội dung và kiến thức",
                "ai_suggested_score": 9.0,
                "ai_suggested_level": "Trình bày đầy đủ, chính xác, có ví dụ minh họa",
                "final_score": 9.0,
                "max_score": 10.0,
                "weight": 50.0,
                "teacher_comment": "Giải thích rất chi tiết và chính xác về độ phức tạp O(n2) và O(n).",
                "highlighted_text": ["Độ phức tạp thời gian: O(n2) trong trường hợp xấu nhất và trung bình, O(n) trong trường hợp tốt nhất."]
            },
            {
                "criteria_id": "c2",
                "criteria_name": "Cấu trúc và trình bày",
                "ai_suggested_score": 8.0,
                "ai_suggested_level": "Bố cục rõ ràng, trình bày mạch lạc, dễ hiểu",
                "final_score": 8.0,
                "max_score": 10.0,
                "weight": 50.0,
                "teacher_comment": "Bố cục mạch lạc, dễ theo dõi.",
                "highlighted_text": []
            }
        ],
        "total_score": 85.0,
        "overall_comment": "Bài làm rất tốt, nắm chắc lý thuyết thuật toán.",
        "graded_at": (now - timedelta(days=13)).isoformat(),
        "published_at": (now - timedelta(days=13)).isoformat(),
        "status": "published"
    },
    SUB2_ID: {
        "id": SUB2_ID,
        "submission_id": SUB2_ID,
        "assignment_id": ASGN1_ID,
        "student_id": STUDENT2_ID,
        "student_name": "Lê Văn B",
        "graded_by": TEACHER_ID,
        "criteria_scores": [
            {
                "criteria_id": "c1",
                "criteria_name": "Nội dung và kiến thức",
                "ai_suggested_score": 6.0,
                "ai_suggested_level": "Trình bày đủ ý chính nhưng thiếu một số chi tiết kỹ thuật",
                "final_score": 6.0,
                "max_score": 10.0,
                "weight": 50.0,
                "teacher_comment": "Ý thuyết hơi ngắn gọn, cần viết chi tiết hơn.",
                "highlighted_text": []
            },
            {
                "criteria_id": "c2",
                "criteria_name": "Cấu trúc và trình bày",
                "ai_suggested_score": 8.0,
                "ai_suggested_level": "Bố cục rõ ràng, trình bày mạch lạc, dễ hiểu",
                "final_score": 8.0,
                "max_score": 10.0,
                "weight": 50.0,
                "teacher_comment": "",
                "highlighted_text": []
            }
        ],
        "total_score": 70.0,
        "overall_comment": "Bài làm đạt yêu cầu nhưng nội dung hơi sơ sài. Lưu ý về vấn đề trùng lặp nội dung với SV001.",
        "graded_at": (now - timedelta(days=12)).isoformat(),
        "published_at": (now - timedelta(days=12)).isoformat(),
        "status": "published"
    },
    SUB4_ID: {
        "id": SUB4_ID,
        "submission_id": SUB4_ID,
        "assignment_id": ASGN2_ID,
        "student_id": STUDENT3_ID,
        "student_name": "Phạm Văn C",
        "graded_by": TEACHER_ID,
        "criteria_scores": [
            {
                "criteria_id": "c1",
                "criteria_name": "Nội dung và kiến thức",
                "ai_suggested_score": 9.0,
                "ai_suggested_level": "Trình bày đầy đủ, chính xác, có ví dụ minh họa",
                "final_score": 9.0,
                "max_score": 10.0,
                "weight": 50.0,
                "teacher_comment": "Gợi ý AI chuẩn, giải thích logic chia để trị rõ ràng.",
                "highlighted_text": []
            },
            {
                "criteria_id": "c2",
                "criteria_name": "Cấu trúc và trình bày",
                "ai_suggested_score": 8.0,
                "ai_suggested_level": "Bố cục rõ ràng, trình bày mạch lạc, dễ hiểu",
                "final_score": 8.0,
                "max_score": 10.0,
                "weight": 50.0,
                "teacher_comment": "",
                "highlighted_text": []
            }
        ],
        "total_score": 85.0,
        "overall_comment": "Bài làm tốt, trình bày gọn gàng.",
        "graded_at": (now - timedelta(days=2)).isoformat(),
        "published_at": None,
        "status": "graded"
    }
}

# 7. plagiarism_reports.json
plagiarism_reports = {
    ASGN1_ID: {
        "id": str(uuid.uuid4()),
        "assignment_id": ASGN1_ID,
        "generated_at": (now - timedelta(days=12)).isoformat(),
        "status": "completed",
        "pairs": [
            {
                "submission_a": SUB1_ID,
                "student_a_name": "Trần Thị A",
                "submission_b": SUB2_ID,
                "student_b_name": "Lê Văn B",
                "similarity_score": 0.75,
                "similarity_pct": 75.2,
                "flag": "warning"
            }
        ],
        "summary": {
            "total_submissions": 2,
            "total_pairs": 1,
            "flagged_pairs": 1,
            "severe_pairs": 0,
            "max_similarity_pct": 75.2
        }
    }
}

# Write files
with open(DATA_DIR / "users.json", "w", encoding="utf-8") as f:
    json.dump(users, f, indent=2, ensure_ascii=False)

with open(DATA_DIR / "classes.json", "w", encoding="utf-8") as f:
    json.dump(classes, f, indent=2, ensure_ascii=False)

with open(DATA_DIR / "enrollments.json", "w", encoding="utf-8") as f:
    json.dump(enrollments, f, indent=2, ensure_ascii=False)

with open(DATA_DIR / "assignments.json", "w", encoding="utf-8") as f:
    json.dump(assignments, f, indent=2, ensure_ascii=False)

with open(DATA_DIR / "new_submissions.json", "w", encoding="utf-8") as f:
    json.dump(submissions_v2, f, indent=2, ensure_ascii=False)

with open(DATA_DIR / "grading_results.json", "w", encoding="utf-8") as f:
    json.dump(grading_results, f, indent=2, ensure_ascii=False)

with open(DATA_DIR / "plagiarism_reports.json", "w", encoding="utf-8") as f:
    json.dump(plagiarism_reports, f, indent=2, ensure_ascii=False)

print("Demo data successfully generated!")
