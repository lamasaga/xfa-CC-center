const { dbAsync } = require('../db');

function slugPart(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/** 入学年份 → 两位届别后缀，如 2024 → 24 */
function enrollmentSuffix(enrollmentYear) {
  const y = parseInt(String(enrollmentYear), 10);
  if (!Number.isFinite(y)) return '00';
  return String(y).slice(-2);
}

const STUDENT_USERNAME_PREFIX = 'xfa';

/**
 * 教务规则：xfa + 英文(小写无空格) + 届别两位；整段不含空格。
 */
function buildStudentUsername({ english_name, enrollment_year }) {
  const en = slugPart(english_name);
  const suf = enrollmentSuffix(enrollment_year);
  if (!en) throw new Error('英文姓名为空，无法生成登录账号');
  return `${STUDENT_USERNAME_PREFIX}${en}${suf}`;
}

async function ensureUniqueUsername(base) {
  let candidate = base;
  let n = 0;
  // eslint-disable-next-line no-await-in-loop
  while (await dbAsync.findOne('users', { username: candidate })) {
    n += 1;
    candidate = `${base}${n}`;
    if (n > 200) throw new Error('无法生成唯一用户名，请缩短姓名后重试');
  }
  return candidate;
}

module.exports = {
  slugPart,
  enrollmentSuffix,
  buildStudentUsername,
  ensureUniqueUsername,
};
