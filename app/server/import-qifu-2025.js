/**
 * 将「启赋一班学生成绩与申请信息汇总.md」中的 2025 级学生数据导入 SQLite。
 *
 * 设计目标：
 * - 仅增量写入：不删除、不覆盖已有数据
 * - 可重复执行：通过存在性检查尽量避免重复插入
 * - 尽量不“补齐”缺失数据：缺失即跳过或留空
 *
 * 注意：
 * - 校内成绩表存在小数（如 94.1），而 unit_grades.score/max_score 为整数。
 *   为保留 1 位小数精度：校内成绩使用「score = 分数×10, max_score=1000」存储。
 */
const path = require('path');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');

const DB_PATH = process.env.SQLITE_PATH || path.join(__dirname, '../database.sqlite');
const NOW = new Date().toISOString();

// 统一年级：文档为“2025级”，SQLite 里 students.grade 也是类似格式
const GRADE = '2025级';
const DEFAULT_ADVISOR_ID = '1691b97d-cbd7-47ca-945b-1004c9c9de3d'; // 现库中已有「王顾问」

/**
 * 学科映射：将文档字段映射到课程名称与单元成绩写入策略
 */
const SUBJECTS = {
  Chinese: { courseName: 'Chinese', subjectCode: 'CHI', board: 'School' },
  Math: { courseName: 'Mathematics', subjectCode: 'MATH', board: 'Edexcel' },
  Physics: { courseName: 'Physics', subjectCode: 'PHYS', board: 'Edexcel' },
  Chemistry: { courseName: 'Chemistry', subjectCode: 'CHEM', board: 'Edexcel' },
  Biology: { courseName: 'Biology', subjectCode: 'BIOL', board: 'Edexcel' },
  AI: { courseName: 'AI', subjectCode: 'AI', board: 'School' },
  IT: { courseName: 'IT', subjectCode: 'IT', board: 'School' },
  English: { courseName: 'English', subjectCode: 'ENG', board: 'School' },
  Economics: { courseName: 'Economics', subjectCode: 'ECON', board: 'Edexcel' },
  Psychology: { courseName: 'Psychology', subjectCode: 'PSY', board: 'Edexcel' },
};

/**
 * 从 Markdown 提取的结构化数据（缺失项已省略）。
 * - internalScores: { subjectKey: { mid?: number, final?: number } }
 * - ialUnits: { subjectKey: Array<{unit_code, unit_name, score, max_score, grade, exam_type, exam_date}> }
 */
const STUDENTS = [
  {
    name: '马逸轩',
    internalScores: {
      Math: { mid: 88.0, final: 94.1 },
      Physics: { mid: 79.2, final: 87.7 },
      Chemistry: { mid: 81.3 },
      AI: { mid: 90.0, final: 94.7 },
      IT: { mid: 92.4, final: 93.5 },
      English: { mid: 82.6, final: 93.6 },
    },
    ialUnits: {
      Math: [
        { unit_code: 'P1', unit_name: 'P1', score: 91, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P2', unit_name: 'P2', score: 97, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P3', unit_name: 'P3', score: 83, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P4', unit_name: 'P4', score: 59, max_score: 100, grade: 'D', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'M1', unit_name: 'M1', score: 87, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
      ],
      Physics: [{ unit_code: 'U1', unit_name: 'U1', score: 98, max_score: 120, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' }],
      Chemistry: [{ unit_code: 'U1', unit_name: 'U1', score: 95, max_score: 120, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '林修竹',
    internalScores: {
      Math: { mid: 88.7, final: 94.6 },
      Physics: { mid: 80.8, final: 80.5 },
      AI: { mid: 93.7, final: 98.8 },
      IT: { mid: 95.2, final: 92.8 },
      English: { mid: 92.4, final: 98.0 },
      Economics: { mid: 95.2, final: 95.0 },
    },
    ialUnits: {
      Math: [
        { unit_code: 'P1', unit_name: 'P1', score: 98, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P2', unit_name: 'P2', score: 94, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P3', unit_name: 'P3', score: 79, max_score: 100, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P4', unit_name: 'P4', score: 39, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'M1', unit_name: 'M1', score: 36, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' },
      ],
      Physics: [{ unit_code: 'U1', unit_name: 'U1', score: 98, max_score: 120, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' }],
      Economics: [{ unit_code: 'U1', unit_name: 'U1', score: 75, max_score: 100, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '谢沂辰',
    internalScores: {
      Math: { mid: 85.3, final: 86.8 },
      Physics: { mid: 49.6, final: 70.4 },
      AI: { mid: 63.1, final: 65.0 },
      English: { mid: 80.6, final: 91.8 },
      Economics: { mid: 77.6, final: 77.8 },
    },
    ialUnits: {
      Math: [
        { unit_code: 'P1', unit_name: 'P1', score: 95, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P2', unit_name: 'P2', score: 99, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P3', unit_name: 'P3', score: 87, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P4', unit_name: 'P4', score: 56, max_score: 100, grade: 'D', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'M1', unit_name: 'M1', score: 36, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' },
      ],
      Physics: [{ unit_code: 'U1', unit_name: 'U1', score: 78, max_score: 120, grade: 'C', exam_type: 'final', exam_date: '2026-01-01' }],
      Economics: [{ unit_code: 'U1', unit_name: 'U1', score: 20, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '王希乐',
    internalScores: {
      Math: { mid: 88.9, final: 95.7 },
      Physics: { mid: 63.0, final: 78.0 },
      Chemistry: { mid: 77.6 },
      AI: { mid: 70.6, final: 74.4 },
      IT: { mid: 72.3, final: 73.0 },
      English: { mid: 91.0, final: 95.2 },
    },
    ialUnits: {
      Math: [
        { unit_code: 'P1', unit_name: 'P1', score: 99, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P2', unit_name: 'P2', score: 96, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P3', unit_name: 'P3', score: 100, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P4', unit_name: 'P4', score: 80, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'M1', unit_name: 'M1', score: 90, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
      ],
      Physics: [{ unit_code: 'U1', unit_name: 'U1', score: 98, max_score: 120, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' }],
      Chemistry: [{ unit_code: 'U1', unit_name: 'U1', score: 68, max_score: 120, grade: 'D', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '赵天一',
    internalScores: {
      Math: { mid: 80.3, final: 85.5 },
      Physics: { mid: 72.2, final: 82.3 },
      Chemistry: { mid: 73.5 },
      AI: { mid: 84.2 },
      English: { mid: 88.6, final: 92.6 },
      Economics: { mid: 87.2, final: 91.0 },
      Biology: { mid: 70.4, final: 69.0 },
    },
    ialUnits: {
      Math: [
        { unit_code: 'P1', unit_name: 'P1', score: 83, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P2', unit_name: 'P2', score: 73, max_score: 100, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P3', unit_name: 'P3', score: 43, max_score: 100, grade: 'E', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P4', unit_name: 'P4', score: 39, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'M1', unit_name: 'M1', score: 55, max_score: 100, grade: 'D', exam_type: 'final', exam_date: '2026-01-01' },
      ],
      Physics: [{ unit_code: 'U1', unit_name: 'U1', score: 89, max_score: 120, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' }],
      Chemistry: [{ unit_code: 'U1', unit_name: 'U1', score: 66, max_score: 120, grade: 'D', exam_type: 'final', exam_date: '2026-01-01' }],
      Biology: [{ unit_code: 'U1', unit_name: 'U1', score: 56, max_score: 120, grade: 'E', exam_type: 'final', exam_date: '2026-01-01' }],
      Economics: [{ unit_code: 'U1', unit_name: 'U1', score: 82, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '范凡',
    internalScores: {
      Chinese: { mid: 99.0, final: 95.0 },
      Math: { mid: 96.7, final: 91.9 },
      AI: { mid: 95.5, final: 96.2 },
      English: { mid: 79.8, final: 90.0 },
      Economics: { mid: 95.6, final: 93.0 },
      Psychology: { mid: 92.0, final: 92.9 },
    },
    ialUnits: {
      Math: [{ unit_code: 'P1', unit_name: 'P1', score: 91, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' }],
      Economics: [{ unit_code: 'U1', unit_name: 'U1', score: 73, max_score: 100, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '黄泽善',
    internalScores: {
      Math: { mid: 84.0, final: 87.5 },
      Physics: { mid: 66.6, final: 70.1 },
      AI: { mid: 79.2, final: 85.0 },
      English: { mid: 93.4, final: 95.6 },
      Biology: { mid: 80.4, final: 84.2 },
    },
    ialUnits: {
      Math: [
        { unit_code: 'P1', unit_name: 'P1', score: 66, max_score: 100, grade: 'C', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P2', unit_name: 'P2', score: 77, max_score: 100, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P3', unit_name: 'P3', score: 29, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'P4', unit_name: 'P4', score: 21, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' },
        { unit_code: 'M1', unit_name: 'M1', score: 31, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' },
      ],
      Physics: [{ unit_code: 'U1', unit_name: 'U1', score: 99, max_score: 120, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' }],
      Biology: [{ unit_code: 'U1', unit_name: 'U1', score: 72, max_score: 120, grade: 'C', exam_type: 'final', exam_date: '2026-01-01' }],
      Economics: [{ unit_code: 'U1', unit_name: 'U1', score: 73, max_score: 100, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '李晟铂',
    internalScores: {
      Math: { mid: 75.7, final: 74.8 },
      AI: { mid: 60.0, final: 67.7 },
      IT: { mid: 61.0, final: 70.2 },
      English: { mid: 99.0, final: 81.6 },
      Economics: { mid: 65.4, final: 79.0 },
      Psychology: { mid: 68.0, final: 68.5 },
    },
    ialUnits: { Math: [{ unit_code: 'P1', unit_name: 'P1', score: 50, max_score: 100, grade: 'D', exam_type: 'final', exam_date: '2026-01-01' }] },
  },
  {
    name: '吴炜洁',
    internalScores: {
      Chinese: { mid: 85.0, final: 90.0 },
      Math: { mid: 71.7, final: 73.5 },
      AI: { mid: 64.2, final: 66.8 },
      English: { mid: 75.6, final: 84.8 },
      Economics: { mid: 70.4, final: 76.0 },
      Psychology: { mid: 72.0, final: 72.6 },
    },
    ialUnits: { Math: [{ unit_code: 'P1', unit_name: 'P1', score: 27, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' }] },
  },
  {
    name: '曲畅',
    internalScores: {
      Math: { mid: 73.0, final: 81.4 },
      Physics: { mid: 55.0, final: 52.1 },
      AI: { mid: 77.8, final: 86.3 },
      English: { mid: 75.0, final: 88.4 },
      Economics: { mid: 81.6, final: 88.0 },
      Psychology: { mid: 88.0, final: 89.8 },
    },
    ialUnits: {
      Math: [{ unit_code: 'P1', unit_name: 'P1', score: 70, max_score: 100, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' }],
      Physics: [{ unit_code: 'U1', unit_name: 'U1', score: 32, max_score: 120, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' }],
      Economics: [{ unit_code: 'U1', unit_name: 'U1', score: 78, max_score: 100, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '龙镜如',
    internalScores: {
      Chinese: { mid: 78.0, final: 88.0 },
      Math: { mid: 71.1, final: 72.0 },
      AI: { mid: 61.5, final: 62.8 },
      English: { mid: 63.6, final: 68.8 },
      Economics: { mid: 70.4, final: 73.0 },
      Psychology: { mid: 57.0, final: 57.3 },
    },
    ialUnits: { Math: [{ unit_code: 'P1', unit_name: 'P1', score: 26, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' }] },
  },
  {
    name: '巴图',
    internalScores: {
      Math: { mid: 86.2, final: 85.5 },
      AI: { mid: 81.8, final: 80.8 },
      IT: { mid: 82.2, final: 81.9 },
      English: { mid: 74.8, final: 83.0 },
      Biology: { mid: 61.4, final: 60.0 },
      Psychology: { mid: 70.0, final: 70.0 },
    },
    ialUnits: {
      Math: [{ unit_code: 'P1', unit_name: 'P1', score: 64, max_score: 100, grade: 'C', exam_type: 'final', exam_date: '2026-01-01' }],
      Biology: [{ unit_code: 'U1', unit_name: 'U1', score: 33, max_score: 120, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '朱笑莹',
    internalScores: {
      Math: { mid: 36.9, final: 40.7 },
      AI: { mid: 53.2 },
      English: { mid: 59.6, final: 53.0 },
      Economics: { mid: 64.6, final: 70.0 },
    },
    ialUnits: { Math: [{ unit_code: 'P1', unit_name: 'P1', score: 2, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' }] },
  },
  {
    name: '黄子桐',
    internalScores: {
      Math: { mid: 94.6, final: 97.2 },
      Physics: { mid: 57.8, final: 53.1 },
      AI: { mid: 89.2, final: 89.7 },
      IT: { mid: 87.9, final: 91.5 },
      English: { mid: 87.0, final: 91.2 },
      Economics: { mid: 90.0, final: 91.0 },
      Psychology: { mid: 91.0, final: 92.9 },
    },
    ialUnits: {
      Math: [{ unit_code: 'P1', unit_name: 'P1', score: 84, max_score: 100, grade: 'A', exam_type: 'final', exam_date: '2026-01-01' }],
      Physics: [{ unit_code: 'U1', unit_name: 'U1', score: 58, max_score: 120, grade: 'E', exam_type: 'final', exam_date: '2026-01-01' }],
      Economics: [{ unit_code: 'U1', unit_name: 'U1', score: 73, max_score: 100, grade: 'B', exam_type: 'final', exam_date: '2026-01-01' }],
    },
  },
  {
    name: '杜楚熊',
    internalScores: {
      Chinese: { mid: 77.0, final: 83.0 },
      Math: { mid: 10.9 },
      AI: { mid: 58.0, final: 49.7 },
      IT: { mid: 58.0 },
      English: { mid: 51.4, final: 60.2 },
      Biology: { mid: 30.0 },
      Psychology: { mid: 55.0, final: 54.8 },
    },
    ialUnits: { Math: [{ unit_code: 'P1', unit_name: 'P1', score: 2, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' }] },
  },
  {
    name: '冯粲翔',
    internalScores: {
      Chinese: { mid: 85.0, final: 89.0 },
      Math: { mid: 69.1, final: 72.9 },
      AI: { mid: 56.0, final: 57.2 },
      English: { mid: 60.2, final: 80.8 },
      Economics: { mid: 62.2, final: 69.0 },
      Psychology: { mid: 74.0, final: 74.6 },
    },
    ialUnits: { Math: [{ unit_code: 'P1', unit_name: 'P1', score: 13, max_score: 100, grade: 'U', exam_type: 'final', exam_date: '2026-01-01' }] },
  },
];

function ensureCourse(db, { courseName, subjectCode, board }, gradeLevel) {
  const existing = db
    .prepare('SELECT id FROM courses WHERE name = ? AND grade_level = ? LIMIT 1')
    .get(courseName, gradeLevel);
  if (existing?.id) return existing.id;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO courses (id, name, subject_code, board, grade_level, teacher_id, academic_year, semester, max_students, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    courseName,
    subjectCode || '',
    board || 'Edexcel',
    gradeLevel,
    null,
    new Date().getFullYear().toString(),
    'Fall',
    60,
    '',
    NOW
  );
  return id;
}

function ensureStudent(db, studentName) {
  const existing = db
    .prepare('SELECT id FROM students WHERE name = ? AND grade = ? LIMIT 1')
    .get(studentName, GRADE);
  if (existing?.id) return existing.id;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO students
     (id, name, english_name, grade, school, enrollment_year, study_duration, advisor_id,
      phone, email, wechat, parent_name, parent_phone, parent_email, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    studentName,
    '',
    GRADE,
    '',
    null,
    2,
    DEFAULT_ADVISOR_ID,
    '',
    '',
    '',
    '',
    '',
    '',
    'active',
    NOW,
    NOW
  );
  return id;
}

function ensureEnrollment(db, studentId, courseId) {
  const existing = db
    .prepare('SELECT id FROM student_courses WHERE student_id = ? AND course_id = ? LIMIT 1')
    .get(studentId, courseId);
  if (existing?.id) return existing.id;

  const id = randomUUID();
  db.prepare(
    `INSERT INTO student_courses
     (id, student_id, course_id, internal_grade, internal_score, mock_grade, mock_score, final_grade, final_score, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, studentId, courseId, '', null, '', null, '', null, 'enrolled', NOW, NOW);
  return id;
}

function hasUnitGrade(db, studentCourseId, unitCode, examType, score, maxScore) {
  const row = db
    .prepare(
      `SELECT id FROM unit_grades
       WHERE student_course_id = ?
         AND (unit_code = ? OR unit_name = ?)
         AND exam_type = ?
         AND score = ?
         AND max_score = ?
       LIMIT 1`
    )
    .get(studentCourseId, unitCode, unitCode, examType, score, maxScore);
  return !!row?.id;
}

function insertUnitGrade(db, studentCourseId, u) {
  if (hasUnitGrade(db, studentCourseId, u.unit_code || u.unit_name, u.exam_type, u.score, u.max_score)) return false;

  db.prepare(
    `INSERT INTO unit_grades
     (id, student_course_id, unit_name, unit_code, score, max_score, grade, exam_date, exam_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    studentCourseId,
    u.unit_name || '',
    u.unit_code || '',
    u.score,
    u.max_score,
    u.grade || '',
    u.exam_date || null,
    u.exam_type || 'internal',
    NOW
  );
  return true;
}

function toInternalUnit(score, which) {
  // 用 1000 作为满分，保留 1 位小数精度
  return {
    unit_code: which === 'mid' ? 'Mid' : 'Final',
    unit_name: which === 'mid' ? '校内期中' : '校内期末',
    score: Math.round(score * 10),
    max_score: 1000,
    grade: '',
    exam_date: null,
    exam_type: 'internal',
  };
}

function run() {
  const db = new Database(DB_PATH);
  db.pragma('foreign_keys = ON');

  const tx = db.transaction(() => {
    // 1) 确保课程存在（2025级）
    const courseIds = {};
    for (const [k, meta] of Object.entries(SUBJECTS)) {
      courseIds[k] = ensureCourse(db, meta, GRADE);
    }

    let createdStudents = 0;
    let createdEnrollments = 0;
    let createdUnitGrades = 0;

    // 2) 写入学生、选课、单元成绩
    for (const s of STUDENTS) {
      const studentIdBefore = db.prepare('SELECT id FROM students WHERE name = ? AND grade = ? LIMIT 1').get(s.name, GRADE)?.id;
      const studentId = ensureStudent(db, s.name);
      if (!studentIdBefore) createdStudents += 1;

      // 校内成绩：按学科写 internal unit_grades
      if (s.internalScores) {
        for (const [subjectKey, pair] of Object.entries(s.internalScores)) {
          const courseId = courseIds[subjectKey];
          if (!courseId) continue;
          const beforeEnroll = db.prepare('SELECT id FROM student_courses WHERE student_id = ? AND course_id = ? LIMIT 1').get(studentId, courseId)?.id;
          const studentCourseId = ensureEnrollment(db, studentId, courseId);
          if (!beforeEnroll) createdEnrollments += 1;

          if (pair?.mid !== undefined && pair?.mid !== null) {
            if (insertUnitGrade(db, studentCourseId, toInternalUnit(pair.mid, 'mid'))) createdUnitGrades += 1;
          }
          if (pair?.final !== undefined && pair?.final !== null) {
            if (insertUnitGrade(db, studentCourseId, toInternalUnit(pair.final, 'final'))) createdUnitGrades += 1;
          }
        }
      }

      // A-Level IAL：按学科写 final unit_grades
      if (s.ialUnits) {
        for (const [subjectKey, units] of Object.entries(s.ialUnits)) {
          const courseId = courseIds[subjectKey];
          if (!courseId) continue;
          const beforeEnroll = db.prepare('SELECT id FROM student_courses WHERE student_id = ? AND course_id = ? LIMIT 1').get(studentId, courseId)?.id;
          const studentCourseId = ensureEnrollment(db, studentId, courseId);
          if (!beforeEnroll) createdEnrollments += 1;

          for (const u of units || []) {
            if (!u || u.score === undefined || u.score === null) continue;
            if (insertUnitGrade(db, studentCourseId, u)) createdUnitGrades += 1;
          }
        }
      }
    }

    return { createdStudents, createdEnrollments, createdUnitGrades };
  });

  try {
    const r = tx();
    console.log('✅ 导入完成');
    console.log(`- 新增学生: ${r.createdStudents}`);
    console.log(`- 新增选课: ${r.createdEnrollments}`);
    console.log(`- 新增单元成绩: ${r.createdUnitGrades}`);
  } finally {
    db.close();
  }
}

run();

