export type LangRow = {
  id?: string;
  type: string;
  overall: number;
  bestScore: boolean;
  testDate?: string;
};

export type MatchPrefs = {
  language_score_id?: string;
  standardized_test_id?: string;
} | null;

/** 同一考试类型下取「最佳」：优先标记 best；若无 best，则取最新一次考试 */
export function pickBestLanguageForType(scores: LangRow[], testType: string): LangRow | undefined {
  const pool = scores.filter((s) => s.type === testType);
  if (pool.length === 0) return undefined;
  const marked = pool.filter((s) => s.bestScore);
  const pickLatest = (arr: LangRow[]) => {
    const ts = (d?: string) => {
      const t = d ? new Date(d).getTime() : NaN;
      return Number.isFinite(t) ? t : -Infinity;
    };
    return arr.reduce((a, b) => (ts(a.testDate) >= ts(b.testDate) ? a : b));
  };
  if (marked.length > 0) return pickLatest(marked);
  return pickLatest(pool);
}

export function pickBestStandardizedForType(
  scores: Array<{ id?: string; type: string; score: number; bestScore: boolean }>,
  testType: string
) {
  const pool = scores.filter((s) => s.type === testType);
  if (pool.length === 0) return undefined;
  const marked = pool.filter((s) => s.bestScore);
  if (marked.length === 1) return marked[0];
  return pool.reduce((a, b) => (a.score >= b.score ? a : b));
}

export function resolveLanguageForMatch(
  scores: LangRow[],
  testType: string,
  prefs: MatchPrefs
): LangRow | undefined {
  if (prefs?.language_score_id) {
    const hit = scores.find((s) => s.id === prefs.language_score_id);
    if (hit && hit.type === testType) return hit;
  }
  return pickBestLanguageForType(scores, testType);
}

export type StdRow = { id?: string; type: string; score: number; bestScore: boolean };

export function resolveStandardizedForMatch(
  scores: StdRow[],
  testType: string,
  prefs: MatchPrefs
): StdRow | undefined {
  if (prefs?.standardized_test_id) {
    const hit = scores.find((s) => s.id === prefs.standardized_test_id);
    if (hit && hit.type === testType) return hit;
  }
  return pickBestStandardizedForType(scores, testType);
}
