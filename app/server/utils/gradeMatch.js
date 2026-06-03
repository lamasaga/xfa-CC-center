/**
 * 入学年份 / 年级展示：同一字段两种展示（如 2024 与「2024级」）时的匹配工具
 */

function extractYear(s) {
  if (s == null || s === '') return null;
  const t = String(s).trim();
  const m4 = t.match(/(20\d{2})/);
  if (m4) return m4[1];
  const m2 = t.match(/^(\d{2})级$/);
  if (m2) {
    const yy = parseInt(m2[1], 10);
    return String(2000 + yy);
  }
  return null;
}

/** 统一为「YYYY级」入库；支持前端传 24级 → 2024级 */
function normalizeGradeToCanonical(grade) {
  if (grade == null || grade === '') return null;
  const t = String(grade).trim();
  const y = extractYear(t);
  if (!y) return t;
  return `${y}级`;
}

/** 课程 grade_level 是否对某学生可见：ALL / 空 或 年份与学生一致 */
function courseVisibleForStudent(courseGradeLevel, studentGradeOrEnrollment) {
  const gl = (courseGradeLevel == null ? 'ALL' : String(courseGradeLevel)).trim();
  if (!gl || gl.toUpperCase() === 'ALL') return true;
  const cy = extractYear(gl);
  const sy =
    extractYear(studentGradeOrEnrollment) ||
    (typeof studentGradeOrEnrollment === 'number'
      ? String(studentGradeOrEnrollment)
      : extractYear(String(studentGradeOrEnrollment)));
  if (cy && sy) return cy === sy;
  return gl === String(studentGradeOrEnrollment).trim();
}

/** 学生所属届别：优先 enrollment_year（库内主数据），否则从 grade 文案解析 */
function studentCanonicalYear(student) {
  const ey = student.enrollment_year;
  if (ey != null && ey !== '' && Number.isFinite(Number(ey))) {
    return String(Number(ey));
  }
  return extractYear(student.grade || '') || null;
}

/** 列表筛选：按单一届别年份匹配，避免 enrollment_year 与 grade 不一致时出现“同一人出现在两个年级” */
function studentMatchesGradeFilter(student, gradeQuery) {
  if (!gradeQuery) return true;
  const qTrim = String(gradeQuery).trim();
  const qy = extractYear(gradeQuery);
  if (qy) {
    const sy = studentCanonicalYear(student);
    if (sy) return sy === qy;
  }
  return String(student.grade || '').trim() === qTrim;
}

/** 预毕业月份：入学 9 月，2 年制 → 第二学年 6 月；3 年制 → 第三学年 6 月 */
function computeExpectedGraduationMonth(enrollmentYear, studyDurationYears) {
  const y = Number(enrollmentYear);
  const d = Number(studyDurationYears) || 2;
  if (!Number.isFinite(y) || y < 1990) return null;
  const gradYear = y + d;
  return `${gradYear}-06`;
}

module.exports = {
  extractYear,
  normalizeGradeToCanonical,
  courseVisibleForStudent,
  studentCanonicalYear,
  studentMatchesGradeFilter,
  computeExpectedGraduationMonth,
};
