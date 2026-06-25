from .connection import db_pool, get_db_cursor

def init_pg_tables():
    if not db_pool:
        return
    with get_db_cursor() as cur:
        # Check if the tables are using the old key-value store structure
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'key'
            );
        """)
        is_old = cur.fetchone()[0]
        if is_old:
            print("Detected old JSONB tables. Dropping to re-create relational schemas...")
            cur.execute("""
                DROP TABLE IF EXISTS 
                    feedbacks, grading_results, new_submissions, plagiarism_reports, 
                    assignments, enrollments, classes, rubric_templates, users, questions;
            """)

        # 1. users
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(255) PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(255),
                role VARCHAR(50) NOT NULL,
                student_id VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                gemini_api_key TEXT,
                ai_provider VARCHAR(50) DEFAULT 'default',
                created_at TIMESTAMP WITH TIME ZONE,
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """)
        # Ensure columns exist on existing databases
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(50) DEFAULT 'default';")
        # 2. rubric_templates
        cur.execute("""
            CREATE TABLE IF NOT EXISTS rubric_templates (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                criteria JSONB,
                created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE
            );
        """)
        # 3. classes
        cur.execute("""
            CREATE TABLE IF NOT EXISTS classes (
                id VARCHAR(255) PRIMARY KEY,
                class_name VARCHAR(255) NOT NULL,
                subject VARCHAR(255),
                class_code VARCHAR(50) UNIQUE NOT NULL,
                teacher_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
                teacher_name VARCHAR(255),
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE
            );
        """)
        # 4. enrollments
        cur.execute("""
            CREATE TABLE IF NOT EXISTS enrollments (
                id VARCHAR(255) PRIMARY KEY,
                class_id VARCHAR(255) REFERENCES classes(id) ON DELETE CASCADE,
                student_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                student_name VARCHAR(255),
                student_email VARCHAR(255),
                joined_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50) DEFAULT 'active',
                CONSTRAINT unique_enrollment UNIQUE (class_id, student_id)
            );
        """)
        # 5. assignments
        cur.execute("""
            CREATE TABLE IF NOT EXISTS assignments (
                id VARCHAR(255) PRIMARY KEY,
                class_id VARCHAR(255) REFERENCES classes(id) ON DELETE CASCADE,
                class_name VARCHAR(255),
                teacher_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
                teacher_name VARCHAR(255),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                submission_type VARCHAR(50) NOT NULL,
                allow_resubmit BOOLEAN DEFAULT TRUE,
                open_at TIMESTAMP WITH TIME ZONE,
                deadline TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50) DEFAULT 'published',
                pass_threshold REAL DEFAULT 50.0,
                rubric JSONB,
                created_at TIMESTAMP WITH TIME ZONE,
                updated_at TIMESTAMP WITH TIME ZONE
            );
        """)
        # 6. new_submissions
        cur.execute("""
            CREATE TABLE IF NOT EXISTS new_submissions (
                id VARCHAR(255) PRIMARY KEY,
                assignment_id VARCHAR(255) REFERENCES assignments(id) ON DELETE CASCADE,
                student_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                student_name VARCHAR(255),
                version INTEGER DEFAULT 1,
                content_text TEXT,
                file_url VARCHAR(512),
                file_name VARCHAR(255),
                submitted_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50) DEFAULT 'submitted',
                word_count INTEGER DEFAULT 0,
                plagiarism_score REAL DEFAULT 0.0,
                plagiarism_flagged BOOLEAN DEFAULT FALSE,
                citation_report JSONB
            );
        """)
        # 7. grading_results
        cur.execute("""
            CREATE TABLE IF NOT EXISTS grading_results (
                id VARCHAR(255) PRIMARY KEY,
                submission_id VARCHAR(255) REFERENCES new_submissions(id) ON DELETE CASCADE UNIQUE,
                assignment_id VARCHAR(255) REFERENCES assignments(id) ON DELETE CASCADE,
                student_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                student_name VARCHAR(255),
                graded_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
                criteria_scores JSONB,
                total_score REAL,
                overall_comment TEXT,
                graded_at TIMESTAMP WITH TIME ZONE,
                published_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50)
            );
        """)
        # 8. plagiarism_reports
        cur.execute("""
            CREATE TABLE IF NOT EXISTS plagiarism_reports (
                id VARCHAR(255) PRIMARY KEY,
                assignment_id VARCHAR(255) REFERENCES assignments(id) ON DELETE CASCADE,
                generated_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50),
                pairs JSONB,
                summary JSONB
            );
        """)
        # 9. feedbacks
        cur.execute("""
            CREATE TABLE IF NOT EXISTS feedbacks (
                id VARCHAR(255) PRIMARY KEY,
                submission_id VARCHAR(255) REFERENCES new_submissions(id) ON DELETE CASCADE,
                char_offset_start INTEGER,
                char_offset_end INTEGER,
                severity VARCHAR(50),
                category VARCHAR(50),
                criteria_id VARCHAR(255),
                comment TEXT,
                suggested_fix JSONB,
                is_resolved BOOLEAN DEFAULT FALSE,
                is_dismissed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE
            );
        """)
        # 10. questions
        cur.execute("""
            CREATE TABLE IF NOT EXISTS questions (
                id VARCHAR(255) PRIMARY KEY,
                data JSONB
            );
        """)
