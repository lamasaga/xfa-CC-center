const CANONICAL_COUNTRIES = new Map([
  ['英国', '英国'],
  ['uk', '英国'],
  ['united kingdom', '英国'],
  ['英國', '英国'],
  ['美国', '美国'],
  ['us', '美国'],
  ['usa', '美国'],
  ['united states', '美国'],
  ['加拿大', '加拿大'],
  ['canada', '加拿大'],
  ['澳大利亚', '澳大利亚'],
  ['澳洲', '澳大利亚'],
  ['australia', '澳大利亚'],
  ['中国香港', '中国香港'],
  ['香港', '中国香港'],
  ['hong kong', '中国香港'],
  ['新加坡', '新加坡'],
  ['singapore', '新加坡'],
  ['其他', '其他'],
  ['other', '其他'],
  ['others', '其他'],
]);

const LANGUAGE_HINT = /(ielts|雅思|toefl|托福|pte|duolingo|多邻国|english|英语|语言|score|成绩|要求|官网)/i;

function normalizeCountry(value) {
  const key = String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
  return CANONICAL_COUNTRIES.get(key) || null;
}

function normalizeDate(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return null;
  const normalized = raw.replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function stripFootnoteMarkers(value) {
  return String(value == null ? '' : value)
    .replace(/\[\s*\d+[a-z]?\s*\]/gi, '')
    .replace(/[†‡§※⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 只在返回院校数据时清理明显的脚注和误录学生姓名，不改写数据库原文。
 * 这样可以先阻断隐私泄露，同时为后续人工复核保留原始记录。
 */
function normalizeLanguageRequirement(value, sensitiveNames = []) {
  let text = stripFootnoteMarkers(value);
  const names = [...new Set(sensitiveNames
    .map((name) => String(name || '').trim())
    .filter((name) => name.length >= 2))];
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const pattern = /^[A-Za-z][A-Za-z .'-]*$/.test(name) ? `\\b${escaped}\\b` : escaped;
    text = text.replace(new RegExp(pattern, 'gi'), ' ');
  }
  text = text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // 没有任何语言要求语义的内容通常是误把备注/姓名写进了该字段。
  if (text && !LANGUAGE_HINT.test(text)) return null;
  return text || null;
}

function normalizeUniversityRow(university, sensitiveNames = []) {
  const row = { ...university };
  row.name = String(row.name || '').trim();
  row.country = normalizeCountry(row.country) || '其他';
  row.language_requirement = normalizeLanguageRequirement(row.language_requirement, sensitiveNames);
  row.application_deadline = normalizeDate(row.application_deadline);
  row.course_name = String(row.course_name || '').trim();
  return row;
}

function normalizeProgramRow(program, sensitiveNames = []) {
  const row = { ...program };
  row.program_name = String(row.program_name || '').trim();
  row.language_requirement = normalizeLanguageRequirement(row.language_requirement, sensitiveNames);
  row.application_deadline = normalizeDate(row.application_deadline);
  return row;
}

function dedupePrograms(programs) {
  const byName = new Map();
  const completeness = (program) => [
    program.department,
    program.a_level_requirement,
    program.language_requirement,
    program.subject_requirements,
    program.application_deadline,
    program.tuition_fee,
    program.duration,
  ].filter((value) => value != null && String(value).trim() !== '').length;
  for (const program of programs) {
    const key = String(program.program_name || '').trim().toLocaleLowerCase();
    if (!key) continue;
    const current = byName.get(key);
    if (!current || completeness(program) > completeness(current)) byName.set(key, program);
  }
  return [...byName.values()];
}

module.exports = {
  normalizeCountry,
  normalizeDate,
  normalizeLanguageRequirement,
  normalizeUniversityRow,
  normalizeProgramRow,
  dedupePrograms,
};
