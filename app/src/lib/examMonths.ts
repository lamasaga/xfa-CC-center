/** 标准 Edexcel 考季月份（1 / 5 / 10 月） */
export const STANDARD_EXAM_MONTHS = [1, 5, 10] as const;

/** 历史数据中的 6 月考季统一视为 5 月 */
export function normalizeExamMonth(month: number): number {
  return month === 6 ? 5 : month;
}

export function formatExamMonthLabel(month: number): string {
  const m = normalizeExamMonth(month);
  if (m === 1) return '1月';
  if (m === 5) return '5月';
  if (m === 10) return '10月';
  return `${m}月`;
}

export const STANDARD_EXAM_MONTHS_LABEL =
  STANDARD_EXAM_MONTHS.map(formatExamMonthLabel).join(' / ');

/** 单元限制月份与目标考季月份是否匹配（兼容旧数据中的 6） */
const VALID_MONTHS: readonly number[] = STANDARD_EXAM_MONTHS;

function isStandardExamMonth(m: number): boolean {
  return VALID_MONTHS.includes(m);
}

export function unitAllowsExamMonth(
  allowedMonths: number[] | null | undefined,
  sessionMonth: number
): boolean {
  if (!allowedMonths?.length) return true;
  const sm = normalizeExamMonth(sessionMonth);
  return allowedMonths.map(normalizeExamMonth).some((m) => isStandardExamMonth(m) && m === sm);
}

export function normalizeAllowedMonthsForForm(months?: number[] | null): number[] {
  if (!months?.length) return [];
  return [...new Set(months.map(normalizeExamMonth).filter(isStandardExamMonth))];
}
