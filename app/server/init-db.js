const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');

// SQLite 初始化 SQL
const initSQL = `
-- A-Level 学生管理系统 SQLite 数据库初始化脚本

-- 1. 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff', 'supervisor', 'teacher', 'student')),
    student_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 学生表
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    english_name TEXT,
    grade TEXT NOT NULL, -- 年级名称，如：2024级, 2025级
    school TEXT,
    enrollment_year INTEGER,
    study_duration INTEGER DEFAULT 2, -- 学制：2年或3年
    class_track TEXT, -- international | domestic（国际/国内）
    advisor_id TEXT REFERENCES users(id),
    phone TEXT,
    email TEXT,
    wechat TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    parent_email TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'inactive')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. 课程表
CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subject_code TEXT,
    board TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    teacher_id TEXT REFERENCES users(id),
    academic_year TEXT,
    semester TEXT,
    max_students INTEGER DEFAULT 20,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. 学生选课表
CREATE TABLE IF NOT EXISTS student_courses (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    internal_grade TEXT,
    internal_score INTEGER,
    mock_grade TEXT,
    mock_score INTEGER,
    final_grade TEXT,
    final_score INTEGER,
    status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'completed', 'dropped')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, course_id)
);

-- 5. 单元成绩表
CREATE TABLE IF NOT EXISTS unit_grades (
    id TEXT PRIMARY KEY,
    student_course_id TEXT NOT NULL REFERENCES student_courses(id) ON DELETE CASCADE,
    unit_name TEXT NOT NULL,
    unit_code TEXT,
    score INTEGER NOT NULL,
    max_score INTEGER DEFAULT 100,
    grade TEXT,
    exam_date DATE,
    exam_type TEXT CHECK (exam_type IN ('internal', 'mock', 'final', 'retake')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. 目标院校库表
CREATE TABLE IF NOT EXISTS target_universities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    ranking INTEGER,
    course_name TEXT,
    a_level_requirement TEXT,
    language_requirement TEXT,
    subject_requirements TEXT,
    -- 体系/层级（渐进式扩展）
    degree_level TEXT, -- undergrad/postgrad
    edu_system TEXT, -- commonwealth/us/other
    -- 美本轻量字段（院校级）
    school_type TEXT, -- 综合/文理/理工
    admit_rate REAL, -- 0-100
    application_systems TEXT, -- JSON array
    rounds_supported TEXT, -- JSON array
    costs TEXT, -- JSON
    location_text TEXT,
    campus_size_text TEXT,
    -- 结构化要求（用于匹配/雷达图）
    requirements_struct TEXT, -- JSON
    application_deadline DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. 学生目标院校关联表
CREATE TABLE IF NOT EXISTS student_universities (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    university_id TEXT NOT NULL REFERENCES target_universities(id) ON DELETE CASCADE,
    application_type TEXT CHECK (application_type IN ('reach', 'target', 'safety')),
    status TEXT DEFAULT 'interested' CHECK (status IN ('interested', 'applying', 'submitted', 'offer', 'rejected', 'declined')),
    personal_statement_status TEXT,
    reference_status TEXT,
    submitted_at DATETIME,
    decision_date DATE,
    conditions TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, university_id)
);

-- 8. 语言成绩表
CREATE TABLE IF NOT EXISTS language_scores (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    test_type TEXT NOT NULL CHECK (test_type IN ('IELTS', 'TOEFL', 'PTE', 'Duolingo')),
    overall_score REAL NOT NULL,
    listening_score REAL,
    reading_score REAL,
    writing_score REAL,
    speaking_score REAL,
    component_scores TEXT, -- JSON：用于 Duolingo 等自定义维度（如 { literacy, conversation, comprehension, production }）
    test_date DATE NOT NULL,
    valid_until DATE,
    is_best_score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. 标化考试表
CREATE TABLE IF NOT EXISTS standardized_tests (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    test_type TEXT NOT NULL CHECK (test_type IN ('SAT', 'ACT', 'AP', 'IB', 'STEP', 'MAT', 'TMUA')),
    score INTEGER NOT NULL,
    max_score INTEGER,
    section_scores TEXT,
    test_date DATE NOT NULL,
    is_best_score INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. 课外活动表
CREATE TABLE IF NOT EXISTS extracurriculars (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    activity_type TEXT CHECK (activity_type IN ('academic', 'leadership', 'community', 'arts', 'sports', 'other')),
    role TEXT,
    organization TEXT,
    start_date TEXT,
    end_date TEXT,
    ongoing INTEGER DEFAULT 0,
    description TEXT,
    hours_per_week INTEGER,
    achievements TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('academic', 'language', 'standardized', 'extracurricular', 'application')),
    priority TEXT CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    deadline DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. 考试安排表
CREATE TABLE IF NOT EXISTS exam_schedule (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    exam_board TEXT,
    unit TEXT,
    exam_date DATE NOT NULL,
    exam_time TEXT,
    venue TEXT,
    duration INTEGER,
    status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'missed')),
    score INTEGER,
    max_score INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. 院校专业表（每个院校可配置多个专业及其要求）
CREATE TABLE IF NOT EXISTS university_programs (
    id TEXT PRIMARY KEY,
    university_id TEXT NOT NULL REFERENCES target_universities(id) ON DELETE CASCADE,
    program_name TEXT NOT NULL,
    department TEXT,
    a_level_requirement TEXT,
    language_requirement TEXT,
    subject_requirements TEXT,
    -- 结构化要求（统一入口：commonwealth/us）
    requirements_struct TEXT, -- JSON
    -- 美本轻量字段（专业级）
    us_major_selectivity TEXT, -- 高/中/低
    us_prerequisites_text TEXT,
    portfolio_required INTEGER DEFAULT 0,
    portfolio_notes TEXT,
    application_deadline DATE,
    tuition_fee TEXT,
    duration TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. 课程单元配置表（每门课程可定义其考试单元）
CREATE TABLE IF NOT EXISTS course_units (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    unit_code TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    is_advanced INTEGER DEFAULT 0, -- 是否高阶单元（用于 A* 判定）
    max_score INTEGER DEFAULT 100,
    weight REAL DEFAULT 1.0,
    is_required INTEGER DEFAULT 1, -- 是否为该课程的必考/计分单元；0 表示可选单元
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. 考季定义表
CREATE TABLE IF NOT EXISTS exam_sessions (
    id TEXT PRIMARY KEY,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    label TEXT NOT NULL,
    board TEXT DEFAULT 'Edexcel',
    registration_deadline DATE,
    results_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. 考季单元分配表
CREATE TABLE IF NOT EXISTS session_unit_plans (
    id TEXT PRIMARY KEY,
    student_course_id TEXT NOT NULL REFERENCES student_courses(id) ON DELETE CASCADE,
    course_unit_id TEXT NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
    exam_session_id TEXT NOT NULL REFERENCES exam_sessions(id),
    plan_type TEXT DEFAULT 'first_sit' CHECK (plan_type IN ('first_sit', 'resit')),
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'registered', 'completed', 'cancelled')),
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX IF NOT EXISTS idx_exam_sessions_year_month ON exam_sessions(year, month);
CREATE INDEX IF NOT EXISTS idx_session_unit_plans_student_course ON session_unit_plans(student_course_id);
CREATE INDEX IF NOT EXISTS idx_session_unit_plans_session ON session_unit_plans(exam_session_id);
CREATE INDEX IF NOT EXISTS idx_session_unit_plans_unit ON session_unit_plans(course_unit_id);

-- 只阻止未来新增/修改重复数据，不清理已有历史记录，便于旧库平滑升级
CREATE TRIGGER IF NOT EXISTS trg_exam_sessions_unique_identity_insert
BEFORE INSERT ON exam_sessions
WHEN EXISTS (
  SELECT 1 FROM exam_sessions
  WHERE year = NEW.year
    AND (CASE WHEN month = 6 THEN 5 ELSE month END) = (CASE WHEN NEW.month = 6 THEN 5 ELSE NEW.month END)
    AND COALESCE(board, 'Edexcel') = COALESCE(NEW.board, 'Edexcel')
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate exam session');
END;

CREATE TRIGGER IF NOT EXISTS trg_exam_sessions_unique_identity_update
BEFORE UPDATE OF year, month, board ON exam_sessions
WHEN EXISTS (
  SELECT 1 FROM exam_sessions
  WHERE id <> NEW.id
    AND year = NEW.year
    AND (CASE WHEN month = 6 THEN 5 ELSE month END) = (CASE WHEN NEW.month = 6 THEN 5 ELSE NEW.month END)
    AND COALESCE(board, 'Edexcel') = COALESCE(NEW.board, 'Edexcel')
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate exam session');
END;

CREATE TRIGGER IF NOT EXISTS trg_session_unit_plans_unique_identity_insert
BEFORE INSERT ON session_unit_plans
WHEN NEW.status <> 'cancelled' AND EXISTS (
  SELECT 1 FROM session_unit_plans
  WHERE student_course_id = NEW.student_course_id
    AND course_unit_id = NEW.course_unit_id
    AND exam_session_id = NEW.exam_session_id
    AND plan_type = NEW.plan_type
    AND status <> 'cancelled'
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate session unit plan');
END;

CREATE TRIGGER IF NOT EXISTS trg_session_unit_plans_unique_identity_update
BEFORE UPDATE OF student_course_id, course_unit_id, exam_session_id, plan_type, status ON session_unit_plans
WHEN NEW.status <> 'cancelled' AND EXISTS (
  SELECT 1 FROM session_unit_plans
  WHERE id <> NEW.id
    AND student_course_id = NEW.student_course_id
    AND course_unit_id = NEW.course_unit_id
    AND exam_session_id = NEW.exam_session_id
    AND plan_type = NEW.plan_type
    AND status <> 'cancelled'
)
BEGIN
  SELECT RAISE(ABORT, 'duplicate session unit plan');
END;
`;

function initDatabase() {
  console.log('Initializing SQLite database...\n');
  
  try {
    if (fs.existsSync(DB_PATH)) {
      console.log('Database already exists at:', DB_PATH);
      console.log('To reinitialize, delete the file manually first.');
      process.exit(0);
    }
    
    // 创建新数据库
    const db = new Database(DB_PATH);
    console.log('✓ Database file created:', DB_PATH);
    
    // 启用外键约束
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    // 执行初始化 SQL
    db.exec(initSQL);
    console.log('✓ All tables created successfully');
    
    // 验证表创建
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`\nCreated ${tables.length} tables:`);
    tables.forEach(t => console.log(`  - ${t.name}`));
    
    db.close();
    
    console.log('\n✅ Database initialization completed!');
    console.log(`Database: ${DB_PATH}`);
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

initDatabase();
