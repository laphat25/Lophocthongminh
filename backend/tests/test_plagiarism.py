import pytest
from app.services.plagiarism import check_plagiarism, compute_similarity_matrix, _tokenize

def test_tokenize():
    text = "Thuật toán Bubble Sort là một thuật toán sắp xếp đơn giản."
    tokens = _tokenize(text)
    assert "bubble" in tokens
    assert "sort" in tokens
    # stop word "là", "một" should be removed
    assert "là" not in tokens
    assert "một" not in tokens

def test_check_plagiarism_zero():
    new_text = "This is a new unique submission content text."
    corpus = ["Completely unrelated sentences and words here."]
    # Some common words might overlap, but similarity should be low
    score = check_plagiarism(new_text, corpus)
    assert score < 30.0

def test_check_plagiarism_high():
    text = "Thuat toan Bubble Sort la mot thuat toan sap xep don gian hoat dong bang cach so sanh phan tu lien ke."
    corpus = [
        "Bubble Sort la mot thuat toan sap xep don gian hoat dong bang cach so sanh phan tu lien ke."
    ]
    score = check_plagiarism(text, corpus)
    assert score > 80.0

def test_compute_similarity_matrix():
    subs = [
        {"id": "sub_a", "student_name": "Student A", "content_text": "Bubble sort is a simple sorting algorithm"},
        {"id": "sub_b", "student_name": "Student B", "content_text": "Bubble sort is a simple sorting algorithm"},
        {"id": "sub_c", "student_name": "Student C", "content_text": "Python is a programming language"}
    ]
    results = compute_similarity_matrix(subs)
    # A vs B should have 100% similarity (or near 100%)
    # B vs C and A vs C should have low similarity
    assert len(results) == 3
    pair_ab = [r for r in results if r["submission_a"] == "sub_a" and r["submission_b"] == "sub_b"][0]
    assert pair_ab["similarity_pct"] > 90.0
    assert pair_ab["flag"] == "severe"
