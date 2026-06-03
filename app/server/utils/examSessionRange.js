/** 考季月份标签（Edexcel 典型 1 / 6 / 10 月） */
const MONTH_LABELS = { 1: '1月', 6: '6月', 10: '10月' };

const STANDARD_EXAM_MONTHS = [1, 6, 10];

function getExamSessionEndYear(enrollmentYear, studyDuration) {
  const ey = Number(enrollmentYear);
  const sd = Number(studyDuration) || 2;
  return ey + sd;
}

/**
 * 学生可用考季是否在学制窗口内。
 * - 9 月入学后，入学年 10 月为首考季（已学内容提前报考）
 * - 此后每年 1 / 6 / 10 月；末年仅至 6 月
 */
function isExamSessionInStudentRange(session, enrollmentYear, studyDuration) {
  const ey = Number(enrollmentYear);
  const sd = Number(studyDuration) || 2;
  const endYear = getExamSessionEndYear(ey, sd);
  const year = Number(session.year);
  const month = Number(session.month);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return false;
  if (year < ey) return false;
  if (year === ey && month !== 10) return false;
  if (year > endYear) return false;
  if (year === endYear && month > 6) return false;
  return true;
}

function sortExamSessions(a, b) {
  return a.year === b.year ? a.month - b.month : a.year - b.year;
}

function filterSessionsForStudent(sessions, enrollmentYear, studyDuration) {
  return sessions
    .filter((s) => isExamSessionInStudentRange(s, enrollmentYear, studyDuration))
    .sort(sortExamSessions);
}

async function ensureExamSessionsForStudent(
  enrollmentYear,
  studyDuration,
  boardName,
  dbAsync,
  uuidv4
) {
  const ey = Number(enrollmentYear);
  const sd = Number(studyDuration) || 2;
  const endYear = getExamSessionEndYear(ey, sd);
  const board = boardName || 'Edexcel';

  const slots = [{ year: ey, month: 10 }];
  for (let y = ey + 1; y <= endYear; y++) {
    for (const m of STANDARD_EXAM_MONTHS) {
      if (y === endYear && m > 6) continue;
      slots.push({ year: y, month: m });
    }
  }

  for (const { year, month } of slots) {
    const existing = await dbAsync.query(
      'SELECT id FROM exam_sessions WHERE year = ? AND month = ? AND board = ?',
      [year, month, board]
    );
    if (existing.length > 0) continue;

    await dbAsync.create('exam_sessions', {
      id: uuidv4(),
      year,
      month,
      label: `${year}年${MONTH_LABELS[month]}`,
      board,
    });
  }
}

module.exports = {
  MONTH_LABELS,
  STANDARD_EXAM_MONTHS,
  getExamSessionEndYear,
  isExamSessionInStudentRange,
  filterSessionsForStudent,
  ensureExamSessionsForStudent,
  sortExamSessions,
};
