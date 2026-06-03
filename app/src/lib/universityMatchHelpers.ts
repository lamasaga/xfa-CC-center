/**
 * 目标院校硬门槛与匹配分：与 GoalsAndActions 共用，保证仪表盘各处结论一致。
 */
import type { StudentDashboardData } from '@/types/student';
import {
  resolveLanguageForMatch,
  resolveStandardizedForMatch,
  type MatchPrefs,
} from '@/lib/languageScores';

type Uni = StudentDashboardData['targetUniversities'][number];

const gradeMap: Record<string, number> = { 'A*': 95, A: 85, B: 75, C: 65, D: 55 };

export function parseIeltsReq(s: string) {
  const m = (s || '').match(/[\d.]+/);
  return parseFloat(m?.[0] || '6.5');
}

export function extractAlevelGrades(s: string) {
  return (s || '').match(/[A-D][*]?/g) || [];
}

export function pickRelevantSubjects(data: StudentDashboardData, uni: Uni) {
  const reqs = uni.requirements.subjectRequirements || [];
  const joined = (Array.isArray(reqs) ? reqs.join(' ') : String(reqs || '')).toLowerCase();
  const wantsMath = /math|mathematics|数学/.test(joined);
  const wantsFM = /(further\s*math|further\s*mathematics|进阶数学)/.test(joined);
  const wantsPhysics = /physics|物理/.test(joined);
  const wantsChem = /chemistry|化学/.test(joined);
  const wantsBio = /biology|生物/.test(joined);
  const wantsEcon = /economics|经济/.test(joined);

  const picked = data.aLevelSubjects.filter((s) => {
    const n = (s.name || '').toLowerCase();
    if (wantsFM && /further/.test(n)) return true;
    if (wantsMath && /math/.test(n) && !/further/.test(n)) return true;
    if (wantsPhysics && /physics/.test(n)) return true;
    if (wantsChem && /chem/.test(n)) return true;
    if (wantsBio && /bio/.test(n)) return true;
    if (wantsEcon && /econ/.test(n)) return true;
    return false;
  });

  return picked.length > 0 ? picked : data.aLevelSubjects;
}

function stdRows(data: StudentDashboardData) {
  return data.standardizedTests.map((t) => ({
    id: t.id,
    type: t.type,
    score: t.score,
    bestScore: t.bestScore,
  }));
}

function getEduSystem(uni: Uni): 'commonwealth' | 'us' | 'other' {
  const s = (uni as any).eduSystem || (uni as any).edu_system;
  if (s === 'us' || uni.country === 'US') return 'us';
  if (s === 'other') return 'other';
  return 'commonwealth';
}

function getReqStruct(uni: Uni): any {
  return (uni.requirements as any).requirementsStruct || null;
}

function parseRangeMin(s: any): number | null {
  const str = String(s || '').trim();
  if (!str) return null;
  const m = str.match(/(\d{2,4})(\s*-\s*(\d{2,4}))?/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** 硬门槛：语言（IELTS + 匹配偏好）、科目、附加笔试、美国 SAT/ACT */
export function computeUniHardGate(data: StudentDashboardData, uni: Uni) {
  const reasons: string[] = [];
  const prefs: MatchPrefs = uni.matchingPrefs ?? null;

  const system = getEduSystem(uni);
  const reqStruct = getReqStruct(uni);

  if (system === 'us') {
    const us = reqStruct?.us || {};
    const testPolicy = String(us.test_policy || 'Test-Optional');
    const toeflMin = typeof us.toefl_min === 'number' ? us.toefl_min : null;
    if (toeflMin) {
      const bestToefl = resolveLanguageForMatch(data.languageScores, 'TOEFL', prefs);
      if (!bestToefl || bestToefl.overall < toeflMin) reasons.push('TOEFL未达标');
    }

    if (testPolicy === 'Required') {
      const satMin = parseRangeMin(us.sat_range);
      const actMin = parseRangeMin(us.act_range);
      const rows = stdRows(data);
      const satScore = resolveStandardizedForMatch(rows, 'SAT', prefs)?.score;
      const actScore = resolveStandardizedForMatch(rows, 'ACT', prefs)?.score;
      if (satMin && (!satScore || satScore < satMin)) reasons.push('SAT未达标');
      if (actMin && (!actScore || actScore < actMin)) reasons.push('ACT未达标');
      if (!satMin && !actMin && (!satScore && !actScore)) reasons.push('缺少SAT/ACT成绩');
    }
    return { ok: reasons.length === 0, reasons };
  }

  const ieltsReq = parseIeltsReq(uni.requirements.language || '');
  const bestIelts = resolveLanguageForMatch(data.languageScores, 'IELTS', prefs);
  if (!bestIelts || bestIelts.overall < ieltsReq) {
    reasons.push('雅思未达标');
  }

  const reqs = uni.requirements.subjectRequirements || [];
  const joined = (Array.isArray(reqs) ? reqs.join(' ') : String(reqs || '')).toLowerCase();
  const hasMath = data.aLevelSubjects.some(
    (s) => /math/.test((s.name || '').toLowerCase()) && !/further/.test((s.name || '').toLowerCase())
  );
  const hasFM = data.aLevelSubjects.some((s) => /further/.test((s.name || '').toLowerCase()));
  if (/(further\s*math|further\s*mathematics|进阶数学)/.test(joined) && !hasFM) {
    reasons.push('缺少进阶数学（Further Mathematics）');
  }
  if (/(math|mathematics|数学)/.test(joined) && !hasMath) {
    reasons.push('缺少数学（Mathematics）');
  }

  const examNeedles = ['STEP', 'MAT', 'TMUA'];
  const mentioned = examNeedles.filter((k) => joined.includes(k.toLowerCase()));
  if (mentioned.length > 0) {
    const hasAny = data.standardizedTests.some((t) => mentioned.includes(t.type));
    if (!hasAny) reasons.push(`缺少附加考试：${mentioned.join('/')}`);
  }

  return { ok: reasons.length === 0, reasons };
}

function getSubjectAvgScore(s: StudentDashboardData['aLevelSubjects'][number]) {
  if (s.computedFinalScore != null && s.computedFinalScore > 0) return s.computedFinalScore;
  if (s.computedInternalAvg != null && s.computedInternalAvg > 0) return s.computedInternalAvg;
  if (s.finalScore) return s.finalScore;
  if (s.mockScore) return s.mockScore;
  if (s.internalScore) return s.internalScore;
  return 0;
}

/** 匹配分：非美 65% 学术 + 35% 语言；美国院校加入 SAT/ACT 权重 */
export function computeUniMatchScore(data: StudentDashboardData, uni: Uni) {
  const prefs: MatchPrefs = uni.matchingPrefs ?? null;
  const system = getEduSystem(uni);
  const reqStruct = getReqStruct(uni);

  if (system === 'us') {
    const us = reqStruct?.us || {};
    const satMin = parseRangeMin(us.sat_range) || 1400;
    const actMin = parseRangeMin(us.act_range) || null;
    const testPolicy = String(us.test_policy || 'Test-Optional');

    const rows = stdRows(data);
    const satScore = resolveStandardizedForMatch(rows, 'SAT', prefs)?.score || 0;
    const actScore = resolveStandardizedForMatch(rows, 'ACT', prefs)?.score || 0;
    let standardized = 0;
    if (satScore > 0) standardized = Math.min((satScore / satMin) * 100, 100);
    else if (actScore > 0 && actMin) standardized = Math.min((actScore / actMin) * 100, 100);
    else if (testPolicy === 'Blind') standardized = 100;

    const toeflMin = typeof us.toefl_min === 'number' ? us.toefl_min : null;
    let language = 0;
    if (toeflMin) {
      const bestToefl = resolveLanguageForMatch(data.languageScores, 'TOEFL', prefs);
      language = bestToefl && bestToefl.overall > 0 ? Math.min((bestToefl.overall / toeflMin) * 100, 100) : 0;
    } else {
      const ieltsReq = parseIeltsReq(uni.requirements.language || ''); // fallback
      const bestIelts = resolveLanguageForMatch(data.languageScores, 'IELTS', prefs);
      language = bestIelts && bestIelts.overall > 0 ? Math.min((bestIelts.overall / ieltsReq) * 100, 100) : 0;
    }

    // 学术代理：沿用现有 A-Level/课程表现均值（若没有则为0）
    const subjects = data.aLevelSubjects;
    const currentScores = subjects.map((s) => getSubjectAvgScore(s)).filter((s) => s > 0);
    const avgCurrent = currentScores.length > 0 ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length : 0;
    const academic = avgCurrent > 0 ? Math.min(avgCurrent, 100) : 0;

    return Math.round(academic * 0.35 + language * 0.25 + standardized * 0.40);
  }

  const requiredGrades = extractAlevelGrades(uni.requirements.aLevel || '');
  const avgRequired =
    requiredGrades.length > 0
      ? requiredGrades.reduce((acc, g) => acc + (gradeMap[g] || 70), 0) / requiredGrades.length
      : 75;

  const subjects = pickRelevantSubjects(data, uni);
  const currentScores = subjects.map((s) => getSubjectAvgScore(s)).filter((s) => s > 0);
  const avgCurrent =
    currentScores.length > 0 ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length : 0;

  const academic = avgCurrent > 0 ? Math.min((avgCurrent / avgRequired) * 100, 100) : 0;

  const ieltsReq = parseIeltsReq(uni.requirements.language || '');
  const bestIelts = resolveLanguageForMatch(data.languageScores, 'IELTS', prefs);
  const language =
    bestIelts && bestIelts.overall > 0 ? Math.min((bestIelts.overall / ieltsReq) * 100, 100) : 0;

  return Math.round(academic * 0.65 + language * 0.35);
}

export type UsReqCheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export type UsReqCheckRow = {
  key: string;
  label: string;
  requirement: string;
  current: string;
  status: UsReqCheckStatus;
  note?: string;
};

/** 专业层（院校库专业抽屉）结构化要求，用于美本需求页逐项对照 */
export type UsProgramExtras = {
  subject_requirements_struct?: { include?: string[]; minGrades?: Record<string, string> } | null;
  alevel_required_grades?: string[] | null;
  a_level_requirement?: string | null;
};

function subjectNameMatches(courseName: string, req: string): boolean {
  const a = (courseName || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const b = (req || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function bestLetterGradeForSubject(s: StudentDashboardData['aLevelSubjects'][number]): string | null {
  const g =
    s.computedAlevelGrade ||
    (s.predictedFinalGrade as string | undefined) ||
    s.finalGrade ||
    s.mockGrade ||
    s.predictedGrade ||
    null;
  if (!g) return null;
  const t = String(g).trim();
  if (t.startsWith('A*')) return 'A*';
  if (t.startsWith('A') && !t.startsWith('A*')) return 'A';
  return t.charAt(0).toUpperCase() + (t.includes('*') ? '*' : '');
}

/**
 * 美本目标逐项对照：语言 / 标化 / A-Level 学术代理 / 专业先修（可选）。
 * 与 computeUniHardGate、computeUniMatchScore 使用同一套分数解析，避免结论分裂。
 */
export function analyzeUsUniversityRequirementsDetail(
  data: StudentDashboardData,
  uni: Uni,
  programExtras?: UsProgramExtras | null
): { rows: UsReqCheckRow[]; matchScore: number; hardGate: { ok: boolean; reasons: string[] } } {
  const prefs: MatchPrefs = uni.matchingPrefs ?? null;
  const system = getEduSystem(uni);
  const hardGate = computeUniHardGate(data, uni);
  const matchScore = computeUniMatchScore(data, uni);

  if (system !== 'us') {
    return { rows: [], matchScore, hardGate };
  }

  const reqStruct = getReqStruct(uni);
  const us = reqStruct?.us || {};
  const rows: UsReqCheckRow[] = [];

  const toeflMin = typeof us.toefl_min === 'number' ? us.toefl_min : null;
  if (toeflMin) {
    const bestToefl = resolveLanguageForMatch(data.languageScores, 'TOEFL', prefs);
    const cur = bestToefl ? String(bestToefl.overall) : '—';
    const status: UsReqCheckStatus = !bestToefl ? 'fail' : bestToefl.overall >= toeflMin ? 'pass' : 'fail';
    rows.push({
      key: 'toefl',
      label: '托福 TOEFL',
      requirement: `总分 ≥ ${toeflMin}`,
      current: cur,
      status,
      note: '院校库以托福门槛为主时，请优先录入托福成绩',
    });
  } else {
    const ieltsReq = parseIeltsReq(uni.requirements.language || '');
    const bestIelts = resolveLanguageForMatch(data.languageScores, 'IELTS', prefs);
    const cur = bestIelts ? String(bestIelts.overall) : '—';
    const status: UsReqCheckStatus = !bestIelts ? 'warn' : bestIelts.overall >= ieltsReq ? 'pass' : 'fail';
    rows.push({
      key: 'ielts',
      label: '雅思 IELTS',
      requirement: `总分 ≥ ${ieltsReq}`,
      current: cur,
      status,
      note: '未配置托福门槛时，按语言要求字段对照雅思',
    });
  }

  const testPolicy = String(us.test_policy || 'Test-Optional');
  const satMin = parseRangeMin(us.sat_range);
  const actMin = parseRangeMin(us.act_range);
  const satRow = resolveStandardizedForMatch(stdRows(data), 'SAT', prefs);
  const actRow = resolveStandardizedForMatch(stdRows(data), 'ACT', prefs);
  const satScore = satRow?.score;
  const actScore = actRow?.score;

  if (testPolicy === 'Blind') {
    rows.push({
      key: 'std',
      label: 'SAT / ACT',
      requirement: 'Test-Blind（录取不参考标化）',
      current: satScore || actScore ? `已录入（不影响录取模型）` : '—',
      status: 'info',
    });
  } else if (testPolicy === 'Required') {
    const satOk = satMin != null && satScore != null && satScore >= satMin;
    const actOk = actMin != null && actScore != null && actScore >= actMin;
    let pass = false;
    let reqText = '';
    if (satMin != null && actMin != null) {
      reqText = `SAT ≥ ${satMin} 或 ACT ≥ ${actMin}`;
      pass = satOk || actOk;
    } else if (satMin != null) {
      reqText = `SAT ≥ ${satMin}`;
      pass = satOk;
    } else if (actMin != null) {
      reqText = `ACT ≥ ${actMin}`;
      pass = actOk;
    } else {
      reqText = '须提交 SAT 或 ACT';
      pass = !!(satScore || actScore);
    }
    const cur =
      satScore != null && actScore != null
        ? `SAT ${satScore} / ACT ${actScore}`
        : satScore != null
          ? `SAT ${satScore}`
          : actScore != null
            ? `ACT ${actScore}`
            : '—';
    rows.push({
      key: 'std',
      label: 'SAT / ACT',
      requirement: reqText,
      current: cur,
      status: pass ? 'pass' : 'fail',
    });
  } else {
    const cur =
      satScore != null && actScore != null
        ? `SAT ${satScore} / ACT ${actScore}`
        : satScore != null
          ? `SAT ${satScore}`
          : actScore != null
            ? `ACT ${actScore}`
            : '未提交';
    rows.push({
      key: 'std',
      label: 'SAT / ACT',
      requirement: 'Test-Optional（可选提交）',
      current: cur,
      status: satScore || actScore ? 'pass' : 'warn',
      note: '可选政策下仍建议提交有竞争力的分数',
    });
  }

  const subjects = data.aLevelSubjects;
  const currentScores = subjects.map((s) => getSubjectAvgScore(s)).filter((s) => s > 0);
  const avgAcademic =
    currentScores.length > 0 ? Math.round(currentScores.reduce((a, b) => a + b, 0) / currentScores.length) : 0;
  rows.push({
    key: 'academic',
    label: '学术成绩（A-Level）',
    requirement: '课程均分（与匹配引擎一致）',
    current: subjects.length === 0 ? '无选课' : avgAcademic > 0 ? `${avgAcademic} 分` : '暂无有效分数',
    status: subjects.length === 0 ? 'warn' : avgAcademic > 0 ? 'info' : 'warn',
    note: '以各科目实考/校内合成分为准，用于美本侧学术代理',
  });

  const gpaRange = us.gpa_range != null ? String(us.gpa_range).trim() : '';
  if (gpaRange) {
    rows.push({
      key: 'gpa_ref',
      label: 'GPA 参考（美高体系）',
      requirement: gpaRange,
      current: 'A-Level 路径不换算 GPA',
      status: 'info',
      note: '本校为 A-Level 体系，此项仅供理解美方常见表述',
    });
  }

  const recN = typeof us.rec_letters_count === 'number' ? us.rec_letters_count : null;
  if (recN != null && recN > 0) {
    rows.push({
      key: 'recs',
      label: '推荐信',
      requirement: `通常需 ${recN} 封`,
      current: '请在网申/材料中跟踪',
      status: 'info',
    });
  }

  const essayN = typeof us.essay_count === 'number' ? us.essay_count : null;
  if (essayN != null && essayN > 0) {
    rows.push({
      key: 'essays',
      label: '主文书 / 补充文书',
      requirement: `约 ${essayN} 篇（参考）`,
      current: '请在申请任务中跟踪',
      status: 'info',
    });
  }

  const struct = programExtras?.subject_requirements_struct;
  const include = struct?.include?.filter(Boolean) || [];
  for (const name of include) {
    const hit = data.aLevelSubjects.find((s) => subjectNameMatches(s.name, name));
    rows.push({
      key: `inc_${name}`,
      label: `先修科目 · ${name}`,
      requirement: '建议/要求修读',
      current: hit ? `已选：${hit.name}` : '未选或未匹配到课程名',
      status: hit ? 'pass' : 'warn',
    });
  }

  const minGrades = struct?.minGrades || {};
  for (const [subName, minG] of Object.entries(minGrades)) {
    const hit = data.aLevelSubjects.find((s) => subjectNameMatches(s.name, subName));
    const letter = hit ? bestLetterGradeForSubject(hit) : null;
    const need = String(minG || '').trim();
    const needPct = gradeMap[need as keyof typeof gradeMap] ?? 70;
    const gotPct = letter ? gradeMap[letter as keyof typeof gradeMap] ?? 0 : 0;
    rows.push({
      key: `ming_${subName}`,
      label: `科目成绩 · ${subName}`,
      requirement: `≥ ${need}`,
      current: hit ? (letter ? letter : `${getSubjectAvgScore(hit)} 分`) : '无对应科目',
      status: !hit ? 'warn' : gotPct >= needPct ? 'pass' : 'fail',
    });
  }

  const reqGrades = programExtras?.alevel_required_grades?.filter(Boolean) || [];
  if (reqGrades.length > 0) {
    const reqAvg =
      reqGrades.reduce((acc, g) => acc + (gradeMap[g as keyof typeof gradeMap] || 70), 0) / reqGrades.length;
    const rel = pickRelevantSubjects(data, uni);
    const scores = rel.map((s) => getSubjectAvgScore(s)).filter((s) => s > 0);
    const curAvg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    rows.push({
      key: 'alevel_bundle',
      label: 'A-Level 组合要求',
      requirement: `约 ${reqGrades.join(' / ')}（均分代理）`,
      current: scores.length > 0 ? `${Math.round(curAvg)} 分` : '无有效分',
      status: scores.length === 0 ? 'warn' : curAvg + 5 >= reqAvg ? 'pass' : curAvg >= reqAvg * 0.9 ? 'warn' : 'fail',
      note: '将要求等级转为百分制均分后与当前均分比较，仅供参考',
    });
  }

  const alevelText = (programExtras?.a_level_requirement || uni.requirements.aLevel || '').trim();
  if (alevelText && reqGrades.length === 0 && include.length === 0 && Object.keys(minGrades).length === 0) {
    const targetPct = alevelReqToTargetPct(alevelText);
    rows.push({
      key: 'alevel_text',
      label: 'A-Level 文字要求',
      requirement: `目标水平约 ${targetPct} 分（由要求文本解析）`,
      current: avgAcademic > 0 ? `${avgAcademic} 分` : '暂无',
      status: avgAcademic <= 0 ? 'warn' : avgAcademic >= targetPct - 10 ? 'pass' : avgAcademic >= targetPct - 20 ? 'warn' : 'fail',
    });
  }

  return { rows, matchScore, hardGate };
}

/** 将院校 A-Level 要求字符串转为雷达图「目标水平」0–100 */
export function alevelReqToTargetPct(aLevel: string): number {
  const grades = extractAlevelGrades(aLevel || '');
  if (grades.length === 0) return 85;
  const avg = grades.reduce((s, g) => s + (gradeMap[g] || 70), 0) / grades.length;
  return Math.round(Math.min(100, avg));
}

export function findTargetUniversityByFocusId(
  data: StudentDashboardData,
  focusId: string | null | undefined
): Uni | null {
  if (!focusId || !data.targetUniversities?.length) return null;
  return (
    data.targetUniversities.find(
      (u) => u.studentUniversityId === focusId || u.universityId === focusId
    ) ?? null
  );
}
