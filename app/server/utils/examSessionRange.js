/** 考季月份标签（典型 1 / 5 / 10 月） */
const MONTH_LABELS = { 1: '1月', 5: '5月', 10: '10月' };

const STANDARD_EXAM_MONTHS = [1, 5, 10];

/** 毕业年仅安排至 5 月考季（不含 10 月） */
const END_YEAR_MAX_MONTH = 5;

function normalizeExamMonth(month) {
  const m = Number(month);
  if (m === 6) return 5;
  return m;
}

function normalizeAllowedMonthsList(months) {
  if (!Array.isArray(months)) return [];
  return [...new Set(months.map(normalizeExamMonth).filter((n) => STANDARD_EXAM_MONTHS.includes(n)))];
}

function getExamSessionEndYear(enrollmentYear, studyDuration) {
  const ey = Number(enrollmentYear);
  const sd = Number(studyDuration) || 2;
  return ey + sd;
}

/**
 * 学生可用考季是否在学制窗口内。
 * - 9 月入学后，入学年 10 月为首考季（已学内容提前报考）
 * - 此后每年 1 / 5 / 10 月；末年仅至 5 月
 */
function isExamSessionInStudentRange(session, enrollmentYear, studyDuration) {
  const ey = Number(enrollmentYear);
  const sd = Number(studyDuration) || 2;
  const endYear = getExamSessionEndYear(ey, sd);
  const year = Number(session.year);
  const month = normalizeExamMonth(session.month);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return false;
  if (year < ey) return false;
  if (year === ey && month !== 10) return false;
  if (year > endYear) return false;
  if (year === endYear && month > END_YEAR_MAX_MONTH) return false;
  return true;
}

function sortExamSessions(a, b) {
  return a.year === b.year ? a.month - b.month : a.year - b.year;
}

function normalizeSessionRecord(session) {
  const month = normalizeExamMonth(session.month);
  const label =
    session.label && String(session.label).includes('6月')
      ? String(session.label).replace('6月', '5月')
      : `${session.year}年${MONTH_LABELS[month] || `${month}月`}`;
  return { ...session, month, label };
}

/** 同学年同月（归一化后）仅保留一条，优先保留 month=5 的记录 */
function dedupeSessionsByYearMonth(sessions) {
  const byKey = new Map();
  for (const raw of sessions) {
    const s = normalizeSessionRecord(raw);
    const key = `${s.year}|${s.month}|${s.board || 'Edexcel'}`;
    const existing = byKey.get(key);
    if (!existing || raw.month === 5) {
      byKey.set(key, s);
    }
  }
  return [...byKey.values()];
}

function filterSessionsForStudent(sessions, enrollmentYear, studyDuration) {
  return dedupeSessionsByYearMonth(
    sessions.filter((s) => isExamSessionInStudentRange(s, enrollmentYear, studyDuration))
  ).sort(sortExamSessions);
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
      if (y === endYear && m > END_YEAR_MAX_MONTH) continue;
      slots.push({ year: y, month: m });
    }
  }

  for (const { year, month } of slots) {
    const existing = await dbAsync.query(
      'SELECT id FROM exam_sessions WHERE year = ? AND month = ? AND board = ?',
      [year, month, board]
    );
    if (existing.length > 0) continue;

    try {
      await dbAsync.create('exam_sessions', {
        id: uuidv4(),
        year,
        month,
        label: `${year}年${MONTH_LABELS[month]}`,
        board,
      });
    } catch (error) {
      // 并发生成时另一请求可能刚刚创建同一考季；触发器拒绝重复后视为已完成。
      if (!String(error?.message || '').includes('duplicate exam session')) throw error;
    }
  }
}

module.exports = {
  MONTH_LABELS,
  STANDARD_EXAM_MONTHS,
  END_YEAR_MAX_MONTH,
  normalizeExamMonth,
  normalizeAllowedMonthsList,
  getExamSessionEndYear,
  isExamSessionInStudentRange,
  filterSessionsForStudent,
  ensureExamSessionsForStudent,
  sortExamSessions,
};
