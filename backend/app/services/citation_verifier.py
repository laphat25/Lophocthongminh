import re
import httpx
import asyncio
from typing import List, Dict, Optional
from app.logger import logger

# Keywords to identify local Vietnamese curriculum or administrative documents
LOCAL_KEYWORDS = [
    "bộ giáo dục", "đào tạo", "thông tư", "nghị định", "quyết định",
    "sách giáo khoa", "sgk", "toán 5", "tiếng việt", "tiếng anh",
    "cánh diều", "chân trời sáng tạo", "kết nối tri thức",
    "nhà xuất bản", "nxb", "luật", "chính phủ", "quy định",
    "phương pháp dạy học", "giáo án", "trường tiểu học"
]

def extract_references_section(text: str) -> str:
    """
    Finds the last occurrence of bibliography/references headers and returns the text after it.
    Truncates subsequent headings such as peer evaluation.
    """
    if not text:
        return ""
        
    # Pattern to match headers like "Tài liệu tham khảo", "References", etc.
    pattern = r'(?i)(?:^|\n)(?:[a-z0-9\.\s\-#\*•]{0,20})?(danh\s+mục\s+tài\s+liệu\s+tham\s+khảo|tài\s+liệu\s+tham\s+khảo|references|bibliography|sources)(?:\s*[:\*#-]+)?(?:\s+(?=\[\d+\]|\(\d+\)|\d+[\./]\s|[\-\*•]\s)|(?:\s*\n)|$)'
    matches = list(re.finditer(pattern, text))
    
    if not matches:
        return ""
        
    # Take the last match to avoid matching references mentioned in text body
    last_match = matches[-1]
    start_index = last_match.end()
    ref_text = text[start_index:].strip()
    
    # Truncate when encountering subsequent headings (e.g. Markdown headers or Uppercase Vietnamese titles)
    heading_patterns = [
        r'\n\s*(#+\s+[^\n]+)', # Markdown headings
        r'\n\s*([A-Z0-9ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s:]{5,})(?:\n|$)' # Uppercase headings
    ]
    
    trunc_index = len(ref_text)
    for p in heading_patterns:
        match = re.search(p, ref_text)
        if match:
            idx = match.start()
            if idx < trunc_index:
                trunc_index = idx
                
    return ref_text[:trunc_index].strip()

def parse_citations(references_text: str) -> List[str]:
    """
    Splits the references section into individual citation strings.
    Handles both normal and concatenated single-line layouts using regex markers.
    """
    if not references_text:
        return []
        
    # Split citation markers:
    # 1. Bracketed/parenthesized numbers preceded by any whitespace: [1] or (1)
    # 2. Numbered or bullet list markers (e.g. 1., 1/, -, *, •) preceded by start of string or newline (+ optional spaces)
    pattern = r'(?:^|\n)\s*(\[\d+\]|\(\d+\)|\d+[\./]|[\-\*•])\s+|(?<=\s)(\[\d+\]|\(\d+\))\s+'
    
    matches = list(re.finditer(pattern, references_text))
    if not matches:
        return [references_text.strip()]
        
    citations = []
    for i in range(len(matches)):
        m = matches[i]
        start = m.start(1) if m.group(1) is not None else m.start(2)
        
        if i + 1 < len(matches):
            nm = matches[i+1]
            end = nm.start(1) if nm.group(1) is not None else nm.start(2)
        else:
            end = len(references_text)
            
        cit = references_text[start:end].strip()
        # Merge multi-line references (newlines converted to space)
        cit = re.sub(r'\s+', ' ', cit)
        if cit:
            citations.append(cit)
            
    if citations:
        last = citations[-1]
        # Match capital letter headings including all Vietnamese accent marks
        # Minimum 5 characters to avoid false matches on short acronyms
        header_match = re.search(
            r'\s+([A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ\s]{5,})(?:\s+|$)', 
            last
        )
        if header_match:
            citations[-1] = last[:header_match.start()].strip()
            
    return citations

def extract_title(citation: str) -> str:
    """
    Tries to extract the title from a citation string.
    Finds the year block (e.g. YYYY, YYYYa, YYYY, Month Day, or n.d. in APA 7 style),
    and takes the next block of text split by periods.
    """
    match = re.search(r'\(\s*(\d{4}|n\.d\.)[^)]*\)[\.\s]*', citation)
    if match:
        after_year = citation[match.end():].strip()
        parts = after_year.split('.')
        for part in parts:
            part_str = part.strip()
            # If the part has at least 2 words, it's likely the title in APA 7 style
            if len(part_str.split()) >= 2:
                return part_str
    # Fallback: strip leading list markers from citation text to clean the query
    clean_query = re.sub(r'^\[\d+\]\s*', '', citation)
    clean_query = re.sub(r'^\(\d+\)\s*', '', clean_query)
    clean_query = re.sub(r'^\d+[\./]\s*', '', clean_query)
    clean_query = re.sub(r'^[\-\*•]\s*', '', clean_query)
    return clean_query.strip()

def check_similarity(cited_title: str, matched_title: str) -> float:
    """
    Computes a token overlap similarity ratio. Calculates what percentage of the key 
    words in the cited title exist in the matched title.
    """
    def clean(s):
        s = s.lower()
        # Keep letters (including Vietnamese), numbers and spaces
        s = re.sub(r'[^a-z0-9\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', ' ', s)
        return " ".join(s.split())
        
    c_clean = clean(cited_title)
    m_clean = clean(matched_title)
    
    c_words = set(c_clean.split())
    m_words = set(m_clean.split())
    
    ignore_words = {
        "and", "the", "of", "in", "on", "a", "an", "to", "for", "with", "by", "at", "from", 
        "và", "của", "về", "trong", "cho", "tại", "từ", "bằng", "với", "được", "các", "những"
    }
    
    c_imp = [w for w in c_words if len(w) > 2 and w not in ignore_words]
    if not c_imp: 
        c_imp = list(c_words)
        
    if not c_imp:
        return 0.0
        
    matches_in_m = sum(1 for w in c_imp if w in m_words)
    return matches_in_m / len(c_imp)

def is_local_document(citation: str) -> bool:
    """
    Checks if the citation matches local Vietnamese curriculum or administrative keywords.
    """
    citation_lower = citation.lower()
    for kw in LOCAL_KEYWORDS:
        if kw in citation_lower:
            return True
    return False

async def verify_single_citation(citation: str, client: Optional[httpx.AsyncClient] = None) -> Dict:
    """
    Queries CrossRef API to check if a single citation exists and is valid (asynchronous).
    """
    cleaned_citation = citation.strip()
    
    # Strip leading list markers to get a clean search query
    clean_query = re.sub(r'^\[\d+\]\s*', '', cleaned_citation)
    clean_query = re.sub(r'^\(\d+\)\s*', '', clean_query)
    clean_query = re.sub(r'^\d+[\./]\s*', '', clean_query)
    clean_query = clean_query.strip()
    
    if not clean_query:
        return {
            "raw_text": citation,
            "status": "suspicious",
            "matched_title": None,
            "matched_doi": None,
            "matched_url": None,
            "score": 0.0
        }
 
    # Check local documents heuristic
    if is_local_document(clean_query):
        return {
            "raw_text": citation,
            "status": "local_document",
            "matched_title": "Tài liệu / Giáo trình / Văn bản nội bộ Việt Nam",
            "matched_doi": None,
            "matched_url": None,
            "score": 1.0
        }
 
    # Extract specific cited title for similarity check
    cited_title = extract_title(cleaned_citation)
 
    # Query CrossRef API
    url = "https://api.crossref.org/works"
    params = {
        "query": clean_query,
        "rows": 3
    }
    headers = {
        "User-Agent": "AssignmentMarkingSystem/1.0 (mailto:academic-integrity@hust.edu.vn)"
    }
    
    try:
        if client is not None:
            response = await client.get(url, params=params, headers=headers, timeout=5.0)
        else:
            async with httpx.AsyncClient() as local_client:
                response = await local_client.get(url, params=params, headers=headers, timeout=5.0)
                
        if response.status_code == 200:
            items = response.json().get("message", {}).get("items", [])
            if items:
                top_match = items[0]
                matched_title_list = top_match.get("title", [])
                matched_title = matched_title_list[0] if matched_title_list else "Unknown Title"
                doi = top_match.get("DOI")
                doi_url = top_match.get("URL") or (f"https://doi.org/{doi}" if doi else None)
                
                similarity = check_similarity(cited_title, matched_title)
                
                # If similarity overlap is >= 45%, we mark it as verified
                status = "verified" if similarity >= 0.45 else "suspicious"
                
                return {
                    "raw_text": citation,
                    "status": status,
                    "matched_title": matched_title,
                    "matched_doi": doi,
                    "matched_url": doi_url,
                    "score": round(similarity, 2)
                }
    except Exception as e:
        logger.error(f"Error querying CrossRef for citation '{clean_query}': {e}")
        
    return {
        "raw_text": citation,
        "status": "suspicious",
        "matched_title": None,
        "matched_doi": None,
        "matched_url": None,
        "score": 0.0
    }

async def verify_all_citations(text: str) -> Dict:
    """
    Extracts the references section from the text, parses citations, 
    and checks each of them via CrossRef API in parallel.
    """
    ref_section = extract_references_section(text)
    if not ref_section:
        return {
            "has_citations": False,
            "citations": []
        }
        
    citations = parse_citations(ref_section)
    if not citations:
        return {
            "has_citations": False,
            "citations": []
        }
        
    async with httpx.AsyncClient() as client:
        tasks = [verify_single_citation(c, client=client) for c in citations]
        results = await asyncio.gather(*tasks)
        
    return {
        "has_citations": True,
        "citations": results
    }

