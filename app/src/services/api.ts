// 开发态走当前页面源 + Vite proxy；生产/Electron 与页面同源，避免 localhost IPv4/IPv6 不一致
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api');

// 获取存储的token
const getToken = () => localStorage.getItem('token');

// 通用请求函数
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      const isLoginRequest = endpoint.startsWith("/auth/login");
      const isChangePasswordRequest = endpoint.startsWith("/auth/change-password");
      const error = await response.json().catch(() => ({
        error: isLoginRequest ? "Invalid credentials" : "Unauthorized",
      }));
      if (!isLoginRequest && !isChangePasswordRequest) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
      throw new Error(error.error || "Unauthorized");
    }

    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    const base = error.error || `HTTP ${response.status}`;
    const detail =
      typeof (error as { details?: string }).details === "string"
        ? (error as { details: string }).details
        : "";
    throw new Error(detail ? `${base}（${detail}）` : base);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// API对象
export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, data?: unknown) => 
    request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data?: unknown) => 
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data?: unknown) =>
    request<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};

// 认证相关
export const authApi = {
  login: (username: string, password: string) => 
    api.post<{ token: string; user: User }>('/auth/login', { username, password }),
  
  getMe: () => api.get<User>('/auth/me'),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  
  getUsers: () =>
    api.get<{ users: User[]; securityNote: string }>('/auth/users'),

  createUser: (user: Partial<User> & { password: string }) =>
    api.post('/auth/users', user),

  updateUser: (id: string, data: Partial<Pick<User, 'name' | 'email' | 'role'>>) =>
    api.patch<User>(`/auth/users/${id}`, data),

  resetUserPassword: (id: string, newPassword: string) =>
    api.post<{ message: string; username: string }>(`/auth/users/${id}/reset-password`, {
      newPassword,
    }),
};

// 学生相关
function buildQuery(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      filtered[key] = value;
    }
  }
  const qs = new URLSearchParams(filtered).toString();
  return qs ? `?${qs}` : '';
}

export const studentApi = {
  getAll: (params?: { grade?: string; status?: string; search?: string }) => {
    const query = buildQuery(params);
    return api.get<StudentWithStats[]>(`/students${query}`);
  },
  
  getById: (id: string) => api.get<Student>(`/students/${id}`),
  
  getDashboard: (id: string) => api.get<StudentDashboard>(`/students/${id}/dashboard`),

  uploadAvatar: async (studentId: string, file: File): Promise<{ avatar_url: string; updated_at: string }> => {
    const form = new FormData();
    form.append('avatar', file);
    const url = `${API_BASE_URL}/students/${studentId}/avatar`;
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(url, { method: 'POST', headers, body: form });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: '上传失败' }));
      const msg = (err as { error?: string }).error || `HTTP ${response.status}`;
      throw new Error(msg);
    }
    return response.json();
  },

  // A-Level 实考单元推算（用于目标院校匹配）
  getAlevelPredictions: (id: string) =>
    api.get<AlevelPredictionsResponse>(`/students/${id}/alevel-predictions`),
  
  getGradeOverview: (grade: string) => api.get<GradeOverview>(`/students/grade-overview/${grade}`),

  getWorkbench: (params?: { grade?: string; course_id?: string; university_id?: string }) => {
    const query = buildQuery(params);
    return api.get<WorkbenchResponse>(`/students/workbench${query}`);
  },
  
  create: (student: Partial<Student>) =>
    api.post<{ student: Student; student_account?: { username: string; initial_password: string } }>(
      '/students',
      student
    ),
  
  update: (id: string, student: Partial<Student>) => api.put<Student>(`/students/${id}`, student),
  
  delete: (id: string) => api.delete(`/students/${id}`),

  addLanguageScore: (studentId: string, data: Partial<LanguageScore>) =>
    api.post<LanguageScore>(`/students/${studentId}/language-scores`, data),

  updateLanguageScore: (studentId: string, scoreId: string, data: Partial<LanguageScore>) =>
    api.put<LanguageScore>(`/students/${studentId}/language-scores/${scoreId}`, data),

  deleteLanguageScore: (studentId: string, scoreId: string) =>
    api.delete(`/students/${studentId}/language-scores/${scoreId}`),

  getTasks: (studentId: string) =>
    api.get<Task[]>(`/students/${studentId}/tasks`),

  createTask: (studentId: string, data: Partial<Task>) =>
    api.post<Task>(`/students/${studentId}/tasks`, data),

  updateTask: (studentId: string, taskId: string, data: Partial<Task>) =>
    api.put<Task>(`/students/${studentId}/tasks/${taskId}`, data),

  deleteTask: (studentId: string, taskId: string) =>
    api.delete(`/students/${studentId}/tasks/${taskId}`),
};

export interface AlevelCoursePrediction {
  course_id: string;
  course_name: string;
  board: string;
  student_course_id: string;
  coverage: number; // 0-1
  confidence: number; // 0-1
  observed_units: number;
  total_units: number;
  predicted_pct: number | null; // 0-100
  predicted_total_score: number | null;
  max_total_score: number;
  predicted_advanced_pct: number | null; // 0-100
  predicted_grade: 'A*' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
  probabilities: Record<string, number>;
  /** 所有配置单元均已有实考/重考成绩时为 true，此时等级不会再随机预测。 */
  is_finalized?: boolean;
  prediction_basis?: 'confirmed' | 'estimate';
}

export interface AlevelPredictionsResponse {
  student_id: string;
  generated_at: string;
  predictions: AlevelCoursePrediction[];
}

// 课程相关
export const courseApi = {
  getAll: (params?: { grade_level?: string; board?: string }) => {
    const query = buildQuery(params);
    return api.get<Course[]>(`/courses${query}`);
  },
  
  getDetail: (id: string) => api.get<CourseDetail>(`/courses/${id}/detail`),
  
  create: (course: Partial<Course>) => api.post<Course>('/courses', course),
  
  update: (id: string, course: Partial<Course>) => api.put<Course>(`/courses/${id}`, course),
  
  delete: (id: string) => api.delete(`/courses/${id}`),
  
  enrollStudent: (courseId: string, studentId: string) =>
    api.post(`/courses/${courseId}/enroll`, { student_id: studentId }),

  removeStudent: (courseId: string, studentId: string) =>
    api.delete(`/courses/${courseId}/enroll/${studentId}`),
  
  updateGrades: (courseId: string, studentId: string, grades: Partial<StudentCourse>) =>
    api.put(`/courses/${courseId}/grades/${studentId}`, grades),
  
  addUnitGrade: (courseId: string, studentId: string, unitGrade: Partial<UnitGrade>) =>
    api.post(`/courses/${courseId}/unit-grades/${studentId}`, unitGrade),

  updateUnitGrade: (unitGradeId: string, unitGrade: Partial<UnitGrade>) =>
    api.put<UnitGrade>(`/courses/unit-grades/${unitGradeId}`, unitGrade),

  deleteUnitGrade: (unitGradeId: string) =>
    api.delete(`/courses/unit-grades/${unitGradeId}`),

  getUnits: (courseId: string) =>
    api.get<CourseUnit[]>(`/courses/${courseId}/units`),

  addUnit: (courseId: string, data: Partial<CourseUnit>) =>
    api.post<CourseUnit>(`/courses/${courseId}/units`, data),

  updateUnit: (courseId: string, unitId: string, data: Partial<CourseUnit>) =>
    api.put<CourseUnit>(`/courses/${courseId}/units/${unitId}`, data),

  deleteUnit: (courseId: string, unitId: string) =>
    api.delete(`/courses/${courseId}/units/${unitId}`),

  cloneGradeCourses: (fromGrade: string, toGrade: string) =>
    api.post<{ createdCourses: number; copiedUnits: number; skippedCourses: number; skippedUnits: number }>(
      '/courses/clone-grade',
      { from_grade: fromGrade, to_grade: toGrade }
    ),
};

// 院校相关
export const universityApi = {
  getAll: (params?: { country?: string; search?: string }) => {
    const query = buildQuery(params);
    return api.get<University[]>(`/universities${query}`);
  },
  
  getById: (id: string) => api.get<University>(`/universities/${id}`),
  
  create: (university: Partial<University>) => api.post<University>('/universities', university),
  
  update: (id: string, university: Partial<University>) => api.put<University>(`/universities/${id}`, university),
  
  delete: (id: string) => api.delete(`/universities/${id}`),
  
  addToStudent: (
    studentId: string,
    universityId: string,
    type?: string,
    opts?: { program_id?: string | null }
  ) =>
    api.post(`/universities/student/${studentId}`, {
      university_id: universityId,
      application_type: type,
      ...(opts?.program_id ? { program_id: opts.program_id } : {}),
    }),
  
  updateStudentUni: (studentId: string, universityId: string, data: Partial<StudentUniversity>) =>
    api.put(`/universities/student/${studentId}/${universityId}`, data),
  
  removeFromStudent: (studentId: string, universityId: string) =>
    api.delete(`/universities/student/${studentId}/${universityId}`),

  getPrograms: (universityId: string) =>
    api.get<UniversityProgram[]>(`/universities/${universityId}/programs`),

  addProgram: (universityId: string, data: Partial<UniversityProgram>) =>
    api.post<UniversityProgram>(`/universities/${universityId}/programs`, data),

  updateProgram: (universityId: string, programId: string, data: Partial<UniversityProgram>) =>
    api.put<UniversityProgram>(`/universities/${universityId}/programs/${programId}`, data),

  deleteProgram: (universityId: string, programId: string) =>
    api.delete(`/universities/${universityId}/programs/${programId}`),
};

// 类型定义
export interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  /** 管理员 / 教务 / 指导老师 / 学生 */
  role: 'admin' | 'staff' | 'supervisor' | 'teacher' | 'student';
  /** 学生账号绑定的 students.id */
  student_id?: string | null;
  created_at: string;
  password_is_hashed?: boolean;
  password_hint?: string;
}

export interface Student {
  id: string;
  name: string;
  english_name: string;
  grade: string;
  school: string;
  /** 班级类型：国际 / 国内 */
  class_track?: 'international' | 'domestic' | null;
  enrollment_year: number;
  study_duration: 2 | 3;
  /** YYYY-MM，与后端 students.expected_graduation_month 一致 */
  expected_graduation_month?: string;
  advisor_id: string;
  advisor_name?: string;
  phone: string;
  email: string;
  wechat: string;
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  /** 相对路径如 /uploads/students/{id}.jpg */
  avatar_url?: string | null;
  status: 'active' | 'graduated' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface StudentStats {
  courseCount: number;
  avgInternalScore: number;
  hasLanguageScore: boolean;
  bestIelts: number | null;
  universityCount: number;
  offerCount: number;
  pendingTasks: number;
}

export interface StudentWithStats extends Student {
  stats: StudentStats;
}

export interface StudentCourse {
  id: string;
  student_id: string;
  course_id: string;
  course_name?: string;
  subject_code?: string;
  board?: string;
  internal_grade: string;
  internal_score: number;
  mock_grade: string;
  mock_score: number;
  final_grade: string;
  final_score: number;
  status: 'enrolled' | 'completed' | 'dropped';
  unitGrades: UnitGrade[];
  courseUnits?: CourseUnit[];
}

export interface UnitGrade {
  id: string;
  unit_name: string;
  unit_code: string;
  score: number;
  max_score: number;
  grade: string;
  exam_date: string;
  exam_type: 'internal' | 'mock' | 'final' | 'retake';
}

export interface LanguageScore {
  id: string;
  test_type: 'IELTS' | 'TOEFL' | 'PTE' | 'Duolingo';
  overall_score: number;
  listening_score: number;
  reading_score: number;
  writing_score: number;
  speaking_score: number;
  /** JSON：用于 Duolingo 等自定义维度 */
  component_scores?: Record<string, number> | string | null;
  test_date: string;
  valid_until: string;
  is_best_score: boolean;
}

export interface StandardizedTest {
  id: string;
  test_type: 'SAT' | 'ACT' | 'AP' | 'IB' | 'STEP' | 'MAT' | 'TMUA';
  score: number;
  max_score: number;
  section_scores: Record<string, number>;
  test_date: string;
  is_best_score: boolean;
}

export interface University {
  id: string;
  name: string;
  country: string;
  ranking: number;
  course_name: string;
  a_level_requirement: string;
  language_requirement: string;
  subject_requirements: string[];
  degree_level?: 'undergrad' | 'postgrad' | null;
  edu_system?: 'commonwealth' | 'us' | 'other' | null;
  // US undergrad lite (school-level)
  school_type?: string | null;
  admit_rate?: number | null; // 0-100
  application_systems?: string[] | null;
  rounds_supported?: string[] | null;
  costs?: Record<string, unknown> | null;
  location_text?: string | null;
  campus_size_text?: string | null;
  requirements_struct?: Record<string, unknown> | null;
  application_deadline: string;
  notes: string;
}

export interface StudentUniversity {
  id: string;
  university_id: string;
  student_university_id?: string;
  name?: string;
  country?: string;
  ranking?: number;
  course_name?: string;
  program_id?: string | null;
  program_name?: string | null;
  a_level_requirement?: string;
  language_requirement?: string;
  subject_requirements?: string;
  application_deadline?: string;
  status: 'interested' | 'applying' | 'submitted' | 'offer' | 'rejected' | 'declined';
  application_type: 'reach' | 'target' | 'safety';
  personal_statement_status: string;
  reference_status: string;
  submitted_at: string;
  decision_date: string;
  conditions: string;
  notes: string;
  matching_prefs?: { language_score_id?: string; standardized_test_id?: string } | null;
  matching_profile?: Record<string, unknown> | null;
  offer_detail?: Record<string, unknown> | null;
}

export interface Extracurricular {
  id: string;
  name: string;
  activity_type: string;
  role: string;
  organization: string;
  start_date: string;
  end_date: string;
  ongoing: boolean;
  description: string;
  hours_per_week: number;
  achievements: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_by_name?: string;
}

export interface StudentDashboard {
  student: Student;
  courses: StudentCourse[];
  languageScores: LanguageScore[];
  standardizedTests: StandardizedTest[];
  targetUniversities: StudentUniversity[];
  extracurriculars: Extracurricular[];
  tasks: Task[];
}

export interface Course {
  id: string;
  name: string;
  subject_code: string;
  board: string;
  grade_level: string;
  teacher_id: string;
  teacher_name?: string;
  academic_year: string;
  semester: string;
  max_students: number;
  description: string;
  student_count?: number;
}

export interface CourseStudent {
  student_course_id: string;
  student_id: string;
  student_name: string;
  english_name: string;
  grade: string;
  internal_grade: string;
  internal_score: number;
  mock_grade: string;
  mock_score: number;
  final_grade: string;
  final_score: number;
  status: string;
  unitGrades: UnitGrade[];
  score_summary?: {
    internal: CourseScoreSummary;
    mock: CourseScoreSummary;
    final: CourseFinalScoreSummary;
  };
}

export interface CourseScoreSummary {
  score: number | null;
  grade: string | null;
  count: number;
}

export interface CourseFinalScoreSummary extends CourseScoreSummary {
  /** 每个单元仅保留最高的实考/补考记录，供课程详情直接展示。 */
  units: Array<{
    unit_code: string;
    unit_name: string;
    score: number;
    max_score: number;
    percentage: number;
    exam_type: 'final' | 'retake';
    exam_date: string | null;
  }>;
}

export interface CourseDetail {
  course: Course;
  students: CourseStudent[];
  stats: {
    total_students: number;
    avg_internal: number;
    avg_mock: number;
    avg_final: number;
    max_internal: number;
    min_internal: number;
    max_final: number;
    min_final: number;
    students_with_final: number;
  };
  gradeDistribution: { grade: string; count: number }[];
}

export interface CourseUnit {
  id: string;
  course_id: string;
  unit_code: string;
  unit_name: string;
  is_advanced?: boolean | 0 | 1;
  is_required?: boolean | 0 | 1;
  max_score: number;
  weight: number;
  description: string;
  sort_order: number;
  // 可用考季月份（如 [1,5] 表示只在1月/5月可考），可选
  allowed_months?: number[] | null;
}

export interface UniversityProgram {
  id: string;
  university_id: string;
  program_name: string;
  department: string;
  a_level_requirement: string;
  language_requirement: string;
  subject_requirements: string;
  requirements_struct?: Record<string, unknown> | null;
  // US undergrad lite (program-level)
  us_major_selectivity?: '高' | '中' | '低' | string | null;
  us_prerequisites_text?: string | null;
  portfolio_required?: boolean | 0 | 1 | null;
  portfolio_notes?: string | null;
  // ===== structured (optional) =====
  alevel_required_grades?: string[] | null; // ["A*","A","A"]
  subject_requirements_struct?: {
    include?: string[]; // ["Mathematics","Further Mathematics"]
    minGrades?: Record<string, string>; // { Mathematics: "A*" }
  } | null;
  extra_exams?: string[] | null; // ["STEP","MAT","TMUA"]
  language_type?: 'IELTS' | 'TOEFL' | 'PTE' | 'Duolingo' | null;
  language_overall_min?: number | null;
  language_component_mins?: {
    listening?: number;
    reading?: number;
    writing?: number;
    speaking?: number;
  } | null;
  application_deadline: string;
  tuition_fee: string;
  duration: string;
  notes: string;
}

export interface GradeOverview {
  grade: string;
  totalStudents: number;
  courseStats: {
    name: string;
    board: string;
    student_count: number;
    /** 先按学生计算实考/补考最佳单元的加权平均，再计算本年级课程均值。 */
    actual_exam_avg: number | null;
    actual_exam_student_count: number;
    actual_exam_unit_count: number;
  }[];
  universityStats: {
    applying_count: number;
    offer_count: number;
    submitted_count: number;
  };
  languageStats: {
    avg_ielts: number | null;
    max_ielts: number | null;
    has_ielts: number;
  };
}

export interface WorkbenchItem {
  student_id: string;
  name: string;
  english_name: string | null;
  grade: string;
  advisor_id: string | null;
  best_ielts: number | null;
  pending_tasks: number;
  urgent_tasks_7d: number;
  upcoming_tasks_30d: number;
  resit_needed: number;
  unplanned_units: number;
  resit_units_sample: Array<{ unit_code: string; grade: string }>;
  reasons: string[];
  risk_score: number;
}

export interface WorkbenchResponse {
  grade: string | null;
  total: number;
  items: WorkbenchItem[];
}

// ========== 考季相关类型 ==========

export interface ExamSession {
  id: string;
  year: number;
  month: number;
  label: string;
  board: string;
  registration_deadline: string | null;
  results_date: string | null;
  created_at: string;
}

export interface SessionUnitPlan {
  id: string;
  student_course_id: string;
  course_unit_id: string;
  exam_session_id: string;
  plan_type: 'first_sit' | 'resit';
  status: 'planned' | 'registered' | 'completed' | 'cancelled';
  notes: string | null;
}

export interface SessionPlanUnit {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  max_score: number;
  best_grade: {
    score: number;
    grade: string;
    exam_type: string;
    exam_date: string;
  } | null;
  needs_resit: boolean;
  // 当前单元允许的考试月份（如 [5] 表示仅5月可以考试）
  allowed_months?: number[] | null;
}

export interface SessionPlanCourse {
  student_course_id: string;
  course_id: string;
  course_name: string;
  subject_code: string;
  board: string;
  /** 已移除的选课只保留历史成绩和考季安排，不允许再编辑。 */
  historical?: boolean;
  unit_selection?: {
    mode: 'flexible';
    target_units: number;
    selected_unit_ids: string[];
  } | null;
  units: SessionPlanUnit[];
  plans: SessionUnitPlan[];
}

export interface SessionPlanResponse {
  student: {
    id: string;
    name: string;
    study_duration: number;
    enrollment_year: number;
  };
  sessions: ExamSession[];
  courses: SessionPlanCourse[];
}

export interface SessionOverview {
  next_session: ExamSession | null;
  next_session_deadlines: {
    registration_deadline: string | null;
    results_date: string | null;
    days_until_registration: number | null;
  } | null;
  next_session_plans: Array<SessionUnitPlan & {
    course_name: string;
    unit_code: string;
    unit_name: string;
  }>;
  courses_summary: Array<{
    course_name: string;
    board: string;
    total_units: number;
    planned_units: number;
    completed_units: number;
    resit_needed: number;
  }>;
  unplanned_units: Array<{
    student_course_id: string;
    course_id: string;
    course_name: string;
    unit_id: string;
    unit_code: string;
    unit_name: string;
  }>;
  resit_unplanned_units: Array<{
    student_course_id: string;
    course_id: string;
    course_name: string;
    unit_id: string;
    unit_code: string;
    unit_name: string;
    final_grade: string;
  }>;
  remaining_sessions: number;
  total_resit_needed: number;
}

// ========== 考季 API ==========

export const examSessionApi = {
  getAll: (params?: { board?: string; year?: string }) => {
    const query = buildQuery(params);
    return api.get<ExamSession[]>(`/exam-sessions${query}`);
  },

  create: (data: Partial<ExamSession>) =>
    api.post<ExamSession>('/exam-sessions', data),

  generate: (data: { enrollment_year: number; study_duration: number; board?: string }) =>
    api.post<{ created: number; sessions: ExamSession[] }>('/exam-sessions/generate', data),

  delete: (id: string) =>
    api.delete(`/exam-sessions/${id}`),

  getStudentPlans: (studentId: string) =>
    api.get<SessionPlanResponse>(`/exam-sessions/student/${studentId}/plans`),

  createPlan: (studentId: string, data: Partial<SessionUnitPlan>) =>
    api.post<SessionUnitPlan>(`/exam-sessions/student/${studentId}/plans`, data),

  updatePlan: (studentId: string, planId: string, data: Partial<SessionUnitPlan>) =>
    api.put<SessionUnitPlan>(`/exam-sessions/student/${studentId}/plans/${planId}`, data),

  deletePlan: (studentId: string, planId: string) =>
    api.delete(`/exam-sessions/student/${studentId}/plans/${planId}`),

  batchUpdatePlans: (studentId: string, plans: Array<Partial<SessionUnitPlan> & { _delete?: boolean }>) =>
    api.post<{ results: Array<{ id: string; action: string }> }>(
      `/exam-sessions/student/${studentId}/plans/batch`, { plans }
    ),

  getStudentOverview: (studentId: string) =>
    api.get<SessionOverview>(`/exam-sessions/student/${studentId}/overview`),
};
