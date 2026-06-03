import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  studentApi, courseApi, universityApi,
  type Student, type StudentDashboard, type Course, type University, type LanguageScore, type Task, type CourseUnit,
  type UniversityProgram, type StandardizedTest,
} from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useGrade } from '@/contexts/GradeContext';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X, BookOpen, Languages, School, ClipboardList, CheckCircle2, ChevronDown, ChevronUp, Calendar, Download, Flag } from 'lucide-react';
import { ExamSessionPlanner } from '@/sections/ExamSessionPlanner';
import { UsRequirementsPanel } from '@/sections/UsRequirementsPanel';
import {
  buildCohortSelectOptions,
  formatCohortDisplay,
  DEFAULT_CLASS_SECTIONS,
  CLASS_TRACK_OPTIONS,
  MIN_ENROLLMENT_YEAR,
  yearToCanonicalGrade,
  type ClassTrack,
} from '@/lib/cohortLabels';

const TAB_KEYS = ['info', 'grades', 'sessions', 'universities', 'tests', 'us-needs', 'tasks'] as const;
const STUDENT_READ_TAB_KEYS = ['info', 'grades'] as const;
const TEACHER_TAB_KEYS = ['info', 'grades', 'sessions'] as const;

const NONE = '__none__';

function classSectionsForSelect(current?: string | null): string[] {
  const s = (current || '').trim();
  const base: string[] = [...DEFAULT_CLASS_SECTIONS];
  if (s && !base.includes(s)) return [s, ...base];
  return base;
}

type UniDetailFormState = {
  application_type: 'reach' | 'target' | 'safety';
  status: 'interested' | 'applying' | 'submitted' | 'offer' | 'rejected' | 'declined';
  program_id: string;
  lang_score_id: string;
  std_test_id: string;
  offer_kind: 'unconditional' | 'conditional';
  u_ddl: string;
  u_other: string;
  c_academic: string;
  c_language: string;
  c_deposit: string;
  c_ddl: string;
  c_other: string;
};

function emptyUniDetailForm(): UniDetailFormState {
  return {
    application_type: 'target',
    status: 'interested',
    program_id: NONE,
    lang_score_id: NONE,
    std_test_id: NONE,
    offer_kind: 'unconditional',
    u_ddl: '',
    u_other: '',
    c_academic: '',
    c_language: '',
    c_deposit: '',
    c_ddl: '',
    c_other: '',
  };
}

export function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, canEditSchoolData: canEdit } = useAuth();
  const readOnlyStudent = user?.role === 'student';
  const visibleTabKeys = readOnlyStudent
    ? STUDENT_READ_TAB_KEYS
    : user?.role === 'teacher'
      ? TEACHER_TAB_KEYS
      : TAB_KEYS;
  // 与全局年级状态保持一致（此页目前不直接用）
  useGrade();
  const [student, setStudent] = useState<Student | null>(null);
  const [dashboardData, setDashboardData] = useState<StudentDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // 当前 Tab：从 URL ?tab= 读取，保存后不跳转
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<string>(() =>
    tabFromUrl && TAB_KEYS.includes(tabFromUrl as any) ? tabFromUrl : 'info'
  );

  // 编辑基本信息
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Student>>({});

  // 成绩编辑
  const [editingGrade, setEditingGrade] = useState<any>(null);
  const [gradeForm, setGradeForm] = useState({
    internal_grade: '', internal_score: 0,
    mock_grade: '', mock_score: 0,
    final_grade: '', final_score: 0,
  });

  // 选课
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // 语言成绩
  const [showLangDialog, setShowLangDialog] = useState(false);
  const [editingLangScore, setEditingLangScore] = useState<LanguageScore | null>(null);
  const [langForm, setLangForm] = useState({
    test_type: 'IELTS' as 'IELTS' | 'TOEFL' | 'PTE' | 'Duolingo', overall_score: 0,
    listening_score: 0, reading_score: 0, writing_score: 0, speaking_score: 0,
    component_scores: null as null | Record<string, number>,
    test_date: '', is_best_score: false,
  });
  const [showLangMatchDialog, setShowLangMatchDialog] = useState(false);
  const [langMatchScoreId, setLangMatchScoreId] = useState<string>('');
  const [langMatchUniId, setLangMatchUniId] = useState<string>(NONE);

  const parseComponentScores = (raw: any): Record<string, number> | null => {
    if (!raw) return null;
    if (typeof raw === 'object') return raw as Record<string, number>;
    if (typeof raw !== 'string') return null;
    try { return JSON.parse(raw) as Record<string, number>; } catch { return null; }
  };

  // 目标院校
  const [showUniDialog, setShowUniDialog] = useState(false);
  const [allUniversities, setAllUniversities] = useState<University[]>([]);
  const [selectedUniId, setSelectedUniId] = useState('');
  const [selectedUniType, setSelectedUniType] = useState<'reach' | 'target' | 'safety'>('target');
  const [uniProgramsForAdd, setUniProgramsForAdd] = useState<UniversityProgram[]>([]);
  const [selectedProgramIdForAdd, setSelectedProgramIdForAdd] = useState(NONE);
  const [editingUniStatus, setEditingUniStatus] = useState<any>(null);
  const [uniProgramsEdit, setUniProgramsEdit] = useState<UniversityProgram[]>([]);
  const [uniDetailForm, setUniDetailForm] = useState<UniDetailFormState>(() => emptyUniDetailForm());

  // 待办任务
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    category: 'academic' as 'academic' | 'language' | 'standardized' | 'extracurricular' | 'application',
    priority: 'medium' as 'urgent' | 'high' | 'medium' | 'low',
    deadline: '',
  });

  // 单元成绩
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set());
  const [courseUnitsMap, setCourseUnitsMap] = useState<Record<string, CourseUnit[]>>({});
  const [showUnitGradeDialog, setShowUnitGradeDialog] = useState(false);
  const [unitGradeCourseId, setUnitGradeCourseId] = useState('');
  const [unitGradeForm, setUnitGradeForm] = useState({
    unit_code: '', unit_name: '', score: 0, max_score: 100, grade: '', exam_date: '',
    exam_type: 'final' as 'internal' | 'final' | 'retake' | 'mock',
  });

  const normalizeExamType = (t: any): 'internal' | 'final' => {
    if (t === 'final' || t === 'retake') return 'final';
    return 'internal';
  };

  const isFinalLike = (t: any) => normalizeExamType(t) === 'final';

  useEffect(() => { if (id) fetchStudentData(); }, [id]);

  useEffect(() => {
    if (!showUniDialog || !selectedUniId) {
      setUniProgramsForAdd([]);
      return;
    }
    let cancelled = false;
    universityApi.getPrograms(selectedUniId).then((p) => {
      if (!cancelled) setUniProgramsForAdd(p);
    }).catch(() => {
      if (!cancelled) setUniProgramsForAdd([]);
    });
    return () => { cancelled = true; };
  }, [showUniDialog, selectedUniId]);

  // URL 上的 tab 变化时同步到 state（如从「查看完整规划」跳转进来）
  useEffect(() => {
    const t = searchParams.get('tab');
    if (!t || !TAB_KEYS.includes(t as (typeof TAB_KEYS)[number])) return;
    if (readOnlyStudent && !STUDENT_READ_TAB_KEYS.includes(t as (typeof STUDENT_READ_TAB_KEYS)[number])) {
      setActiveTab('info');
      return;
    }
    setActiveTab(t);
  }, [searchParams, readOnlyStudent]);

  useEffect(() => {
    if (!readOnlyStudent || !id) return;
    const t = searchParams.get('tab');
    if (t && !STUDENT_READ_TAB_KEYS.includes(t as (typeof STUDENT_READ_TAB_KEYS)[number])) {
      navigate(`/students/${id}?tab=info`, { replace: true });
    }
  }, [readOnlyStudent, id, searchParams, navigate]);

  /** 必须在任意 early return 之前调用（Rules of Hooks） */
  const classSectionOptions = useMemo(
    () => classSectionsForSelect(isEditing ? editForm.school : student?.school),
    [isEditing, editForm.school, student?.school]
  );

  const fetchStudentData = async () => {
    try {
      setIsLoading(true);
      setError('');
      const [studentData, dashboard] = await Promise.all([
        studentApi.getById(id!),
        studentApi.getDashboard(id!),
      ]);
      setStudent(studentData);
      setDashboardData(dashboard);
      setEditForm(studentData);
      try { setTasks(await studentApi.getTasks(id!)); } catch { setTasks([]); }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  // === 基本信息 ===
  const handleSaveStudent = async () => {
    try {
      const updated = await studentApi.update(id!, editForm);
      setStudent(updated);
      setEditForm(updated);
      setIsEditing(false);
      try {
        const dashboard = await studentApi.getDashboard(id!);
        setDashboardData(dashboard);
      } catch {
        /* 仪表盘刷新失败时仍以本次保存返回为准 */
      }
      try {
        setTasks(await studentApi.getTasks(id!));
      } catch {
        /* ignore */
      }
    } catch (err) { alert(err instanceof Error ? err.message : '保存失败'); }
  };

  // === 成绩 ===
  const handleSaveGrade = async () => {
    if (!editingGrade) return;
    try {
      await courseApi.updateGrades(editingGrade.course_id, id!, gradeForm);
      setEditingGrade(null);
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '保存成绩失败'); }
  };

  // === 选课 ===
  const handleOpenEnroll = async () => {
    try {
      // 默认只展示：当前学生年级的课程（按 20XX级 管理）
      const courses = await courseApi.getAll({
        grade_level: student?.grade || undefined,
      });
      const enrolledIds = new Set(dashboardData?.courses.map(c => c.course_id) || []);
      setAvailableCourses(courses.filter(c => !enrolledIds.has(c.id)));
      setSelectedCourseId('');
      setShowEnrollDialog(true);
    } catch (err) { alert('加载课程列表失败'); }
  };

  const handleEnroll = async () => {
    if (!selectedCourseId) { alert('请选择课程'); return; }
    try {
      await courseApi.enrollStudent(selectedCourseId, id!);
      setShowEnrollDialog(false);
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '选课失败'); }
  };

  // === 语言成绩 ===
  const handleOpenLangAdd = () => {
    setEditingLangScore(null);
    setLangForm({
      test_type: 'IELTS', overall_score: 0,
      listening_score: 0, reading_score: 0, writing_score: 0, speaking_score: 0,
      component_scores: null,
      test_date: new Date().toISOString().slice(0, 10), is_best_score: false,
    });
    setShowLangDialog(true);
  };

  const handleOpenLangEdit = (score: LanguageScore) => {
    setEditingLangScore(score);
    setLangForm({
      test_type: score.test_type, overall_score: score.overall_score,
      listening_score: score.listening_score || 0, reading_score: score.reading_score || 0,
      writing_score: score.writing_score || 0, speaking_score: score.speaking_score || 0,
      component_scores: parseComponentScores((score as any).component_scores),
      test_date: score.test_date || '', is_best_score: !!score.is_best_score,
    });
    setShowLangDialog(true);
  };

  const handleSaveLang = async () => {
    if (!langForm.overall_score || !langForm.test_date) { alert('请填写总分和考试日期'); return; }
    try {
      const payload: any = { ...langForm };
      if (payload.test_type !== 'Duolingo') {
        payload.component_scores = null;
      } else {
        payload.listening_score = null;
        payload.reading_score = null;
        payload.writing_score = null;
        payload.speaking_score = null;
      }
      if (editingLangScore) {
        await studentApi.updateLanguageScore(id!, editingLangScore.id, payload);
      } else {
        await studentApi.addLanguageScore(id!, payload);
      }
      setShowLangDialog(false);
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '保存失败'); }
  };

  const openLangMatchDialog = (scoreId: string) => {
    setLangMatchScoreId(scoreId);
    setLangMatchUniId(NONE);
    setShowLangMatchDialog(true);
  };

  const handleSaveLangMatch = async () => {
    if (!langMatchScoreId) return;
    if (!dashboardData) return;
    if (langMatchUniId === NONE) { alert('请选择院校'); return; }
    const uni = dashboardData.targetUniversities.find((u: any) => u.university_id === langMatchUniId);
    if (!uni) { alert('院校不存在'); return; }
    const prefs: Record<string, unknown> = { ...(uni.matching_prefs || {}) };
    prefs.language_score_id = langMatchScoreId;
    try {
      await universityApi.updateStudentUni(id!, uni.university_id, { matching_prefs: prefs } as any);
      setShowLangMatchDialog(false);
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '保存失败'); }
  };

  const handleDeleteLang = async (scoreId: string) => {
    if (!confirm('确定删除该成绩记录？')) return;
    try {
      await studentApi.deleteLanguageScore(id!, scoreId);
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  // === 目标院校 ===
  const handleOpenUniAdd = async () => {
    try {
      const unis = await universityApi.getAll();
      const existingIds = new Set(dashboardData?.targetUniversities.map(u => u.university_id) || []);
      setAllUniversities(unis.filter(u => !existingIds.has(u.id)));
      setSelectedUniId('');
      setSelectedProgramIdForAdd(NONE);
      setSelectedUniType('target');
      setShowUniDialog(true);
    } catch (err) { alert('加载院校列表失败'); }
  };

  const handleAddUni = async () => {
    if (!selectedUniId) { alert('请选择院校'); return; }
    try {
      await universityApi.addToStudent(id!, selectedUniId, selectedUniType, {
        program_id: selectedProgramIdForAdd !== NONE ? selectedProgramIdForAdd : undefined,
      });
      setShowUniDialog(false);
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '添加失败'); }
  };

  const handleOpenUniStatus = async (uni: any) => {
    setEditingUniStatus(uni);
    try {
      const progs = await universityApi.getPrograms(uni.university_id);
      setUniProgramsEdit(progs);
    } catch {
      setUniProgramsEdit([]);
    }
    const mp = uni.matching_prefs || {};
    const od = (uni.offer_detail || {}) as Record<string, unknown>;
    const unc = (od.unconditional && typeof od.unconditional === 'object')
      ? (od.unconditional as Record<string, string>)
      : {};
    const cond = (od.conditional && typeof od.conditional === 'object')
      ? (od.conditional as Record<string, string>)
      : {};
    setUniDetailForm({
      application_type: uni.application_type || 'target',
      status: uni.status || 'interested',
      program_id: uni.program_id || NONE,
      lang_score_id: mp.language_score_id || NONE,
      std_test_id: mp.standardized_test_id || NONE,
      offer_kind: od.kind === 'conditional' ? 'conditional' : 'unconditional',
      u_ddl: String(unc.ddl || ''),
      u_other: String(unc.other || ''),
      c_academic: String(cond.academic || ''),
      c_language: String(cond.language || ''),
      c_deposit: String(cond.deposit || ''),
      c_ddl: String(cond.ddl || ''),
      c_other: String(cond.other || ''),
    });
  };

  const handleSaveUniStatus = async () => {
    if (!editingUniStatus) return;
    try {
      const prefs: Record<string, string> = {};
      if (uniDetailForm.lang_score_id !== NONE) prefs.language_score_id = uniDetailForm.lang_score_id;
      if (uniDetailForm.std_test_id !== NONE) prefs.standardized_test_id = uniDetailForm.std_test_id;

      const payload: Record<string, unknown> = {
        application_type: uniDetailForm.application_type,
        status: uniDetailForm.status,
        program_id: uniDetailForm.program_id === NONE ? null : uniDetailForm.program_id,
        matching_prefs: prefs,
      };

      if (uniDetailForm.status === 'offer') {
        if (uniDetailForm.offer_kind === 'unconditional') {
          payload.offer_detail = {
            kind: 'unconditional',
            unconditional: {
              ...(uniDetailForm.u_ddl.trim() ? { ddl: uniDetailForm.u_ddl.trim() } : {}),
              ...(uniDetailForm.u_other.trim() ? { other: uniDetailForm.u_other.trim() } : {}),
            },
          };
        } else {
          payload.offer_detail = {
            kind: 'conditional',
            conditional: {
              ...(uniDetailForm.c_academic.trim() ? { academic: uniDetailForm.c_academic.trim() } : {}),
              ...(uniDetailForm.c_language.trim() ? { language: uniDetailForm.c_language.trim() } : {}),
              ...(uniDetailForm.c_deposit.trim() ? { deposit: uniDetailForm.c_deposit.trim() } : {}),
              ...(uniDetailForm.c_ddl.trim() ? { ddl: uniDetailForm.c_ddl.trim() } : {}),
              ...(uniDetailForm.c_other.trim() ? { other: uniDetailForm.c_other.trim() } : {}),
            },
          };
        }
      }

      await universityApi.updateStudentUni(id!, editingUniStatus.university_id, payload as any);
      setEditingUniStatus(null);
      setUniDetailForm(emptyUniDetailForm());
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '更新失败'); }
  };

  const handleRemoveUni = async (universityId: string) => {
    if (!confirm('确定移除该目标院校？')) return;
    try {
      await universityApi.removeFromStudent(id!, universityId);
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '移除失败'); }
  };

  // === 待办任务 ===
  const handleOpenTaskAdd = () => {
    setEditingTaskId(null);
    setTaskForm({ title: '', description: '', category: 'academic', priority: 'medium', deadline: '' });
    setShowTaskDialog(true);
  };

  const handleOpenTaskEdit = (t: Task) => {
    setEditingTaskId(t.id);
    setTaskForm({
      title: t.title, description: t.description || '',
      category: (t.category as any) || 'academic',
      priority: (t.priority as any) || 'medium',
      deadline: t.deadline || '',
    });
    setShowTaskDialog(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) { alert('请填写任务标题'); return; }
    try {
      if (editingTaskId) {
        await studentApi.updateTask(id!, editingTaskId, taskForm);
      } else {
        await studentApi.createTask(id!, taskForm);
      }
      setShowTaskDialog(false);
      setTasks(await studentApi.getTasks(id!));
    } catch (err) { alert(err instanceof Error ? err.message : '操作失败'); }
  };

  const handleToggleTask = async (t: Task) => {
    const newStatus = t.status === 'completed' ? 'pending' : 'completed';
    try {
      await studentApi.updateTask(id!, t.id, { status: newStatus });
      setTasks(await studentApi.getTasks(id!));
    } catch (err) { alert(err instanceof Error ? err.message : '更新失败'); }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('确定删除该任务？')) return;
    try {
      await studentApi.deleteTask(id!, taskId);
      setTasks(await studentApi.getTasks(id!));
    } catch (err) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  // === 单元成绩 ===
  const toggleCourseExpand = async (courseId: string) => {
    const next = new Set(expandedCourses);
    if (next.has(courseId)) {
      next.delete(courseId);
    } else {
      next.add(courseId);
      if (!courseUnitsMap[courseId]) {
        try {
          const units = await courseApi.getUnits(courseId);
          setCourseUnitsMap(prev => ({ ...prev, [courseId]: units }));
        } catch { /* ignore */ }
      }
    }
    setExpandedCourses(next);
  };

  const handleOpenUnitGradeAdd = (courseId: string, examType: string = 'final') => {
    setUnitGradeCourseId(courseId);
    const units = courseUnitsMap[courseId] || [];
    const normalized = normalizeExamType(examType);
    const initialType: 'internal' | 'final' | 'retake' =
      normalized === 'final' ? ((examType === 'retake' ? 'retake' : 'final') as any) : 'internal';
    setUnitGradeForm({
      unit_code: normalized === 'final' ? (units[0]?.unit_code || '') : '',
      unit_name: normalized === 'final' ? (units[0]?.unit_name || '') : '',
      score: 0,
      max_score: normalized === 'final' ? (units[0]?.max_score || 100) : 100,
      grade: '', exam_date: new Date().toISOString().slice(0, 10),
      exam_type: initialType as any,
    });
    setShowUnitGradeDialog(true);
  };

  const handleUnitSelect = (unitCode: string) => {
    const units = courseUnitsMap[unitGradeCourseId] || [];
    const selected = units.find(u => u.unit_code === unitCode);
    setUnitGradeForm(prev => ({
      ...prev,
      unit_code: unitCode,
      unit_name: selected?.unit_name || unitCode,
      max_score: selected?.max_score || 100,
    }));
  };

  const handleSaveUnitGrade = async () => {
    if (isFinalLike(unitGradeForm.exam_type) && !unitGradeForm.unit_code) {
      alert('请选择单元');
      return;
    }
    try {
      await courseApi.addUnitGrade(unitGradeCourseId, id!, {
        ...unitGradeForm,
        exam_type: isFinalLike(unitGradeForm.exam_type) ? unitGradeForm.exam_type : 'internal',
      });
      setShowUnitGradeDialog(false);
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '保存单元成绩失败'); }
  };

  const handleDeleteUnitGrade = async (unitGradeId: string) => {
    if (!confirm('确定删除该单元成绩？')) return;
    try {
      await courseApi.deleteUnitGrade(unitGradeId);
      fetchStudentData();
    } catch (err) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  // === 渲染 ===
  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (error || !student || !dashboardData) return (
    <div className="text-center py-8 text-red-600">{error || '加载失败'}
      <Button variant="outline" className="ml-4" onClick={() => navigate('/students')}>返回列表</Button>
    </div>
  );

  const gradeOptions = ['', 'A*', 'A', 'B', 'C', 'D', 'E', 'U'];
  const statusLabels: Record<string, string> = {
    interested: '感兴趣', applying: '申请中', submitted: '已提交',
    offer: '已录取', rejected: '被拒', declined: '放弃',
  };
  const typeLabels: Record<string, string> = { reach: '冲刺', target: '目标', safety: '保底' };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/students')}>
            <ArrowLeft className="h-4 w-4 mr-2" />返回列表
          </Button>
          <h1 className="text-2xl font-bold">{student.name}</h1>
          <Badge variant="secondary">{formatCohortDisplay(student.grade)}</Badge>
          <span className="text-sm text-slate-500">
            {CLASS_TRACK_OPTIONS.find((o) => o.value === (student.class_track ?? 'international'))?.label ?? '—'}
            {student.school ? ` · ${student.school}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(readOnlyStudent || canEdit) && (
            <Button
              variant="outline"
              onClick={() => navigate(`/students/${id}/transcript`)}
            >
              <Download className="h-4 w-4 mr-2" />下载成绩单
            </Button>
          )}
          {canEdit && (
            <>
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => { setIsEditing(false); setEditForm(student); }}>
                    <X className="h-4 w-4 mr-2" />取消
                  </Button>
                  <Button onClick={handleSaveStudent}><Save className="h-4 w-4 mr-2" />保存</Button>
                </>
              ) : (
                <Button onClick={() => setIsEditing(true)}><Edit2 className="h-4 w-4 mr-2" />编辑信息</Button>
              )}
            </>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v);
          navigate(`/students/${id}?tab=${v}`, { replace: true });
        }}
        className="w-full"
      >
        <TabsList
          className="grid w-full gap-0.5 h-auto p-1"
          style={{
            gridTemplateColumns: `repeat(${visibleTabKeys.length}, minmax(0, 1fr))`,
          }}
        >
          {visibleTabKeys.map((k) => {
            if (k === 'info') {
              return (
                <TabsTrigger key={k} value="info" className="text-xs sm:text-sm px-1.5">
                  基本信息
                </TabsTrigger>
              );
            }
            if (k === 'grades') {
              return (
                <TabsTrigger key={k} value="grades" className="text-xs sm:text-sm px-1.5">
                  成绩管理
                </TabsTrigger>
              );
            }
            if (k === 'sessions') {
              return (
                <TabsTrigger key={k} value="sessions" className="flex items-center justify-center gap-0.5 text-xs sm:text-sm px-1.5">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />考季规划
                </TabsTrigger>
              );
            }
            if (k === 'universities') {
              return (
                <TabsTrigger key={k} value="universities" className="text-xs sm:text-sm px-1.5">
                  目标院校
                </TabsTrigger>
              );
            }
            if (k === 'tests') {
              return (
                <TabsTrigger key={k} value="tests" className="text-xs sm:text-sm px-1.5">
                  语言成绩
                </TabsTrigger>
              );
            }
            if (k === 'us-needs') {
              return (
                <TabsTrigger key={k} value="us-needs" className="flex items-center justify-center gap-0.5 text-xs sm:text-sm px-1.5">
                  <Flag className="h-3.5 w-3.5 shrink-0" />美本需求
                </TabsTrigger>
              );
            }
            return (
              <TabsTrigger key={k} value="tasks" className="text-xs sm:text-sm px-1.5">
                待办任务{tasks.filter((t) => t.status !== 'completed').length > 0 && ` (${tasks.filter((t) => t.status !== 'completed').length})`}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ===== 基本信息 ===== */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>学生信息</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>中文姓名</Label>
                  {isEditing ? (
                    <Input value={editForm.name ?? ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  ) : (
                    <p className="text-sm py-2">{student.name || '--'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>英文姓名</Label>
                  {isEditing ? (
                    <Input value={editForm.english_name ?? ''} onChange={(e) => setEditForm({ ...editForm, english_name: e.target.value })} />
                  ) : (
                    <p className="text-sm py-2">{student.english_name || '--'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>入学届</Label>
                  {isEditing ? (
                    <Select
                      value={editForm.grade ?? student.grade ?? yearToCanonicalGrade(MIN_ENROLLMENT_YEAR)}
                      onValueChange={(v) => setEditForm({ ...editForm, grade: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {buildCohortSelectOptions().map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm py-2">{formatCohortDisplay(student.grade) || '--'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>班级类型</Label>
                  {isEditing ? (
                    <Select
                      value={(editForm.class_track ?? student.class_track ?? 'international') as ClassTrack}
                      onValueChange={(v) => setEditForm({ ...editForm, class_track: v as ClassTrack })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CLASS_TRACK_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm py-2">
                      {CLASS_TRACK_OPTIONS.find((o) => o.value === (student.class_track ?? 'international'))?.label ?? '--'}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>学制（A-Level）</Label>
                  {isEditing ? (
                    <Select
                      value={String((editForm as any).study_duration || 2)}
                      onValueChange={(v) => setEditForm({ ...editForm, study_duration: (parseInt(v) as 2 | 3) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2年制</SelectItem>
                        <SelectItem value="3">3年制</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm py-2">{(student as any).study_duration || 2}年制</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>班级</Label>
                  {isEditing ? (
                    <Select
                      value={
                        (editForm.school ?? student.school)?.trim() ||
                        classSectionOptions[0] ||
                        DEFAULT_CLASS_SECTIONS[0]
                      }
                      onValueChange={(v) => setEditForm({ ...editForm, school: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {classSectionOptions.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm py-2">{student.school || '--'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>预毕业年月</Label>
                  {isEditing ? (
                    <Input
                      type="month"
                      value={(editForm as any).expected_graduation_month || ''}
                      onChange={(e) =>
                        setEditForm({ ...editForm, expected_graduation_month: e.target.value })
                      }
                    />
                  ) : (
                    <p className="text-sm py-2">{(student as any).expected_graduation_month || '--'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>微信号</Label>
                  {isEditing ? (
                    <Input value={editForm.wechat ?? ''} onChange={(e) => setEditForm({ ...editForm, wechat: e.target.value })} />
                  ) : (
                    <p className="text-sm py-2">{student.wechat || '--'}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>电话</Label>
                  {isEditing ? (
                    <Input value={editForm.phone ?? ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                  ) : (
                    <p className="text-sm py-2">{student.phone || '--'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>邮箱</Label>
                  {isEditing ? (
                    <Input type="email" value={editForm.email ?? ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  ) : (
                    <p className="text-sm py-2">{student.email || '--'}</p>
                  )}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                入学届在库内为「YYYY级」，界面展示为「YY级」。调整入学届或学制后，系统会重算预毕业月份；不会改动已录入的考试与任务日期。
              </p>
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">家长信息</h4>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: '家长姓名', field: 'parent_name' },
                    { label: '家长电话', field: 'parent_phone' },
                    { label: '家长邮箱', field: 'parent_email' },
                  ].map(({ label, field }) => (
                    <div key={field} className="space-y-2">
                      <Label>{label}</Label>
                      {isEditing ? (
                        <Input value={(editForm as any)[field] ?? ''} onChange={(e) => setEditForm({ ...editForm, [field]: e.target.value })} />
                      ) : (
                        <p className="text-sm py-2">{(student as any)[field] || '--'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== 成绩管理 ===== */}
        <TabsContent value="grades" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />成绩管理</CardTitle>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={handleOpenEnroll}>
                  <Plus className="h-4 w-4 mr-2" />添加选课
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dashboardData.courses.map((course) => {
                  const isExpanded = expandedCourses.has(course.course_id);
                  const configuredUnits = courseUnitsMap[course.course_id] || [];
                  const allUnits = course.unitGrades || [];
                  const finalUnits = allUnits.filter((u: any) => normalizeExamType(u.exam_type) === 'final');
                  const internalUnits = allUnits
                    .filter((u: any) => normalizeExamType(u.exam_type) === 'internal')
                    .sort((a: any, b: any) => (b.exam_date || '').localeCompare(a.exam_date || ''));
                  const recentInternals = internalUnits.slice(0, 2);

                  const computedFinalScore = finalUnits.length > 0
                    ? Math.round(finalUnits.reduce((sum: number, u: any) => sum + (u.score || 0), 0) / finalUnits.reduce((sum: number, u: any) => sum + (u.max_score || 100), 0) * 100)
                    : null;
                  const totalFinalUnits = configuredUnits.length || finalUnits.length;
                  const finishedFinalUnits = finalUnits.length;

                  const internalAvg = recentInternals.length > 0
                    ? Math.round(recentInternals.reduce((sum: number, u: any) => sum + ((u.score / (u.max_score || 100)) * 100), 0) / recentInternals.length)
                    : null;

                  return (
                    <div key={course.id} className="border rounded-lg">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-semibold">{course.course_name || '未知课程'}</h4>
                            <p className="text-sm text-slate-500">{course.board} {course.subject_code && `· ${course.subject_code}`}</p>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => toggleCourseExpand(course.course_id)}>
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            <span className="ml-1 text-xs">详情</span>
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-primary/10 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-primary">校内成绩</span>
                              <span className="text-[10px] text-primary">最近{recentInternals.length}次均分</span>
                            </div>
                            <span className={`text-xl font-bold ${internalAvg !== null ? (internalAvg >= 80 ? 'text-green-600' : internalAvg >= 60 ? 'text-primary' : 'text-orange-600') : 'text-slate-400'}`}>
                              {internalAvg !== null ? internalAvg : '--'}
                            </span>
                            {recentInternals.length > 0 && (
                              <div className="mt-1 flex gap-1.5">
                                {recentInternals.map((u: any, i: number) => (
                                  <span key={i} className="text-[10px] text-primary bg-primary/15 px-1.5 py-0.5 rounded">
                                    {(u.unit_name || u.unit_code || '校内考试')}: {u.score}/{u.max_score}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="bg-green-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-green-700">实考成绩</span>
                              <span className="text-[10px] text-green-500">
                                {finishedFinalUnits}/{totalFinalUnits}单元
                              </span>
                            </div>
                            <span className={`text-xl font-bold ${computedFinalScore !== null ? (computedFinalScore >= 80 ? 'text-green-600' : computedFinalScore >= 60 ? 'text-primary' : 'text-orange-600') : 'text-slate-400'}`}>
                              {computedFinalScore !== null ? computedFinalScore : '--'}
                            </span>
                            {computedFinalScore !== null && internalAvg !== null && (
                              <div className="mt-1">
                                {(() => {
                                  const dev = computedFinalScore - internalAvg;
                                  return (
                                    <span className={`text-[10px] font-medium ${dev >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      偏差: {dev >= 0 ? '+' : ''}{dev}分
                                    </span>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t bg-slate-50 p-4 space-y-4">
                          {configuredUnits.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1.5">课程单元配置：</p>
                              <div className="flex flex-wrap gap-1.5">
                                {configuredUnits.map(u => {
                                  const hasFinal = finalUnits.some((ug: any) => ug.unit_code === u.unit_code);
                                  return (
                                    <span key={u.id} className={`text-xs px-2 py-0.5 rounded ${hasFinal ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                                      {u.unit_code}: {u.unit_name} ({u.max_score}分) {hasFinal ? '✓' : ''}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 实考单元成绩 */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-medium text-green-700">
                                实考单元成绩 {finalUnits.length > 0 ? `(${finalUnits.length}项)` : ''}
                              </h5>
                              {canEdit && (
                                <Button variant="outline" size="sm" onClick={() => handleOpenUnitGradeAdd(course.course_id, 'final')}>
                                  <Plus className="h-3.5 w-3.5 mr-1" />添加实考成绩
                                </Button>
                              )}
                            </div>
                            {finalUnits.length > 0 ? (
                              <div className="space-y-2">
                                {finalUnits.map((unit: any) => (
                                  <div key={unit.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-200">
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium text-sm">{unit.unit_code || unit.unit_name}</span>
                                      {unit.unit_name && unit.unit_code && <span className="text-xs text-slate-400">({unit.unit_name})</span>}
                                      <Badge variant="outline" className="text-xs">{unit.score}/{unit.max_score || 100}</Badge>
                                      {unit.exam_type === 'retake' && (
                                        <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0">补考</Badge>
                                      )}
                                      {unit.grade && (
                                        <Badge className={`text-xs ${
                                          unit.grade === 'A*' ? 'bg-purple-100 text-purple-700' :
                                          unit.grade === 'A' ? 'bg-green-100 text-green-700' :
                                          unit.grade === 'B' ? 'bg-primary/15 text-primary' :
                                          'bg-slate-100 text-slate-600'
                                        }`}>{unit.grade}</Badge>
                                      )}
                                      {unit.exam_date && <span className="text-xs text-slate-400">{unit.exam_date}</span>}
                                    </div>
                                    {canEdit && (
                                      <Button variant="ghost" size="sm" className="text-red-500 h-7 w-7 p-0" onClick={() => handleDeleteUnitGrade(unit.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                {computedFinalScore !== null && (
                                  <div className="text-xs text-right text-green-600 font-medium pt-1">
                                    加权合成得分：{computedFinalScore} / 100
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400 text-center py-2">暂无实考成绩</p>
                            )}
                          </div>

                          {/* 校内考试成绩 */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="text-sm font-medium text-primary">
                                校内考试成绩 {internalUnits.length > 0 ? `(共${internalUnits.length}次)` : ''}
                              </h5>
                              {canEdit && (
                                <Button variant="outline" size="sm" onClick={() => handleOpenUnitGradeAdd(course.course_id, 'internal')}>
                                  <Plus className="h-3.5 w-3.5 mr-1" />添加校内成绩
                                </Button>
                              )}
                            </div>
                            {internalUnits.length > 0 ? (
                              <div className="space-y-2">
                                {internalUnits.map((unit: any, idx: number) => (
                                  <div key={unit.id} className={`flex items-center justify-between bg-white rounded-lg p-3 border ${idx < 2 ? 'border-primary/25' : 'border-slate-200 opacity-60'}`}>
                                    <div className="flex items-center gap-3">
                                      <span className="font-medium text-sm">{unit.unit_code || unit.unit_name}</span>
                                      {unit.unit_name && unit.unit_code && <span className="text-xs text-slate-400">({unit.unit_name})</span>}
                                      <Badge variant="outline" className="text-xs">{unit.score}/{unit.max_score || 100}</Badge>
                                      {unit.exam_type === 'mock' && (
                                        <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0">模考</Badge>
                                      )}
                                      {unit.grade && (
                                        <Badge className={`text-xs ${
                                          unit.grade === 'A*' ? 'bg-purple-100 text-purple-700' :
                                          unit.grade === 'A' ? 'bg-green-100 text-green-700' :
                                          unit.grade === 'B' ? 'bg-primary/15 text-primary' :
                                          'bg-slate-100 text-slate-600'
                                        }`}>{unit.grade}</Badge>
                                      )}
                                      {unit.exam_date && <span className="text-xs text-slate-400">{unit.exam_date}</span>}
                                      {idx < 2 && <Badge className="text-[10px] bg-primary/15 text-primary border-0">计入均分</Badge>}
                                    </div>
                                    {canEdit && (
                                      <Button variant="ghost" size="sm" className="text-red-500 h-7 w-7 p-0" onClick={() => handleDeleteUnitGrade(unit.id)}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                ))}
                                {internalAvg !== null && (
                                  <div className="text-xs text-right text-primary font-medium pt-1">
                                    最近{recentInternals.length}次均分：{internalAvg} / 100
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-slate-400 text-center py-2">暂无校内成绩</p>
                            )}
                          </div>

                          {/* 其他类型考试（模考/补考） */}
                          {(() => {
                            const otherUnits = allUnits.filter((u: any) => u.exam_type && !['final', 'internal', 'mock', 'retake'].includes(u.exam_type));
                            if (otherUnits.length === 0) return null;
                            return (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="text-sm font-medium text-slate-600">其他考试成绩 ({otherUnits.length}项)</h5>
                                </div>
                                <div className="space-y-2">
                                  {otherUnits.map((unit: any) => (
                                    <div key={unit.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-200">
                                      <div className="flex items-center gap-3">
                                        <span className="font-medium text-sm">{unit.unit_code || unit.unit_name}</span>
                                        <Badge variant="outline" className="text-xs">{unit.score}/{unit.max_score || 100}</Badge>
                                        <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0">
                                          {String(unit.exam_type)}
                                        </Badge>
                                        {unit.exam_date && <span className="text-xs text-slate-400">{unit.exam_date}</span>}
                                      </div>
                                      {canEdit && (
                                        <Button variant="ghost" size="sm" className="text-red-500 h-7 w-7 p-0" onClick={() => handleDeleteUnitGrade(unit.id)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
                {dashboardData.courses.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="mb-3">暂无课程数据</p>
                    {canEdit && <Button variant="outline" size="sm" onClick={handleOpenEnroll}><Plus className="h-4 w-4 mr-2" />添加选课</Button>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== 考季规划 ===== */}
        <TabsContent value="sessions" className="space-y-4">
          {id && <ExamSessionPlanner studentId={id} />}
        </TabsContent>

        {/* ===== 目标院校 ===== */}
        <TabsContent value="universities" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><School className="h-5 w-5" />目标院校</CardTitle>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={handleOpenUniAdd}>
                  <Plus className="h-4 w-4 mr-2" />添加院校
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.targetUniversities.map((uni) => (
                  <div key={uni.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold">{uni.name}</h4>
                        <p className="text-sm text-slate-500">
                          {uni.program_name ? (
                            <span className="text-slate-700 font-medium">{uni.program_name}</span>
                          ) : null}
                          {uni.program_name && uni.course_name ? ' · ' : null}
                          {uni.course_name || '--'}
                          {uni.country ? ` · ${uni.country}` : ''}
                        </p>
                        {(uni.matching_prefs?.language_score_id || uni.matching_prefs?.standardized_test_id) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            匹配指定：
                            {uni.matching_prefs?.language_score_id ? ' 语言成绩已指定' : ''}
                            {uni.matching_prefs?.standardized_test_id ? ' 标化已指定' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{typeLabels[uni.application_type] || uni.application_type}</Badge>
                        <Badge variant={uni.status === 'offer' ? 'default' : 'outline'}>{statusLabels[uni.status] || uni.status}</Badge>
                        {uni.status === 'offer' && uni.offer_detail && typeof uni.offer_detail === 'object' && (
                          (uni.offer_detail as Record<string, unknown>).kind === 'conditional' ? (
                            <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-900">条件录取</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">无条件录取</Badge>
                          )
                        )}
                      </div>
                    </div>
                    <div className="mt-2 text-sm grid grid-cols-2 gap-2">
                      <p><span className="text-slate-500">A-Level要求:</span> {uni.a_level_requirement || '--'}</p>
                      <p><span className="text-slate-500">语言要求:</span> {uni.language_requirement || '--'}</p>
                    </div>
                    {canEdit && (
                      <div className="mt-3 pt-3 border-t flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenUniStatus(uni)}>
                          <Edit2 className="h-3.5 w-3.5 mr-1" />更新状态
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleRemoveUni(uni.university_id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-1" />移除
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
                {dashboardData.targetUniversities.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="mb-3">暂无目标院校</p>
                    {canEdit && <Button variant="outline" size="sm" onClick={handleOpenUniAdd}><Plus className="h-4 w-4 mr-2" />添加院校</Button>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== 语言成绩 ===== */}
        <TabsContent value="tests" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Languages className="h-5 w-5" />语言成绩</CardTitle>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={handleOpenLangAdd}>
                  <Plus className="h-4 w-4 mr-2" />添加成绩
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboardData.languageScores.map((score) => (
                  <div key={score.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <h4 className="font-semibold">{score.test_type}</h4>
                        <span className="text-2xl font-bold text-primary">{score.overall_score}</span>
                        {score.is_best_score && <Badge className="bg-green-100 text-green-700">最佳</Badge>}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1">
                          {dashboardData.targetUniversities.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => openLangMatchDialog(score.id)}>
                              用于匹配
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleOpenLangEdit(score)}><Edit2 className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteLang(score.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      )}
                    </div>
                    {score.test_type === 'Duolingo' ? (
                      <div className="mt-2 grid grid-cols-5 gap-4 text-sm">
                        <div><span className="text-slate-500">Literacy:</span> {parseComponentScores((score as any).component_scores)?.literacy ?? '--'}</div>
                        <div><span className="text-slate-500">Conversation:</span> {parseComponentScores((score as any).component_scores)?.conversation ?? '--'}</div>
                        <div><span className="text-slate-500">Comprehension:</span> {parseComponentScores((score as any).component_scores)?.comprehension ?? '--'}</div>
                        <div><span className="text-slate-500">Production:</span> {parseComponentScores((score as any).component_scores)?.production ?? '--'}</div>
                        <div><span className="text-slate-500">考试日期:</span> {score.test_date || '--'}</div>
                      </div>
                    ) : (
                      <div className="mt-2 grid grid-cols-5 gap-4 text-sm">
                        <div><span className="text-slate-500">听力:</span> {score.listening_score || '--'}</div>
                        <div><span className="text-slate-500">阅读:</span> {score.reading_score || '--'}</div>
                        <div><span className="text-slate-500">写作:</span> {score.writing_score || '--'}</div>
                        <div><span className="text-slate-500">口语:</span> {score.speaking_score || '--'}</div>
                        <div><span className="text-slate-500">考试日期:</span> {score.test_date || '--'}</div>
                      </div>
                    )}
                  </div>
                ))}
                {dashboardData.languageScores.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="mb-3">暂无语言成绩</p>
                    {canEdit && <Button variant="outline" size="sm" onClick={handleOpenLangAdd}><Plus className="h-4 w-4 mr-2" />添加成绩</Button>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== 美本需求 ===== */}
        <TabsContent value="us-needs" className="space-y-4">
          <UsRequirementsPanel dashboardData={dashboardData} />
        </TabsContent>

        {/* ===== 待办任务 ===== */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1 min-w-0">
                <CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />待办任务</CardTitle>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                  以下为数据库中<strong>已保存</strong>的任务。仪表盘「智能行动计划」还会根据补考、语言、院校等<strong>自动生成建议项</strong>，数量可能多于本列表。
                </p>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" className="shrink-0" onClick={handleOpenTaskAdd}>
                  <Plus className="h-4 w-4 mr-2" />添加任务
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {tasks.map(t => {
                  const priorityColors: Record<string, string> = { urgent: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700', medium: 'bg-primary/15 text-primary', low: 'bg-slate-100 text-slate-600' };
                  const priorityLabels: Record<string, string> = { urgent: '紧急', high: '高', medium: '中', low: '低' };
                  const categoryLabels: Record<string, string> = { academic: '学术', language: '语言', standardized: '标化', extracurricular: '课外', application: '申请' };
                  const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
                  const isOverdue =
                    !!t.deadline &&
                    t.status !== 'completed' &&
                    !Number.isNaN(new Date(t.deadline).getTime()) &&
                    new Date(t.deadline) < startOfToday;
                  return (
                    <div
                      key={t.id}
                      className={`border rounded-lg p-3 flex items-start gap-3 ${t.status === 'completed' ? 'opacity-50' : ''} ${isOverdue ? 'border-destructive/50 bg-destructive/5' : ''}`}
                    >
                      {canEdit && (
                        <button onClick={() => handleToggleTask(t)} className="mt-0.5 flex-shrink-0">
                          <CheckCircle2 className={`h-5 w-5 ${t.status === 'completed' ? 'text-green-500' : 'text-slate-300 hover:text-green-400'}`} />
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${t.status === 'completed' ? 'line-through text-slate-400' : ''}`}>{t.title}</span>
                          <Badge className={`text-xs ${priorityColors[t.priority] || ''}`}>{priorityLabels[t.priority] || t.priority}</Badge>
                          <Badge variant="outline" className="text-xs">{categoryLabels[t.category] || t.category}</Badge>
                        </div>
                        {t.description && <p className="text-sm text-slate-500 mt-1">{t.description}</p>}
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-slate-400">
                          {t.deadline && (
                            <span className={isOverdue ? 'text-destructive font-medium' : ''}>
                              截止: {t.deadline}
                              {isOverdue ? '（已逾期）' : ''}
                            </span>
                          )}
                          {t.assigned_by_name && <span>指派: {t.assigned_by_name}</span>}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenTaskEdit(t)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteTask(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {tasks.length === 0 && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="mb-3">暂无待办任务</p>
                    {canEdit && <Button variant="outline" size="sm" onClick={handleOpenTaskAdd}><Plus className="h-4 w-4 mr-2" />添加任务</Button>}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== 任务弹窗 ===== */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTaskId ? '编辑任务' : '添加任务'}</DialogTitle><DialogDescription>为该学生创建或修改待办任务</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>任务标题 *</Label><Input value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="如：提交个人陈述初稿" /></div>
            <div className="space-y-2"><Label>描述</Label><Input value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} placeholder="详细说明..." /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>分类</Label>
                <Select value={taskForm.category} onValueChange={(v) => setTaskForm({ ...taskForm, category: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="academic">学术</SelectItem><SelectItem value="language">语言</SelectItem>
                    <SelectItem value="standardized">标化</SelectItem><SelectItem value="extracurricular">课外</SelectItem>
                    <SelectItem value="application">申请</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>优先级</Label>
                <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">紧急</SelectItem><SelectItem value="high">高</SelectItem>
                    <SelectItem value="medium">中</SelectItem><SelectItem value="low">低</SelectItem>
                  </SelectContent>
                </Select></div>
              <div className="space-y-2"><Label>截止日期</Label><Input type="date" value={taskForm.deadline} onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowTaskDialog(false)}>取消</Button><Button onClick={handleSaveTask}>保存</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 成绩编辑弹窗 ===== */}
      <Dialog open={!!editingGrade} onOpenChange={() => setEditingGrade(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑成绩 - {editingGrade?.course_name}</DialogTitle>
            <DialogDescription>修改该课程的各类成绩</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {(['internal', 'mock', 'final'] as const).map((type) => {
              const label = type === 'internal' ? '校内' : type === 'mock' ? '模考' : '实考';
              return (
                <div key={type} className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{label}等级</Label>
                    <Select value={(gradeForm as any)[`${type}_grade`]} onValueChange={(v) => setGradeForm({ ...gradeForm, [`${type}_grade`]: v })}>
                      <SelectTrigger><SelectValue placeholder="选择等级" /></SelectTrigger>
                      <SelectContent>
                        {gradeOptions.map(g => <SelectItem key={g || 'none'} value={g || 'none'}>{g || '无'}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{label}分数</Label>
                    <Input type="number" value={(gradeForm as any)[`${type}_score`]} onChange={(e) => setGradeForm({ ...gradeForm, [`${type}_score`]: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGrade(null)}>取消</Button>
            <Button onClick={handleSaveGrade}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 选课弹窗 ===== */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加选课</DialogTitle>
            <DialogDescription>从已有课程中选择要添加的课程</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {availableCourses.length > 0 ? (
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger><SelectValue placeholder="选择课程" /></SelectTrigger>
                <SelectContent>
                  {availableCourses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.board} · {c.grade_level})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-slate-400 text-center py-4">没有可选的课程，请先在课程管理中创建课程</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEnrollDialog(false)}>取消</Button>
            <Button onClick={handleEnroll} disabled={!selectedCourseId}>确认选课</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 语言成绩弹窗 ===== */}
      <Dialog open={showLangDialog} onOpenChange={setShowLangDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLangScore ? '编辑语言成绩' : '添加语言成绩'}</DialogTitle>
            <DialogDescription>填写语言考试的各项分数</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>考试类型</Label>
                <Select value={langForm.test_type} onValueChange={(v) => setLangForm({ ...langForm, test_type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IELTS">IELTS</SelectItem>
                    <SelectItem value="TOEFL">TOEFL</SelectItem>
                    <SelectItem value="PTE">PTE</SelectItem>
                    <SelectItem value="Duolingo">Duolingo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>考试日期 *</Label>
                <Input type="date" value={langForm.test_date} onChange={(e) => setLangForm({ ...langForm, test_date: e.target.value })} />
              </div>
            </div>
            {langForm.test_type === 'Duolingo' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>总分 *</Label>
                    <Input
                      type="number"
                      step="5"
                      value={langForm.overall_score || ''}
                      onChange={(e) => setLangForm({ ...langForm, overall_score: parseFloat(e.target.value) || 0 })}
                      placeholder="10 - 160"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>提示</Label>
                    <p className="text-xs text-muted-foreground py-2">
                      多邻国（DET）小分为 4 维：Literacy / Conversation / Comprehension / Production。
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {(['literacy', 'conversation', 'comprehension', 'production'] as const).map((k) => (
                    <div key={k} className="space-y-2">
                      <Label>
                        {k === 'literacy' ? 'Literacy' : k === 'conversation' ? 'Conversation' : k === 'comprehension' ? 'Comprehension' : 'Production'}
                      </Label>
                      <Input
                        type="number"
                        step="5"
                        value={(langForm.component_scores?.[k] ?? '') as any}
                        onChange={(e) =>
                          setLangForm({
                            ...langForm,
                            component_scores: {
                              ...(langForm.component_scores || {}),
                              [k]: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-3">
                <div className="space-y-2">
                  <Label>总分 *</Label>
                  <Input
                    type="number"
                    step={langForm.test_type === 'IELTS' ? '0.5' : '1'}
                    value={langForm.overall_score || ''}
                    onChange={(e) => setLangForm({ ...langForm, overall_score: parseFloat(e.target.value) || 0 })}
                    placeholder={langForm.test_type === 'TOEFL' ? '0 - 120' : langForm.test_type === 'PTE' ? '10 - 90' : '0 - 9'}
                  />
                </div>
                <div className="space-y-2">
                  <Label>听力</Label>
                  <Input type="number" step={langForm.test_type === 'IELTS' ? '0.5' : '1'} value={langForm.listening_score || ''} onChange={(e) => setLangForm({ ...langForm, listening_score: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>阅读</Label>
                  <Input type="number" step={langForm.test_type === 'IELTS' ? '0.5' : '1'} value={langForm.reading_score || ''} onChange={(e) => setLangForm({ ...langForm, reading_score: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>写作</Label>
                  <Input type="number" step={langForm.test_type === 'IELTS' ? '0.5' : '1'} value={langForm.writing_score || ''} onChange={(e) => setLangForm({ ...langForm, writing_score: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>口语</Label>
                  <Input type="number" step={langForm.test_type === 'IELTS' ? '0.5' : '1'} value={langForm.speaking_score || ''} onChange={(e) => setLangForm({ ...langForm, speaking_score: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={langForm.is_best_score} onChange={(e) => setLangForm({ ...langForm, is_best_score: e.target.checked })} className="rounded" />
              <span className="text-sm">标记为最佳成绩</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLangDialog(false)}>取消</Button>
            <Button onClick={handleSaveLang}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 语言成绩 → 院校匹配偏好（少用） ===== */}
      <Dialog open={showLangMatchDialog} onOpenChange={setShowLangMatchDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>将该语言成绩用于院校匹配</DialogTitle>
            <DialogDescription>
              仅在特殊情况下需要：为某所目标院校指定使用哪一次语言成绩参与匹配与雷达图展示。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>选择院校 *</Label>
              <Select value={langMatchUniId} onValueChange={(v) => setLangMatchUniId(v)}>
                <SelectTrigger><SelectValue placeholder="选择目标院校" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>请选择</SelectItem>
                  {dashboardData?.targetUniversities.map((u: any) => (
                    <SelectItem key={u.university_id} value={u.university_id}>
                      {u.name || u.university_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                绑定后，该校的语言硬门槛/匹配将优先使用这条成绩；其他院校仍按“最佳（若有）否则最新”自动选择。
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLangMatchDialog(false)}>取消</Button>
            <Button onClick={handleSaveLangMatch}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 添加目标院校弹窗 ===== */}
      <Dialog open={showUniDialog} onOpenChange={setShowUniDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加目标院校</DialogTitle>
            <DialogDescription>从院校库中选择目标院校</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {allUniversities.length > 0 ? (
              <>
                <div className="space-y-2">
                  <Label>选择院校</Label>
                  <Select
                    value={selectedUniId}
                    onValueChange={(v) => {
                      setSelectedUniId(v);
                      setSelectedProgramIdForAdd(NONE);
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="选择院校" /></SelectTrigger>
                    <SelectContent>
                      {allUniversities.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.country}) {u.ranking ? `#${u.ranking}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedUniId && (
                  <div className="space-y-2">
                    <Label>专业</Label>
                    <Select value={selectedProgramIdForAdd} onValueChange={setSelectedProgramIdForAdd}>
                      <SelectTrigger><SelectValue placeholder="可选专业" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>不指定（使用院校默认信息）</SelectItem>
                        {uniProgramsForAdd.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.program_name}{p.department ? ` · ${p.department}` : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {uniProgramsForAdd.length === 0 && (
                      <p className="text-xs text-muted-foreground">该校暂无专业条目，可在院校库中补充；不指定时将使用院校主档要求。</p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>申请类型</Label>
                  <Select value={selectedUniType} onValueChange={(v) => setSelectedUniType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="reach">冲刺</SelectItem>
                      <SelectItem value="target">目标</SelectItem>
                      <SelectItem value="safety">保底</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <p className="text-slate-400 text-center py-4">没有可添加的院校，请先在院校管理中创建院校</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUniDialog(false)}>取消</Button>
            <Button onClick={handleAddUni} disabled={!selectedUniId}>确认添加</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 添加单元成绩弹窗 ===== */}
      <Dialog open={showUnitGradeDialog} onOpenChange={setShowUnitGradeDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              添加{isFinalLike(unitGradeForm.exam_type) ? '实考' : '校内'}成绩
            </DialogTitle>
            <DialogDescription>为该课程添加一条考试成绩记录</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-5">
            <div className="grid gap-5 md:grid-cols-[240px_1fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>考试类型 *</Label>
                  <Select
                    value={normalizeExamType(unitGradeForm.exam_type)}
                    onValueChange={(v) => {
                      const nextType = normalizeExamType(v);
                      const units = courseUnitsMap[unitGradeCourseId] || [];
                      setUnitGradeForm((prev) => ({
                        ...prev,
                        exam_type:
                          nextType === 'final'
                            ? ((prev.exam_type === 'retake' || prev.exam_type === 'final') ? prev.exam_type : 'final')
                            : ('internal' as any),
                        ...(nextType === 'final'
                          ? {
                              unit_code: prev.unit_code || units[0]?.unit_code || '',
                              unit_name: prev.unit_name || units[0]?.unit_name || '',
                              max_score: prev.unit_code ? prev.max_score : (units[0]?.max_score || 100),
                            }
                          : { unit_code: '', unit_name: '', max_score: 100 }),
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="final">实考</SelectItem>
                      <SelectItem value="internal">校内考试</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isFinalLike(unitGradeForm.exam_type) && (
                  <div className="space-y-2">
                    <Label>实考性质</Label>
                    <Select
                      value={unitGradeForm.exam_type === 'retake' ? 'retake' : 'final'}
                      onValueChange={(v) =>
                        setUnitGradeForm((prev) => ({ ...prev, exam_type: (v === 'retake' ? 'retake' : 'final') as any }))
                      }
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="final">实考</SelectItem>
                        <SelectItem value="retake">补考</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-4 min-w-0">
                <div className="space-y-2">
                  {isFinalLike(unitGradeForm.exam_type) ? (
                    <>
                      <Label>选择单元 *</Label>
                      {(courseUnitsMap[unitGradeCourseId] || []).length > 0 ? (
                        <Select value={unitGradeForm.unit_code} onValueChange={handleUnitSelect}>
                          <SelectTrigger className="w-full min-w-0">
                            <SelectValue placeholder="选择单元" />
                          </SelectTrigger>
                          <SelectContent>
                            {(courseUnitsMap[unitGradeCourseId] || []).map((u) => {
                              const full = `${u.unit_code}: ${u.unit_name} (满分${u.max_score})`;
                              const short = full.length > 72 ? `${full.slice(0, 69)}...` : full;
                              return (
                                <SelectItem key={u.id} value={u.unit_code}>
                                  <span className="block max-w-[34rem] truncate" title={full}>
                                    {short}
                                  </span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={unitGradeForm.unit_code}
                          onChange={(e) =>
                            setUnitGradeForm({ ...unitGradeForm, unit_code: e.target.value, unit_name: e.target.value })
                          }
                          placeholder="如 Unit 1"
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <Label>考试名称</Label>
                      <Input
                        value={unitGradeForm.unit_name}
                        onChange={(e) => setUnitGradeForm({ ...unitGradeForm, unit_name: e.target.value, unit_code: '' })}
                        placeholder="可空，如：第一学年第一学期期中"
                      />
                    </>
                  )}
                </div>

                <div className="space-y-2 max-w-sm">
                  <Label>考试日期</Label>
                  <Input
                    type="date"
                    value={unitGradeForm.exam_date}
                    onChange={(e) => setUnitGradeForm({ ...unitGradeForm, exam_date: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>得分 *</Label>
                <Input type="number" value={unitGradeForm.score || ''} onChange={(e) => setUnitGradeForm({ ...unitGradeForm, score: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>满分</Label>
                <Input type="number" value={unitGradeForm.max_score || ''} onChange={(e) => setUnitGradeForm({ ...unitGradeForm, max_score: parseInt(e.target.value) || 100 })} />
              </div>
              <div className="space-y-2">
                <Label>等级</Label>
                <Select value={unitGradeForm.grade || 'none'} onValueChange={(v) => setUnitGradeForm({ ...unitGradeForm, grade: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="等级" /></SelectTrigger>
                  <SelectContent>
                    {['none', 'A*', 'A', 'B', 'C', 'D', 'E', 'U'].map(g => (
                      <SelectItem key={g} value={g}>{g === 'none' ? '无' : g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnitGradeDialog(false)}>取消</Button>
            <Button onClick={handleSaveUnitGrade}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== 编辑目标院校（状态 / 专业 / 匹配 / 录取详情）===== */}
      <Dialog
        open={!!editingUniStatus}
        onOpenChange={(open) => {
          if (!open) {
            setEditingUniStatus(null);
            setUniDetailForm(emptyUniDetailForm());
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑目标院校 — {editingUniStatus?.name}</DialogTitle>
            <DialogDescription>申请类型、专业、用于匹配的指定成绩，以及录取后的细分信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>申请类型</Label>
              <Select
                value={uniDetailForm.application_type}
                onValueChange={(v) => setUniDetailForm({ ...uniDetailForm, application_type: v as UniDetailFormState['application_type'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reach">冲刺</SelectItem>
                  <SelectItem value="target">目标</SelectItem>
                  <SelectItem value="safety">保底</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>申请状态</Label>
              <Select
                value={uniDetailForm.status}
                onValueChange={(v) => setUniDetailForm({ ...uniDetailForm, status: v as UniDetailFormState['status'] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>专业</Label>
              <Select
                value={uniDetailForm.program_id}
                onValueChange={(v) => setUniDetailForm({ ...uniDetailForm, program_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="选择专业" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>不指定</SelectItem>
                  {uniProgramsEdit.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.program_name}{p.department ? ` · ${p.department}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium">
                <ChevronDown className="h-4 w-4 shrink-0" />
                匹配成绩
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3 pl-1">
                <div className="space-y-2">
                  <Label>指定语言成绩记录</Label>
                  <Select
                    value={uniDetailForm.lang_score_id}
                    onValueChange={(v) => setUniDetailForm({ ...uniDetailForm, lang_score_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="默认：该考试类型下最佳" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>自动</SelectItem>
                      {dashboardData.languageScores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.test_type} {s.overall_score} · {s.test_date || '无日期'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>指定标化成绩记录</Label>
                  <Select
                    value={uniDetailForm.std_test_id}
                    onValueChange={(v) => setUniDetailForm({ ...uniDetailForm, std_test_id: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="默认：该考试类型下最佳" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>自动</SelectItem>
                      {dashboardData.standardizedTests.map((s: StandardizedTest) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.test_type} {s.score}{s.max_score ? `/${s.max_score}` : ''} · {s.test_date || '无日期'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {uniDetailForm.status === 'offer' && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm font-medium">录取详情</p>
                <div className="space-y-2">
                  <Label>录取类型</Label>
                  <Select
                    value={uniDetailForm.offer_kind}
                    onValueChange={(v) => setUniDetailForm({ ...uniDetailForm, offer_kind: v as 'unconditional' | 'conditional' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unconditional">无条件录取</SelectItem>
                      <SelectItem value="conditional">条件录取</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {uniDetailForm.offer_kind === 'unconditional' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>接受/确认截止日期</Label>
                      <Input
                        value={uniDetailForm.u_ddl}
                        onChange={(e) => setUniDetailForm({ ...uniDetailForm, u_ddl: e.target.value })}
                        placeholder="可选"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>其他说明</Label>
                      <Input
                        value={uniDetailForm.u_other}
                        onChange={(e) => setUniDetailForm({ ...uniDetailForm, u_other: e.target.value })}
                        placeholder="可选"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>学术条件</Label>
                      <Input value={uniDetailForm.c_academic} onChange={(e) => setUniDetailForm({ ...uniDetailForm, c_academic: e.target.value })} placeholder="可选" />
                    </div>
                    <div className="space-y-2">
                      <Label>语言条件</Label>
                      <Input value={uniDetailForm.c_language} onChange={(e) => setUniDetailForm({ ...uniDetailForm, c_language: e.target.value })} placeholder="可选" />
                    </div>
                    <div className="space-y-2">
                      <Label>押金</Label>
                      <Input value={uniDetailForm.c_deposit} onChange={(e) => setUniDetailForm({ ...uniDetailForm, c_deposit: e.target.value })} placeholder="可选" />
                    </div>
                    <div className="space-y-2">
                      <Label>条件满足 DDL</Label>
                      <Input value={uniDetailForm.c_ddl} onChange={(e) => setUniDetailForm({ ...uniDetailForm, c_ddl: e.target.value })} placeholder="可选" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>其他</Label>
                      <Input value={uniDetailForm.c_other} onChange={(e) => setUniDetailForm({ ...uniDetailForm, c_other: e.target.value })} placeholder="可选" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingUniStatus(null); setUniDetailForm(emptyUniDetailForm()); }}>取消</Button>
            <Button onClick={handleSaveUniStatus}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
