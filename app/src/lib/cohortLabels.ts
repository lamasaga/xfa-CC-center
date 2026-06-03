/**
 * 入学届（届别）：库内统一存「YYYY级」，界面展示「YY级」以节省排版。
 * 最早 2024 入学；可选范围随当前年份向前延伸若干年，满足长期使用。
 */

export const MIN_ENROLLMENT_YEAR = 2024;
/** 相对「当前日历年」额外展示的未来入学届年数（约十多年） */
export const COHORT_FUTURE_YEARS = 14;
/** 顶栏届别条：以当前日历年所在届为锚点，默认同屏展示「锚点届 + 向前 N 届」（含锚点共 N+1 个） */
export const COHORT_NAV_ANCHOR_BACK = 3;
/** 顶栏同屏展示的届别个数 */
export const COHORT_NAV_VISIBLE = COHORT_NAV_ANCHOR_BACK + 1;

export function getMaxEnrollmentYear(): number {
  const y = new Date().getFullYear();
  return y + COHORT_FUTURE_YEARS;
}

/** 库内标准：2024级 */
export function yearToCanonicalGrade(year: number): string {
  return `${year}级`;
}

/** 从 2024级 / 24级 解析入学年份 */
export function parseEnrollmentYearFromGrade(grade: string | null | undefined): number | null {
  if (grade == null || String(grade).trim() === '') return null;
  const t = String(grade).trim();
  const m4 = t.match(/^(20\d{2})级$/);
  if (m4) return parseInt(m4[1], 10);
  const m2 = t.match(/^(\d{2})级$/);
  if (m2) return 2000 + parseInt(m2[1], 10);
  return null;
}

/** 界面展示：24级 */
export function formatCohortDisplay(grade: string | null | undefined): string {
  if (grade == null || String(grade).trim() === '') return '';
  const y = parseEnrollmentYearFromGrade(grade);
  if (y == null) return String(grade);
  return `${String(y).slice(-2)}级`;
}

/** [2024, …, maxYear] */
export function buildEnrollmentYearRange(): number[] {
  const end = Math.max(getMaxEnrollmentYear(), MIN_ENROLLMENT_YEAR);
  const out: number[] = [];
  for (let y = MIN_ENROLLMENT_YEAR; y <= end; y++) out.push(y);
  return out;
}

export function buildCohortSelectOptions(): { value: string; label: string }[] {
  return buildEnrollmentYearRange().map((y) => {
    const canonical = yearToCanonicalGrade(y);
    return { value: canonical, label: formatCohortDisplay(canonical) };
  });
}

/** 合并：固定区间 ∪ 数据库中出现的届别（规范化后） */
export function mergeCanonicalCohortList(gradesFromDb: string[]): string[] {
  const set = new Set<string>();
  for (const y of buildEnrollmentYearRange()) {
    set.add(yearToCanonicalGrade(y));
  }
  for (const g of gradesFromDb) {
    const y = parseEnrollmentYearFromGrade(g);
    if (y != null && y >= MIN_ENROLLMENT_YEAR) {
      set.add(yearToCanonicalGrade(y));
    }
  }
  return [...set].sort(
    (a, b) =>
      (parseEnrollmentYearFromGrade(a) || 0) - (parseEnrollmentYearFromGrade(b) || 0)
  );
}

/** 将 localStorage / 任意文案规范到可选区间内 */
/**
 * 顶栏滑动窗口初始偏移：使窗口右端对齐「当前日历年」对应届（若存在），并尽量包含向前 {@link COHORT_NAV_ANCHOR_BACK} 届。
 */
export function getCohortNavDefaultWindowStart(sortedCanonicalGrades: string[], anchorCalendarYear: number): number {
  if (sortedCanonicalGrades.length === 0) return 0;
  const yAnchor = Math.max(anchorCalendarYear, MIN_ENROLLMENT_YEAR);
  const maxY = getMaxEnrollmentYear();
  const targetYear = Math.min(yAnchor, maxY);
  const idx = sortedCanonicalGrades.findIndex((g) => parseEnrollmentYearFromGrade(g) === targetYear);
  if (idx >= 0) {
    return Math.max(0, idx - COHORT_NAV_ANCHOR_BACK);
  }
  let best = 0;
  let bestDist = Infinity;
  sortedCanonicalGrades.forEach((g, i) => {
    const y = parseEnrollmentYearFromGrade(g);
    if (y == null) return;
    const d = Math.abs(y - targetYear);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return Math.max(0, best - COHORT_NAV_ANCHOR_BACK);
}

export function clampActiveGrade(stored: string | null | undefined): string {
  const y = parseEnrollmentYearFromGrade(stored || '');
  const min = MIN_ENROLLMENT_YEAR;
  const max = getMaxEnrollmentYear();
  if (y == null) return yearToCanonicalGrade(min);
  const c = Math.min(Math.max(y, min), max);
  return yearToCanonicalGrade(c);
}

/** 班级代码（可后续改为配置或接口） */
export const DEFAULT_CLASS_SECTIONS = ['I01', 'I02', 'I03', 'N01', 'N02', 'N03'] as const;

export type ClassTrack = 'international' | 'domestic';

export const CLASS_TRACK_OPTIONS: { value: ClassTrack; label: string }[] = [
  { value: 'international', label: '国际' },
  { value: 'domestic', label: '国内' },
];
