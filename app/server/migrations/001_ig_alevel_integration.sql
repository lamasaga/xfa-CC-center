CREATE TABLE IF NOT EXISTS academic_years (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    starts_on TEXT NOT NULL,
    ends_on TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planning'
      CHECK (status IN ('planning', 'active', 'closed')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS student_academic_records (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    academic_year_id TEXT NOT NULL,
    school_grade INTEGER CHECK (school_grade BETWEEN 9 AND 12),
    qualification_stage TEXT
      CHECK (qualification_stage IN ('IGCSE', 'AS', 'A_LEVEL')),
    homeroom TEXT,
    status TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('planned', 'active', 'completed', 'withdrawn')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, academic_year_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS official_sources (
    id TEXT PRIMARY KEY,
    publisher TEXT NOT NULL,
    source_type TEXT NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    published_on TEXT,
    checked_at TEXT NOT NULL,
    content_hash TEXT,
    access_level TEXT NOT NULL DEFAULT 'public'
      CHECK (access_level IN ('public', 'centre_only')),
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'verified', 'superseded', 'withdrawn')),
    verified_by TEXT,
    supersedes_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (url, title),
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (supersedes_id) REFERENCES official_sources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS curriculum_specs (
    id TEXT PRIMARY KEY,
    board TEXT NOT NULL,
    qualification_level TEXT NOT NULL
      CHECK (qualification_level IN ('IG', 'INTERNATIONAL_GCSE', 'IAS', 'AS', 'IAL', 'A_LEVEL')),
    subject_code TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    school_display_name TEXT,
    version_label TEXT NOT NULL DEFAULT '待核对',
    valid_exam_from TEXT,
    valid_exam_to TEXT,
    grading_scale TEXT,
    assessment_model TEXT
      CHECK (assessment_model IN ('linear', 'modular', 'staged', 'subject_specific')),
    source_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'active', 'expired')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (board, qualification_level, subject_code, version_label),
    FOREIGN KEY (source_id) REFERENCES official_sources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS curriculum_components (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL,
    component_code TEXT NOT NULL,
    component_name TEXT NOT NULL,
    route_code TEXT NOT NULL DEFAULT '',
    required_kind TEXT NOT NULL DEFAULT 'required'
      CHECK (required_kind IN ('required', 'choice', 'conditional')),
    weight REAL,
    max_raw REAL,
    max_ums REAL,
    source_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (spec_id, component_code, route_code),
    FOREIGN KEY (spec_id) REFERENCES curriculum_specs(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES official_sources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS course_offerings (
    id TEXT PRIMARY KEY,
    academic_year_id TEXT NOT NULL,
    curriculum_spec_id TEXT,
    legacy_course_id TEXT,
    name TEXT NOT NULL,
    school_grade INTEGER NOT NULL CHECK (school_grade BETWEEN 9 AND 12),
    qualification_stage TEXT NOT NULL
      CHECK (qualification_stage IN ('IGCSE', 'AS', 'A_LEVEL')),
    term TEXT NOT NULL DEFAULT 'full_year',
    course_kind TEXT NOT NULL DEFAULT 'elective'
      CHECK (course_kind IN ('required', 'elective')),
    weekly_periods INTEGER NOT NULL DEFAULT 4 CHECK (weekly_periods BETWEEN 1 AND 20),
    max_students INTEGER NOT NULL DEFAULT 30 CHECK (max_students > 0),
    request_open_at TEXT,
    request_close_at TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'open', 'closed', 'archived')),
    prerequisites TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
    FOREIGN KEY (curriculum_spec_id) REFERENCES curriculum_specs(id) ON DELETE SET NULL,
    FOREIGN KEY (legacy_course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS teaching_groups (
    id TEXT PRIMARY KEY,
    offering_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 30 CHECK (capacity > 0),
    weekly_periods INTEGER NOT NULL DEFAULT 4 CHECK (weekly_periods BETWEEN 1 AND 20),
    consecutive_periods INTEGER NOT NULL DEFAULT 1 CHECK (consecutive_periods BETWEEN 1 AND 4),
    home_room_id TEXT,
    status TEXT NOT NULL DEFAULT 'planning'
      CHECK (status IN ('planning', 'active', 'archived')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (offering_id, code),
    FOREIGN KEY (offering_id) REFERENCES course_offerings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teaching_group_teachers (
    teaching_group_id TEXT NOT NULL,
    teacher_user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'lead' CHECK (role IN ('lead', 'co_teacher')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (teaching_group_id, teacher_user_id),
    FOREIGN KEY (teaching_group_id) REFERENCES teaching_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS teaching_group_students (
    teaching_group_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    source_request_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (teaching_group_id, student_id),
    FOREIGN KEY (teaching_group_id) REFERENCES teaching_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_requests (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    academic_year_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'submitted', 'teacher_review', 'school_review', 'approved', 'returned', 'withdrawn')),
    submitted_at TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (student_id, academic_year_id),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS course_request_choices (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    offering_id TEXT NOT NULL,
    preference INTEGER NOT NULL DEFAULT 1 CHECK (preference BETWEEN 1 AND 9),
    choice_group TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'requested'
      CHECK (status IN ('requested', 'approved', 'waitlisted', 'rejected')),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (request_id, offering_id),
    FOREIGN KEY (request_id) REFERENCES course_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (offering_id) REFERENCES course_offerings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 30 CHECK (capacity > 0),
    room_type TEXT NOT NULL DEFAULT 'classroom',
    campus TEXT,
    features TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS time_slots (
    id TEXT PRIMARY KEY,
    academic_year_id TEXT NOT NULL,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    period_no INTEGER NOT NULL CHECK (period_no BETWEEN 1 AND 20),
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    label TEXT NOT NULL,
    is_teaching INTEGER NOT NULL DEFAULT 1 CHECK (is_teaching IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (academic_year_id, weekday, period_no),
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teacher_availability (
    id TEXT PRIMARY KEY,
    teacher_user_id TEXT NOT NULL,
    time_slot_id TEXT NOT NULL,
    availability TEXT NOT NULL DEFAULT 'available'
      CHECK (availability IN ('available', 'preferred', 'unavailable')),
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (teacher_user_id, time_slot_id),
    FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS schedule_versions (
    id TEXT PRIMARY KEY,
    academic_year_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'validated', 'published', 'archived')),
    based_on_id TEXT,
    created_by TEXT NOT NULL,
    published_by TEXT,
    published_at TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT,
    FOREIGN KEY (based_on_id) REFERENCES schedule_versions(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS scheduled_lessons (
    id TEXT PRIMARY KEY,
    schedule_version_id TEXT NOT NULL,
    teaching_group_id TEXT NOT NULL,
    time_slot_id TEXT NOT NULL,
    room_id TEXT,
    teacher_user_id TEXT NOT NULL,
    is_locked INTEGER NOT NULL DEFAULT 0 CHECK (is_locked IN (0, 1)),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'generated')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (schedule_version_id, teaching_group_id, time_slot_id),
    UNIQUE (schedule_version_id, teacher_user_id, time_slot_id),
    UNIQUE (schedule_version_id, room_id, time_slot_id),
    FOREIGN KEY (schedule_version_id) REFERENCES schedule_versions(id) ON DELETE CASCADE,
    FOREIGN KEY (teaching_group_id) REFERENCES teaching_groups(id) ON DELETE CASCADE,
    FOREIGN KEY (time_slot_id) REFERENCES time_slots(id) ON DELETE RESTRICT,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    FOREIGN KEY (teacher_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    request_id TEXT,
    outcome TEXT NOT NULL DEFAULT 'success' CHECK (outcome IN ('success', 'denied', 'failed')),
    before_json TEXT,
    after_json TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_student_academic_year ON student_academic_records(academic_year_id, school_grade);
CREATE INDEX IF NOT EXISTS idx_official_sources_status ON official_sources(status, publisher);
CREATE INDEX IF NOT EXISTS idx_curriculum_specs_lookup ON curriculum_specs(board, qualification_level, status);
CREATE INDEX IF NOT EXISTS idx_offerings_year_grade ON course_offerings(academic_year_id, school_grade, status);
CREATE INDEX IF NOT EXISTS idx_teaching_groups_offering ON teaching_groups(offering_id);
CREATE INDEX IF NOT EXISTS idx_group_students_student ON teaching_group_students(student_id);
CREATE INDEX IF NOT EXISTS idx_course_requests_review ON course_requests(academic_year_id, status);
CREATE INDEX IF NOT EXISTS idx_request_choices_offering ON course_request_choices(offering_id, status);
CREATE INDEX IF NOT EXISTS idx_schedule_versions_year ON schedule_versions(academic_year_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_version_slot ON scheduled_lessons(schedule_version_id, time_slot_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_user_id, created_at);

INSERT OR IGNORE INTO academic_years (id, name, starts_on, ends_on, status)
VALUES ('ay-2026-2027', '2026–2027', '2026-08-01', '2027-07-31', 'active');

INSERT OR IGNORE INTO official_sources
  (id, publisher, source_type, title, url, checked_at, access_level, status, notes)
VALUES
  ('source-cambridge-programmes', 'Cambridge International', 'qualification_page', 'Cambridge programmes and qualifications', 'https://www.cambridgeinternational.org/programmes-and-qualifications/', '2026-08-30T00:00:00Z', 'public', 'verified', '阶段年龄为通常范围，不作为校内硬限制'),
  ('source-cambridge-igcse', 'Cambridge International', 'qualification_page', 'Cambridge IGCSE qualification', 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-upper-secondary/cambridge-igcse/qualification/', '2026-08-30T00:00:00Z', 'public', 'verified', 'IGCSE 评估、评分与考试系列总览'),
  ('source-cambridge-as-a', 'Cambridge International', 'qualification_page', 'Cambridge International AS & A Level qualification', 'https://www.cambridgeinternational.org/programmes-and-qualifications/cambridge-advanced/cambridge-international-as-and-a-levels/qualification/', '2026-08-30T00:00:00Z', 'public', 'verified', 'AS/A Level 路径与评分总览'),
  ('source-cambridge-timetables', 'Cambridge International', 'timetable', 'Cambridge exam timetables', 'https://www.cambridgeinternational.org/exam-administration/cambridge-exams-officers-guide/phase-1-preparation/timetabling-exams/exam-timetables/', '2026-08-30T00:00:00Z', 'public', 'verified', '必须结合本中心 administrative zone'),
  ('source-pearson-igcse', 'Pearson Edexcel', 'qualification_page', 'Pearson Edexcel International GCSEs', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-gcses/about-international-gcses.html', '2026-08-30T00:00:00Z', 'public', 'verified', 'International GCSE 定位及线性/模块化说明'),
  ('source-pearson-ial', 'Pearson Edexcel', 'qualification_page', 'Pearson International Advanced Levels', 'https://qualifications.pearson.com/en/qualifications/edexcel-international-advanced-levels/about.html', '2026-08-30T00:00:00Z', 'public', 'verified', 'IAL 模块化与 IAS/IAL 路径总览'),
  ('source-pearson-timetables', 'Pearson Edexcel', 'timetable', 'Pearson exam timetables', 'https://qualifications.pearson.com/en/support/support-topics/exams/exam-timetables.html', '2026-08-30T00:00:00Z', 'public', 'verified', '系列与科目可用性须按当年文件复核');
