-- A-Level 学生管理系统 PostgreSQL 数据库初始化脚本
-- 创建数据库: CREATE DATABASE alevel_management;

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 学生表
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    english_name VARCHAR(100),
    grade VARCHAR(20) NOT NULL,
    school VARCHAR(200),
    enrollment_year INTEGER,
    advisor_id UUID REFERENCES users(id),
    phone VARCHAR(20),
    email VARCHAR(100),
    wechat VARCHAR(50),
    parent_name VARCHAR(100),
    parent_phone VARCHAR(20),
    parent_email VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. 课程表
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    subject_code VARCHAR(20),
    board VARCHAR(20) NOT NULL,
    grade_level VARCHAR(20) NOT NULL,
    teacher_id UUID REFERENCES users(id),
    academic_year VARCHAR(20),
    semester VARCHAR(20),
    max_students INTEGER DEFAULT 20,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 学生选课表
CREATE TABLE IF NOT EXISTS student_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    internal_grade VARCHAR(5),
    internal_score INTEGER,
    mock_grade VARCHAR(5),
    mock_score INTEGER,
    final_grade VARCHAR(5),
    final_score INTEGER,
    status VARCHAR(20) DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'completed', 'dropped')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- 5. 单元成绩表
CREATE TABLE IF NOT EXISTS unit_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_course_id UUID NOT NULL REFERENCES student_courses(id) ON DELETE CASCADE,
    unit_name VARCHAR(100) NOT NULL,
    unit_code VARCHAR(20),
    score INTEGER NOT NULL,
    max_score INTEGER DEFAULT 100,
    grade VARCHAR(5),
    exam_date DATE,
    exam_type VARCHAR(20) CHECK (exam_type IN ('internal', 'mock', 'final', 'retake')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. 目标院校库表
CREATE TABLE IF NOT EXISTS target_universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    country VARCHAR(50) NOT NULL,
    ranking INTEGER,
    course_name VARCHAR(200),
    a_level_requirement VARCHAR(50),
    language_requirement VARCHAR(100),
    subject_requirements TEXT,
    application_deadline DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. 学生目标院校关联表
CREATE TABLE IF NOT EXISTS student_universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    university_id UUID NOT NULL REFERENCES target_universities(id) ON DELETE CASCADE,
    application_type VARCHAR(20) CHECK (application_type IN ('reach', 'target', 'safety')),
    status VARCHAR(20) DEFAULT 'interested' CHECK (status IN ('interested', 'applying', 'submitted', 'offer', 'rejected', 'declined')),
    personal_statement_status VARCHAR(50),
    reference_status VARCHAR(50),
    submitted_at TIMESTAMP WITH TIME ZONE,
    decision_date DATE,
    conditions TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, university_id)
);

-- 8. 语言成绩表
CREATE TABLE IF NOT EXISTS language_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    test_type VARCHAR(20) NOT NULL CHECK (test_type IN ('IELTS', 'TOEFL', 'PTE', 'Duolingo')),
    overall_score DECIMAL(3,1) NOT NULL,
    listening_score DECIMAL(3,1),
    reading_score DECIMAL(3,1),
    writing_score DECIMAL(3,1),
    speaking_score DECIMAL(3,1),
    test_date DATE NOT NULL,
    valid_until DATE,
    is_best_score BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. 标化考试表
CREATE TABLE IF NOT EXISTS standardized_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    test_type VARCHAR(20) NOT NULL CHECK (test_type IN ('SAT', 'ACT', 'AP', 'IB', 'STEP', 'MAT', 'TMUA')),
    score INTEGER NOT NULL,
    max_score INTEGER,
    section_scores JSONB,
    test_date DATE NOT NULL,
    is_best_score BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. 课外活动表
CREATE TABLE IF NOT EXISTS extracurriculars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    activity_type VARCHAR(50) CHECK (activity_type IN ('academic', 'leadership', 'community', 'arts', 'sports', 'other')),
    role VARCHAR(100),
    organization VARCHAR(200),
    start_date VARCHAR(20),
    end_date VARCHAR(20),
    ongoing BOOLEAN DEFAULT FALSE,
    description TEXT,
    hours_per_week INTEGER,
    achievements JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) CHECK (category IN ('academic', 'language', 'standardized', 'extracurricular', 'application')),
    priority VARCHAR(20) CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    deadline DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. 考试安排表
CREATE TABLE IF NOT EXISTS exam_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL,
    exam_board VARCHAR(50),
    unit VARCHAR(50),
    exam_date DATE NOT NULL,
    exam_time TIME,
    venue VARCHAR(200),
    duration INTEGER,
    status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'missed')),
    score INTEGER,
    max_score INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_students_advisor ON students(advisor_id);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

CREATE INDEX IF NOT EXISTS idx_student_courses_student ON student_courses(student_id);
CREATE INDEX IF NOT EXISTS idx_student_courses_course ON student_courses(course_id);

CREATE INDEX IF NOT EXISTS idx_unit_grades_student_course ON unit_grades(student_course_id);

CREATE INDEX IF NOT EXISTS idx_student_universities_student ON student_universities(student_id);
CREATE INDEX IF NOT EXISTS idx_student_universities_uni ON student_universities(university_id);

CREATE INDEX IF NOT EXISTS idx_language_scores_student ON language_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_standardized_tests_student ON standardized_tests(student_id);
CREATE INDEX IF NOT EXISTS idx_extracurriculars_student ON extracurriculars(student_id);
CREATE INDEX IF NOT EXISTS idx_tasks_student ON tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedule_student ON exam_schedule(student_id);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要自动更新 updated_at 的表创建触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_courses_updated_at BEFORE UPDATE ON student_courses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_student_universities_updated_at BEFORE UPDATE ON student_universities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
