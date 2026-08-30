export type AdmissionDifficultyTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface DifficultyTierInfo {
  tier: AdmissionDifficultyTier;
  shortLabel: string;
  fullLabel: string;
  color: string;
  aLevel: string;
  language: string;
  additionalExams: string;
  competitions: string;
  extracurriculars: string;
  interview: string;
}

export const DIFFICULTY_TIERS: Record<AdmissionDifficultyTier, DifficultyTierInfo> = {
  1: {
    tier: 1,
    shortLabel: '爬藤难度',
    fullLabel: '爬藤难度',
    color: '#8B2332',
    aLevel: '建议四门 A-Level 满分或接近满分',
    language: '雅思 7.5-8.0（小分 7.5）',
    additionalExams: '有附加或独立考试要求，如 SAT、MAT、STEP、TMUA、ESAT、TARA 等',
    competitions: '匹配 5+ 国际/国家级决赛奖项',
    extracurriculars: '深度长线项目 + 顶级夏校',
    interview: '有单轮或多轮面试',
  },
  2: {
    tier: 2,
    shortLabel: '顶级挑战',
    fullLabel: '顶级挑战',
    color: '#3B6EA5',
    aLevel: '三门 A-Level A*A*A',
    language: '雅思 7.0-7.5（小分 6.5）',
    additionalExams: '视专业要求而定的附加考试',
    competitions: '匹配 5+ 国际/国家级决赛或晋级轮次，或全国/国际初赛获奖',
    extracurriculars: '深度项目 + 高选拔夏校',
    interview: '较可能有单轮或多轮面试',
  },
  3: {
    tier: 3,
    shortLabel: '激烈竞争',
    fullLabel: '激烈竞争',
    color: '#6B4C8A',
    aLevel: '三门 A-Level AAA-A*AA',
    language: '雅思 6.5（小分 6.0）',
    additionalExams: '少数专业需要',
    competitions: '匹配国际/全国初赛获奖',
    extracurriculars: '有深度的项目 + 竞赛',
    interview: '部分专业需要',
  },
  4: {
    tier: 4,
    shortLabel: '大众情人校',
    fullLabel: '大众情人校',
    color: '#4A7C6F',
    aLevel: '三门 A-Level BBB-AAA',
    language: '雅思 6.5（小分 6.0）',
    additionalExams: '少数专业需要',
    competitions: '建议有',
    extracurriculars: '持续参与的活动',
    interview: '少数专业需要',
  },
  5: {
    tier: 5,
    shortLabel: '稳健申请',
    fullLabel: '稳健申请',
    color: '#D4943A',
    aLevel: '三门 A-Level B 以下',
    language: '雅思 6.5（小分 6.0）',
    additionalExams: '一般不需要',
    competitions: '建议有',
    extracurriculars: '参与即可',
    interview: '基本不需要',
  },
  6: {
    tier: 6,
    shortLabel: '基本保底',
    fullLabel: '基本保底',
    color: '#6B6560',
    aLevel: '校本成绩，不对 A-Level 强制要求',
    language: '雅思 6.0（小分 5.5）',
    additionalExams: '不需要',
    competitions: '不作要求',
    extracurriculars: '不作要求',
    interview: '不需要',
  },
};

interface UniLike {
  admission_difficulty?: number;
  admission?: { acceptance_rate?: string | number };
}

export function normalizeDifficultyTier(raw: unknown): AdmissionDifficultyTier | null {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (n >= 1 && n <= 6) return n as AdmissionDifficultyTier;
  return null;
}

export function getUniversityDifficultyTier(uni: UniLike): AdmissionDifficultyTier | null {
  const explicit = normalizeDifficultyTier(uni.admission_difficulty);
  if (explicit) return explicit;
  return inferDifficultyFromAcceptanceRate(uni.admission?.acceptance_rate);
}

function inferDifficultyFromAcceptanceRate(rate: unknown): AdmissionDifficultyTier | null {
  if (rate === '' || rate == null) return null;
  const nums = String(rate).match(/[\d.]+/g);
  if (!nums?.length) return null;
  const value = Math.min(...nums.map(Number));
  if (value < 6) return 1;
  if (value < 12) return 2;
  if (value < 22) return 3;
  if (value < 45) return 4;
  if (value < 68) return 5;
  return 6;
}

export function getDifficultyInfo(tier: AdmissionDifficultyTier): DifficultyTierInfo {
  return DIFFICULTY_TIERS[tier];
}

export function getDifficultyLabel(uni: UniLike): string {
  const tier = getUniversityDifficultyTier(uni);
  return tier ? DIFFICULTY_TIERS[tier].shortLabel : '--';
}

export function getDifficultyFullLabel(uni: UniLike): string {
  const tier = getUniversityDifficultyTier(uni);
  return tier ? DIFFICULTY_TIERS[tier].fullLabel : '暂无分级';
}

export function getDifficultyColor(uni: UniLike): string {
  const tier = getUniversityDifficultyTier(uni);
  return tier ? DIFFICULTY_TIERS[tier].color : '#6B6560';
}

export function getDifficultySortValue(uni: UniLike): number {
  const tier = getUniversityDifficultyTier(uni);
  return tier ?? 99;
}
