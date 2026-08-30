// 开发态走当前页面源 + Vite proxy；生产/Electron 与页面同源，避免 localhost IPv4/IPv6 不一致
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined'
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api');

// 仅用于兼容升级前已登录的旧会话；新登录使用 HttpOnly 会话 Cookie。
const getToken = () => localStorage.getItem('token');

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const value = part.trim();
    if (value.startsWith(prefix)) return decodeURIComponent(value.slice(prefix.length));
  }
  return null;
}

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
  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCookie('xfa_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      const isLoginRequest = endpoint.startsWith("/auth/login");
      const isChangePasswordRequest = endpoint.startsWith("/auth/change-password");
      const isSessionCheck = endpoint.startsWith("/auth/me");
      const error = await response.json().catch(() => ({
        error: isLoginRequest ? "Invalid credentials" : "Unauthorized",
      }));
      if (!isLoginRequest && !isChangePasswordRequest && !isSessionCheck) {
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
    api.post<{ token?: string; session_expires_at: string; user: User }>('/auth/login', { username, password }),
  
  getMe: () => api.get<User>('/auth/me'),

  logout: () => api.post<{ message: string }>('/auth/logout'),
  
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
    const csrf = getCookie('xfa_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
    const response = await fetch(url, { method: 'POST', headers, body: form, credentials: 'include' });
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
  permissions?: string[];
  auth_mode?: 'session' | 'legacy_bearer' | 'unknown';
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

export interface AcademicYear {
  id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  status: 'planning' | 'active' | 'closed';
}

export interface StudentAcademicRecord {
  id: string;
  student_id: string;
  academic_year_id: string;
  academic_year_name?: string;
  school_grade: 9 | 10 | 11 | 12;
  qualification_stage: 'IGCSE' | 'AS' | 'A_LEVEL';
  homeroom?: string | null;
  status: 'planned' | 'active' | 'completed' | 'withdrawn';
  notes?: string | null;
}

export interface AcademicOverview {
  academic_year: AcademicYear | null;
  grade_stages: Array<{ school_grade: number; qualification_stage: string; student_count: number }>;
  pending_requests: number;
  offering_count: number;
  teaching_group_count: number;
  published_schedule: { id: string; name: string; published_at: string } | null;
  verified_source_count: number;
}

export interface OfficialSource {
  id: string;
  publisher: string;
  source_type: string;
  title: string;
  url: string;
  published_on?: string | null;
  checked_at: string;
  access_level: 'public' | 'centre_only';
  status: 'draft' | 'verified' | 'superseded' | 'withdrawn';
  notes?: string | null;
}

export interface CurriculumSpec {
  id: string;
  board: string;
  qualification_level: 'IG' | 'INTERNATIONAL_GCSE' | 'IAS' | 'AS' | 'IAL' | 'A_LEVEL';
  subject_code: string;
  subject_name: string;
  school_display_name?: string | null;
  version_label: string;
  grading_scale?: string | null;
  assessment_model: 'linear' | 'modular' | 'staged' | 'subject_specific';
  source_id?: string | null;
  source_title?: string | null;
  source_url?: string | null;
  source_status?: string | null;
  status: 'draft' | 'active' | 'expired';
  components?: Array<Record<string, unknown>>;
}

export interface CourseOffering {
  id: string;
  academic_year_id: string;
  academic_year_name?: string;
  curriculum_spec_id?: string | null;
  legacy_course_id?: string | null;
  name: string;
  school_grade: 9 | 10 | 11 | 12;
  qualification_stage: 'IGCSE' | 'AS' | 'A_LEVEL';
  term: string;
  course_kind: 'required' | 'elective';
  weekly_periods: number;
  max_students: number;
  status: 'draft' | 'open' | 'closed' | 'archived';
  prerequisites?: string | null;
  board?: string | null;
  subject_code?: string | null;
  version_label?: string | null;
  request_count?: number;
  teaching_group_count?: number;
}

export interface CourseRequestChoice {
  id: string;
  offering_id: string;
  offering_name: string;
  preference: number;
  choice_group: string;
  status: 'requested' | 'approved' | 'waitlisted' | 'rejected';
  school_grade: number;
  qualification_stage: string;
  weekly_periods: number;
  max_students: number;
  board?: string | null;
  subject_code?: string | null;
  assigned_group_id?: string | null;
  assigned_group_code?: string | null;
}

export interface CourseRequest {
  id: string;
  student_id: string;
  student_name?: string;
  english_name?: string;
  academic_year_id: string;
  academic_year_name?: string;
  status: 'draft' | 'submitted' | 'teacher_review' | 'school_review' | 'approved' | 'returned' | 'withdrawn';
  submitted_at?: string | null;
  review_notes?: string | null;
  choices: CourseRequestChoice[];
}

export interface TeachingGroup {
  id: string;
  offering_id: string;
  offering_name: string;
  code: string;
  name: string;
  capacity: number;
  weekly_periods: number;
  consecutive_periods: number;
  school_grade: number;
  qualification_stage: string;
  academic_year_id: string;
  student_count: number;
  teacher_names?: string | null;
}

export interface ScheduleVersion {
  id: string;
  academic_year_id: string;
  name: string;
  status: 'draft' | 'validated' | 'published' | 'archived';
  based_on_id?: string | null;
  creator_name?: string;
  publisher_name?: string | null;
  published_at?: string | null;
  notes?: string | null;
  lesson_count?: number;
  locked_count?: number;
}

export interface TimeSlot {
  id: string;
  academic_year_id: string;
  weekday: number;
  period_no: number;
  starts_at: string;
  ends_at: string;
  label: string;
  is_teaching: 0 | 1;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  capacity: number;
  room_type: string;
  campus?: string | null;
  status: 'active' | 'inactive';
}

export interface TeacherAvailability {
  id: string;
  teacher_user_id: string;
  time_slot_id: string;
  availability: 'available' | 'preferred' | 'unavailable';
  reason?: string | null;
  weekday: number;
  period_no: number;
  label: string;
  starts_at: string;
  ends_at: string;
}

export interface ScheduledLesson {
  id: string;
  schedule_version_id: string;
  teaching_group_id: string;
  time_slot_id: string;
  room_id: string;
  teacher_user_id: string;
  is_locked: 0 | 1;
  source: 'manual' | 'generated';
  weekday: number;
  period_no: number;
  time_label: string;
  starts_at?: string;
  ends_at?: string;
  group_code: string;
  group_name: string;
  offering_name: string;
  school_grade: number;
  qualification_stage: string;
  teacher_name: string;
  room_code?: string | null;
  room_name?: string | null;
  student_count?: number;
}

export interface ScheduleConflictReport {
  hard_conflict_count: number;
  missing_period_count: number;
  can_publish: boolean;
  student_conflicts: Array<Record<string, unknown>>;
  unavailable_teachers: Array<Record<string, unknown>>;
  groups_without_teachers: Array<Record<string, unknown>>;
  rooms_over_capacity: Array<Record<string, unknown>>;
  missing_periods: Array<{ teaching_group_id: string; code: string; name: string; weekly_periods: number; scheduled_periods: number; missing_periods: number }>;
}

export const academicApi = {
  getOverview: (academicYearId?: string) =>
    api.get<AcademicOverview>(`/academic/overview${buildQuery({ academic_year_id: academicYearId })}`),
  getYears: () => api.get<AcademicYear[]>('/academic/academic-years'),
  getStudentRecords: (studentId: string) => api.get<StudentAcademicRecord[]>(`/academic/student-records/${studentId}`),
  getStudentRecordRoster: (academicYearId: string) => api.get<Array<StudentAcademicRecord & { name: string; english_name?: string; enrollment_cohort: string; student_status: string }>>(`/academic/student-records${buildQuery({ academic_year_id: academicYearId })}`),
  saveStudentRecord: (studentId: string, data: Omit<StudentAcademicRecord, 'id' | 'student_id'>) =>
    api.put<StudentAcademicRecord>(`/academic/student-records/${studentId}`, data),
  getSources: () => api.get<OfficialSource[]>('/academic/official-sources'),
  createSource: (data: Omit<OfficialSource, 'id'>) => api.post<OfficialSource>('/academic/official-sources', data),
  getSpecs: () => api.get<CurriculumSpec[]>('/academic/curriculum-specs'),
  createSpec: (data: Omit<CurriculumSpec, 'id' | 'components'>) => api.post<CurriculumSpec>('/academic/curriculum-specs', data),
  getOfferings: (params?: { academic_year_id?: string; school_grade?: string }) =>
    api.get<CourseOffering[]>(`/academic/offerings${buildQuery(params)}`),
  createOffering: (data: {
    academic_year_id: string; curriculum_spec_id?: string | null; legacy_course_id?: string | null;
    name: string; school_grade: number; qualification_stage: 'IGCSE' | 'AS' | 'A_LEVEL';
    term: string; course_kind: 'required' | 'elective'; weekly_periods: number; max_students: number;
    request_open_at?: string | null; request_close_at?: string | null; status: 'draft' | 'open' | 'closed' | 'archived';
    prerequisites?: string | null; notes?: string | null;
  }) => api.post<CourseOffering>('/academic/offerings', data),
  getRequests: (params?: { academic_year_id?: string; student_id?: string; status?: string }) =>
    api.get<CourseRequest[]>(`/academic/course-requests${buildQuery(params)}`),
  saveRequest: (studentId: string, data: { academic_year_id: string; choices: Array<{ offering_id: string; preference: number; choice_group: string; reason?: string }> }) =>
    api.put<{ id: string; status: string }>(`/academic/course-requests/${studentId}`, data),
  submitRequest: (requestId: string) => api.post<{ id: string; status: string }>(`/academic/course-requests/${requestId}/submit`),
  reviewRequest: (requestId: string, data: { status: string; review_notes?: string; choices?: Array<{ id: string; status: string }> }) =>
    api.post<CourseRequest>(`/academic/course-requests/${requestId}/review`, data),
  getGroups: (academicYearId?: string) =>
    api.get<TeachingGroup[]>(`/academic/teaching-groups${buildQuery({ academic_year_id: academicYearId })}`),
  createGroup: (data: { offering_id: string; code: string; name: string; capacity: number; weekly_periods: number; consecutive_periods: number; teacher_user_ids: string[] }) =>
    api.post<TeachingGroup>('/academic/teaching-groups', data),
  getTeachers: () => api.get<User[]>('/academic/teachers'),
  allocateStudent: (groupId: string, data: { student_id: string; source_request_id?: string }) =>
    api.post(`/academic/teaching-groups/${groupId}/students`, data),
  getAuditEvents: () => api.get<Array<Record<string, unknown>>>('/academic/audit-events'),
};

export const schedulingApi = {
  getRooms: () => api.get<Room[]>('/scheduling/rooms'),
  createRoom: (data: Omit<Room, 'id' | 'status'> & { features?: string }) => api.post<Room>('/scheduling/rooms', data),
  getTimeSlots: (academicYearId: string) => api.get<TimeSlot[]>(`/scheduling/time-slots${buildQuery({ academic_year_id: academicYearId })}`),
  bootstrapTimeSlots: (academicYearId: string) => api.post<{ affected: number }>('/scheduling/time-slots/bootstrap', {
    academic_year_id: academicYearId,
    weekdays: [1, 2, 3, 4, 5],
    periods: [
      { period_no: 1, starts_at: '08:00', ends_at: '08:45', label: '第1节' },
      { period_no: 2, starts_at: '08:55', ends_at: '09:40', label: '第2节' },
      { period_no: 3, starts_at: '10:00', ends_at: '10:45', label: '第3节' },
      { period_no: 4, starts_at: '10:55', ends_at: '11:40', label: '第4节' },
      { period_no: 5, starts_at: '13:00', ends_at: '13:45', label: '第5节' },
      { period_no: 6, starts_at: '13:55', ends_at: '14:40', label: '第6节' },
      { period_no: 7, starts_at: '14:50', ends_at: '15:35', label: '第7节' },
      { period_no: 8, starts_at: '15:45', ends_at: '16:30', label: '第8节' },
    ],
  }),
  getAvailability: (teacherUserId?: string) =>
    api.get<TeacherAvailability[]>(`/scheduling/availability${buildQuery({ teacher_user_id: teacherUserId })}`),
  saveAvailability: (entries: Array<{ time_slot_id: string; availability: 'available' | 'preferred' | 'unavailable'; reason?: string | null }>, teacherUserId?: string) =>
    api.put<{ teacher_user_id: string; updated: number }>('/scheduling/availability', { teacher_user_id: teacherUserId, entries }),
  getVersions: (academicYearId: string) => api.get<ScheduleVersion[]>(`/scheduling/versions${buildQuery({ academic_year_id: academicYearId })}`),
  createVersion: (data: { academic_year_id: string; name: string; based_on_id?: string; notes?: string }) => api.post<ScheduleVersion>('/scheduling/versions', data),
  getGrid: (versionId: string) => api.get<{ version: ScheduleVersion; lessons: ScheduledLesson[]; report: ScheduleConflictReport }>(`/scheduling/versions/${versionId}/grid`),
  generate: (versionId: string) => api.post<{ generated_count: number; unplaced: Array<Record<string, unknown>>; report: ScheduleConflictReport }>(`/scheduling/versions/${versionId}/generate`),
  getConflicts: (versionId: string) => api.get<ScheduleConflictReport>(`/scheduling/versions/${versionId}/conflicts`),
  publish: (versionId: string) => api.post<ScheduleVersion>(`/scheduling/versions/${versionId}/publish`),
  getPublishedMine: (academicYearId: string) => api.get<{ version: ScheduleVersion | null; lessons: ScheduledLesson[] }>(`/scheduling/published/me${buildQuery({ academic_year_id: academicYearId })}`),
  updateLesson: (versionId: string, lessonId: string, data: { teaching_group_id: string; time_slot_id: string; room_id: string; teacher_user_id: string; is_locked: boolean }) =>
    api.put<ScheduledLesson>(`/scheduling/versions/${versionId}/lessons/${lessonId}`, data),
};

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
