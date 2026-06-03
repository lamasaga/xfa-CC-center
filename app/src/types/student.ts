// 学生信息类型定义

export interface StudentInfo {
  id: string;
  name: string;
  englishName: string;
  grade: string; // 年级（如 2025级）
  school: string; // 班级（如 N01 / I01）
  /** 仪表盘头像 URL（可含 ?t= 缓存穿透）；无则显示姓名首字 */
  avatarUrl?: string | null;
  contact: {
    phone: string;
    email: string;
    wechat: string;
  };
  parentContact: {
    name: string;
    phone: string;
    email: string;
  };
  enrollmentDate: string;
  advisor: string; // 负责顾问
}

export interface ALevelSubject {
  name: string;
  /** 考试局/类型：Internal 为校内课程（默认不参与雷达图/匹配） */
  board: 'Edexcel' | 'CIE' | 'AQA' | 'OCR' | 'WJEC' | 'LRN' | 'Internal';
  asGrade?: string;
  a2Grade?: string;
  predictedGrade?: string;
  finalGrade?: string;
  internalScore?: number;
  internalGrade?: string;
  mockScore?: number;
  mockGrade?: string;
  finalScore?: number;
  unitGrades: {
    unit: string;
    score: number;
    maxScore: number;
    grade: string;
    date: string;
    examType?: 'internal' | 'mock' | 'final' | 'retake';
  }[];
  computedFinalScore?: number | null;
  computedInternalAvg?: number | null;
  computedAdvancedPct?: number | null;
  computedAlevelGrade?: 'A*' | 'A' | null;
  // 中间层推算（用于院校匹配）
  predictedFinalPct?: number | null; // 0-100
  predictedFinalGrade?: 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U' | null;
  predictedConfidence?: number | null; // 0-1
  predictedProbabilities?: Record<string, number> | null;
  totalConfiguredUnits?: number;
  finishedFinalUnits?: number;
  needsRetake: boolean;
  retakeUnits: string[];
}

export interface LanguageScore {
  id?: string;
  type: 'IELTS' | 'TOEFL' | 'PTE' | 'Duolingo';
  overall: number;
  listening?: number;
  reading?: number;
  writing?: number;
  speaking?: number;
  /** Duolingo 等：自定义维度分数（如 literacy / conversation / comprehension / production） */
  componentScores?: Record<string, number> | null;
  testDate: string;
  validUntil: string;
  bestScore: boolean;
}

export interface StandardizedTest {
  /** 与后端 standardized_tests.id 一致，用于匹配偏好指定 */
  id?: string;
  type: 'SAT' | 'ACT' | 'AP' | 'IB' | 'STEP' | 'MAT' | 'TMUA';
  score: number;
  sectionScores?: {
    name: string;
    score: number;
  }[];
  testDate: string;
  bestScore: boolean;
}

export interface TargetUniversity {
  studentUniversityId?: string;
  universityId?: string;
  name: string;
  country: 'UK' | 'US' | 'Canada' | 'Australia' | 'Hong Kong' | 'Singapore' | 'Other';
  ranking: number;
  course: string;
  requirements: {
    aLevel: string;
    language: string;
    subjectRequirements?: string[];
    /** 新结构化要求（优先用于匹配/雷达图）；旧字段仍保留作展示兜底 */
    requirementsStruct?: Record<string, unknown> | null;
    sat?: number; // 旧版兼容
    act?: number; // 旧版兼容
  };
  eduSystem?: 'commonwealth' | 'us' | 'other' | null;
  degreeLevel?: 'undergrad' | 'postgrad' | null;
  deadline: string;
  status: 'reach' | 'target' | 'safety';
  applicationStatus: 'not_started' | 'preparing' | 'submitted' | 'offer' | 'rejected';
  notes: string;
  createdAt?: string;
  matchingPrefs?: { language_score_id?: string; standardized_test_id?: string } | null;
  offerDetail?: Record<string, unknown> | null;
}

export interface ExamSchedule {
  id: string;
  subject: string;
  examBoard: string;
  unit: string;
  date: string;
  time: string;
  venue: string;
  duration: number; // 分钟
  status: 'upcoming' | 'completed' | 'missed';
  score?: number;
  maxScore: number;
}

export interface RetakePlan {
  subject: string;
  unit: string;
  originalGrade: string;
  originalScore: number;
  targetGrade: string;
  targetScore: number;
  plannedDate: string;
  preparationStatus: 'not_started' | 'planning' | 'in_progress' | 'ready';
  notes: string;
}

export interface ApplicationTimeline {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'application' | 'interview' | 'decision' | 'other';
  university?: string;
  description: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface ExtracurricularActivity {
  id: string;
  name: string;
  type: 'academic' | 'leadership' | 'community' | 'arts' | 'sports' | 'other';
  role: string;
  organization: string;
  startDate: string;
  endDate?: string;
  ongoing: boolean;
  description: string;
  hoursPerWeek: number;
  achievements: string[];
}

export interface RecommendationPlan {
  id: string;
  category: 'academic' | 'language' | 'standardized' | 'extracurricular' | 'application';
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  deadline?: string;
  completed: boolean;
  assignedTo?: string;
}

export interface SessionOverviewData {
  nextSession: { label: string; year: number; month: number } | null;
  daysUntilNext: number | null;
  nextSessionPlans: Array<{
    course_name: string;
    unit_code: string;
    plan_type: 'first_sit' | 'resit';
  }>;
  courseProgress: Array<{
    course_name: string;
    board: string;
    total_units: number;
    planned_units: number;
    completed_units: number;
    resit_needed: number;
  }>;
  remainingSessions: number;
  totalResitNeeded: number;
}

export interface StudentDashboardData {
  student: StudentInfo;
  aLevelSubjects: ALevelSubject[];
  languageScores: LanguageScore[];
  standardizedTests: StandardizedTest[];
  targetUniversities: TargetUniversity[];
  examSchedule: ExamSchedule[];
  retakePlans: RetakePlan[];
  timeline: ApplicationTimeline[];
  extracurriculars: ExtracurricularActivity[];
  recommendations: RecommendationPlan[];
  sessionOverview?: SessionOverviewData;
}
