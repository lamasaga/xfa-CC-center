import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { StudentHeader } from '@/sections/StudentHeader';
import { CompetencyAnalysis } from '@/sections/CompetencyAnalysis';
import { GoalsAndActions } from '@/sections/GoalsAndActions';
import { SessionOverviewPanel } from '@/sections/SessionOverviewPanel';
import { studentApi, type StudentDashboard as StudentDashboardType, type Student, type AlevelPredictionsResponse } from '@/services/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { useGrade } from '@/contexts/GradeContext';
import { useAuth } from '@/contexts/AuthContext';

/** 供学生详情「美本需求」等与仪表盘一致的学生数据转换 */
export function transformDashboardData(apiData: StudentDashboardType, predictions?: AlevelPredictionsResponse | null) {
  const normalizeBoard = (b: any): 'Edexcel' | 'CIE' | 'AQA' | 'OCR' | 'WJEC' | 'LRN' | 'Internal' => {
    if (b === 'Edexcel' || b === 'CIE' || b === 'AQA' || b === 'OCR' || b === 'WJEC' || b === 'LRN' || b === 'Internal') return b;
    return 'Edexcel';
  };
  const normalizeStandardizedType = (t: any): 'SAT' | 'ACT' | 'AP' | 'IB' | 'STEP' | 'MAT' | 'TMUA' | null => {
    if (t === 'SAT' || t === 'ACT' || t === 'AP' || t === 'IB' || t === 'STEP' || t === 'MAT' || t === 'TMUA') return t;
    return null;
  };
  const normalizeCountry = (c: any): 'UK' | 'US' | 'Canada' | 'Australia' | 'Hong Kong' | 'Singapore' | 'Other' => {
    const s = String(c || '').trim();
    if (s === 'US' || s === '美国') return 'US';
    if (s === 'UK' || s === '英国') return 'UK';
    if (s === 'Canada' || s === '加拿大') return 'Canada';
    if (s === 'Australia' || s === '澳大利亚') return 'Australia';
    if (s === 'Hong Kong' || s === '中国香港' || s === '香港') return 'Hong Kong';
    if (s === 'Singapore' || s === '新加坡') return 'Singapore';
    return 'Other';
  };
  const predByStudentCourseId = new Map<string, (AlevelPredictionsResponse['predictions'][0])>();
  (predictions?.predictions || []).forEach(p => predByStudentCourseId.set(p.student_course_id, p));

  return {
    student: {
      id: apiData.student.id,
      name: apiData.student.name,
      englishName: apiData.student.english_name,
      grade: apiData.student.grade,
      school: apiData.student.school,
      avatarUrl: (() => {
        const u = apiData.student.avatar_url;
        if (!u || !String(u).trim()) return null;
        const t = apiData.student.updated_at
          ? `?t=${encodeURIComponent(String(apiData.student.updated_at))}`
          : '';
        return `${String(u).trim()}${t}`;
      })(),
      enrollmentDate: `${apiData.student.enrollment_year}-09-01`,
      advisor: apiData.student.advisor_name || apiData.student.advisor_id,
      contact: {
        phone: apiData.student.phone,
        email: apiData.student.email,
        wechat: apiData.student.wechat,
      },
      parentContact: {
        name: apiData.student.parent_name,
        phone: apiData.student.parent_phone,
        email: apiData.student.parent_email,
      },
    },
    // 仅纳入「国际认可/标化」课程参与雷达图与院校匹配；校内课程（board=Internal）不纳入
    aLevelSubjects: apiData.courses
      .filter((course) => course.board !== 'Internal')
      .map(course => {
      const allUnits = (course.unitGrades || []).map(u => ({
        unit: u.unit_code || u.unit_name,
        score: u.score || 0,
        maxScore: u.max_score || 100,
        grade: u.grade || '',
        date: u.exam_date || '',
        examType: (u.exam_type || 'final') as 'internal' | 'mock' | 'final' | 'retake',
      }));

      const finalUnits = allUnits.filter(u => u.examType === 'final');
      const retakeUnits = allUnits.filter(u => u.examType === 'retake');
      const internalUnits = allUnits
        .filter(u => u.examType === 'internal')
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const recentInternals = internalUnits.slice(0, 2);

      const courseUnits = Array.isArray((course as any).courseUnits) ? ((course as any).courseUnits as any[]) : [];
      const configuredUnits = courseUnits
        .map((u) => ({
          unit_code: String(u.unit_code || '').trim(),
          unit_name: String(u.unit_name || '').trim(),
          max_score: typeof u.max_score === 'number' && u.max_score > 0 ? u.max_score : 100,
          is_advanced: !!u.is_advanced,
          sort_order: typeof u.sort_order === 'number' ? u.sort_order : 0,
        }))
        .sort((a, b) => a.sort_order - b.sort_order);

      const matchUnit = (cfg: { unit_code: string; unit_name: string }, g: { unit: string }) => {
        const key = (g.unit || '').trim();
        if (!key) return false;
        if (cfg.unit_code && key.toLowerCase() === cfg.unit_code.toLowerCase()) return true;
        if (cfg.unit_name && key.toLowerCase() === cfg.unit_name.toLowerCase()) return true;
        if (cfg.unit_code && cfg.unit_name && (key.toLowerCase() === cfg.unit_code.toLowerCase() || key.toLowerCase() === cfg.unit_name.toLowerCase())) return true;
        return false;
      };

      const bestPctForCfg = (cfg: { unit_code: string; unit_name: string }) => {
        const matches = allUnits.filter((g) => matchUnit(cfg, g));
        if (matches.length === 0) return 0;
        const examMatches = matches.filter((m) => m.examType === 'final' || m.examType === 'retake');
        const pool = examMatches.length > 0 ? examMatches : matches;
        let best = 0;
        for (const m of pool) {
          const denom = m.maxScore || 100;
          const pct = denom > 0 ? m.score / denom : 0;
          if (pct > best) best = pct;
        }
        return Math.max(0, Math.min(1, best));
      };

      const overallDenom = configuredUnits.reduce((s, u) => s + u.max_score, 0);
      const overallNumer = configuredUnits.reduce((s, u) => s + bestPctForCfg(u) * u.max_score, 0);
      const computedFinalScore = overallDenom > 0 ? Math.round((overallNumer / overallDenom) * 100) : null;

      const advUnits = configuredUnits.filter((u) => u.is_advanced);
      const advDenom = advUnits.reduce((s, u) => s + u.max_score, 0);
      const advNumer = advUnits.reduce((s, u) => s + bestPctForCfg(u) * u.max_score, 0);
      const computedAdvancedPct = advDenom > 0 ? Math.round((advNumer / advDenom) * 100) : null;

      const computedAlevelGrade: 'A*' | 'A' | null =
        computedFinalScore != null && computedFinalScore >= 80
          ? (computedAdvancedPct != null && computedAdvancedPct >= 90 ? 'A*' : 'A')
          : null;

      const pred = predByStudentCourseId.get(course.id);
      const hasAnyFinalLike = pred ? pred.observed_units > 0 : false;
      const predictedFinalPct = pred && hasAnyFinalLike ? pred.predicted_pct : null;
      const predictedFinalGrade = pred && hasAnyFinalLike ? pred.predicted_grade : null;
      const predictedConfidence = pred && hasAnyFinalLike ? pred.confidence : null;
      const predictedProbabilities = pred && hasAnyFinalLike ? pred.probabilities : null;

      const computedInternalAvg = recentInternals.length > 0
        ? Math.round(
            recentInternals.reduce((s, u) => s + (u.score / u.maxScore) * 100, 0) / recentInternals.length
          )
        : null;

      return {
        name: course.course_name || course.subject_code || 'Course',
        board: normalizeBoard(course.board),
        predictedGrade: course.internal_grade,
        internalScore: course.internal_score || undefined,
        internalGrade: course.internal_grade || undefined,
        mockScore: course.mock_score || undefined,
        mockGrade: course.mock_grade || undefined,
        finalScore: course.final_score || undefined,
        finalGrade: course.final_grade || undefined,
        unitGrades: allUnits,
        computedFinalScore: predictedFinalPct != null ? Math.round(predictedFinalPct) : computedFinalScore,
        computedInternalAvg,
        computedAdvancedPct: pred && hasAnyFinalLike && pred.predicted_advanced_pct != null ? Math.round(pred.predicted_advanced_pct) : computedAdvancedPct,
        computedAlevelGrade: predictedFinalGrade === 'A*' || predictedFinalGrade === 'A' ? predictedFinalGrade : computedAlevelGrade,
        predictedFinalPct,
        predictedFinalGrade,
        predictedConfidence,
        predictedProbabilities,
        totalConfiguredUnits: configuredUnits.length || undefined,
        finishedFinalUnits: finalUnits.length + retakeUnits.length,
        needsRetake: finalUnits.some(u => u.grade && ['D', 'E', 'U'].includes(u.grade)),
        retakeUnits: finalUnits
          .filter(u => u.grade && ['D', 'E', 'U'].includes(u.grade))
          .map(u => u.unit),
      };
    }),
    languageScores: apiData.languageScores.map(ls => ({
      id: ls.id,
      type: ls.test_type,
      overall: ls.overall_score,
      listening: ls.listening_score,
      reading: ls.reading_score,
      writing: ls.writing_score,
      speaking: ls.speaking_score,
      componentScores: (() => {
        const raw = (ls as any).component_scores;
        if (!raw) return null;
        if (typeof raw === 'object') return raw as Record<string, number>;
        if (typeof raw !== 'string') return null;
        try { return JSON.parse(raw) as Record<string, number>; } catch { return null; }
      })(),
      testDate: ls.test_date,
      validUntil: ls.valid_until,
      bestScore: !!ls.is_best_score,
    })),
    standardizedTests: apiData.standardizedTests
      .map(st => {
        const t = normalizeStandardizedType(st.test_type);
        if (!t) return null;
        return {
          id: st.id,
          type: t,
          score: st.score,
          sectionScores: st.section_scores ? Object.entries(st.section_scores).map(([name, score]) => ({
            name,
            score: score as number,
          })) : undefined,
          testDate: st.test_date,
          bestScore: st.is_best_score,
        };
      })
      .filter(Boolean) as any,
    targetUniversities: apiData.targetUniversities.map(tu => {
      const applicationStatus: 'not_started' | 'preparing' | 'submitted' | 'offer' | 'rejected' =
        tu.status === 'offer' ? 'offer'
        : tu.status === 'submitted' ? 'submitted'
        : tu.status === 'rejected' ? 'rejected'
        : 'preparing';

      let subjectReq: string[] = [];
      try {
        if (Array.isArray(tu.subject_requirements)) subjectReq = tu.subject_requirements as any;
        else if (typeof tu.subject_requirements === 'string' && tu.subject_requirements.trim()) {
          const parsed = JSON.parse(tu.subject_requirements);
          subjectReq = Array.isArray(parsed) ? parsed : [];
        }
      } catch {
        subjectReq = [];
      }

      return {
        studentUniversityId: (tu as any).student_university_id || (tu as any).id,
        universityId: (tu as any).university_record_id || (tu as any).university_id,
        name: tu.name || 'Unknown University',
        country: normalizeCountry(tu.country),
        ranking: tu.ranking ?? 0,
        course: (tu as any).program_name || tu.course_name || '',
        requirements: {
          aLevel: (tu as any).program?.a_level_requirement || tu.a_level_requirement || '',
          language: (tu as any).program?.language_requirement || tu.language_requirement || '',
          subjectRequirements: subjectReq,
          requirementsStruct:
            ((tu as any).program?.requirements_struct || (tu as any).requirements_struct || null) as any,
        },
        eduSystem: ((tu as any).edu_system || null) as any,
        degreeLevel: ((tu as any).degree_level || null) as any,
        deadline: (tu as any).program?.application_deadline || tu.application_deadline || '',
        status: (tu.application_type || 'target') as 'reach' | 'target' | 'safety',
        applicationStatus,
        notes: tu.notes || '',
        createdAt: (tu as any).created_at || '',
        matchingPrefs: (tu as any).matching_prefs || null,
        offerDetail: (tu as any).offer_detail || null,
      };
    }),
    examSchedule: [],
    retakePlans: [],
    timeline: apiData.tasks.map(t => ({
      id: t.id,
      title: t.title,
      date: t.deadline || '',
      type: (t.category === 'application' ? 'application' : 'other') as 'exam' | 'application' | 'interview' | 'decision' | 'other',
      description: t.description,
      completed: t.status === 'completed',
      priority: (t.priority === 'urgent' ? 'high' : t.priority) as 'high' | 'medium' | 'low',
    })),
    extracurriculars: apiData.extracurriculars.map(e => ({
      id: e.id,
      name: e.name,
      type: e.activity_type as 'academic' | 'leadership' | 'community' | 'arts' | 'sports' | 'other',
      role: e.role,
      organization: e.organization,
      startDate: e.start_date,
      endDate: e.end_date,
      ongoing: e.ongoing,
      description: e.description,
      hoursPerWeek: e.hours_per_week,
      achievements: e.achievements || [],
    })),
    recommendations: apiData.tasks
      .filter(t => t.status !== 'completed')
      .map(t => ({
        id: t.id,
        category: t.category as 'academic' | 'language' | 'standardized' | 'extracurricular' | 'application',
        title: t.title,
        description: t.description,
        priority: t.priority,
        deadline: t.deadline,
        completed: t.status === 'completed',
      })),
  };
}

function Dashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeGrade, availableGrades, setAvailableGrades } = useGrade();
  const [data, setData] = useState<ReturnType<typeof transformDashboardData> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [currentStudentId, setCurrentStudentId] = useState<string>('');
  const [radarFocusUniversityId, setRadarFocusUniversityId] = useState<string | null>(null);
  const lastRadarStudentRef = useRef<string | null>(null);
  const loadGeneration = useRef(0);

  const fetchStudents = async () => {
    try {
      if (user?.role === 'student' && user.student_id) {
        const one = await studentApi.getById(user.student_id);
        const list = one ? [one] : [];
        setStudents(list);
        return list;
      }
      const filtered = await studentApi.getAll({ status: 'active', grade: activeGrade });
      setStudents(filtered);
      const gradesFromData = [...new Set(filtered.map(s => s.grade))].sort();
      const merged = [...new Set([...availableGrades, ...gradesFromData])].sort();
      setAvailableGrades(merged);
      return filtered;
    } catch (err) {
      console.error('Failed to fetch students:', err);
      return [];
    }
  };

  const fetchDashboardData = async (studentId: string, generation: number) => {
    try {
      setIsLoading(true);
      setError('');
      const [apiData, preds] = await Promise.all([
        studentApi.getDashboard(studentId),
        studentApi.getAlevelPredictions(studentId).catch(() => null),
      ]);
      if (generation !== loadGeneration.current) return;
      const transformedData = transformDashboardData(apiData, preds);
      setData(transformedData);
      setCurrentStudentId(studentId);
      localStorage.setItem('lastViewedStudentId', studentId);
    } catch (err) {
      if (generation !== loadGeneration.current) return;
      setData(null);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (generation === loadGeneration.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    const generation = ++loadGeneration.current;
    setData(null);
    setError('');
    setIsLoading(true);

    const init = async () => {
      const allStudents = await fetchStudents();
      if (generation !== loadGeneration.current) return;
      if (allStudents.length === 0) {
        setError('当前年级下没有可用的学生数据，请切换年级或前往学生管理');
        setData(null);
        setIsLoading(false);
        return;
      }
      let studentId = id || undefined;
      if (!studentId) {
        const lastViewed = localStorage.getItem('lastViewedStudentId');
        if (lastViewed && allStudents.some((s) => s.id === lastViewed)) {
          studentId = lastViewed;
        } else {
          studentId = allStudents[0].id;
        }
      } else if (!allStudents.some((s) => s.id === studentId)) {
        studentId = allStudents[0].id;
      }
      if (studentId && id !== studentId) {
        navigate(`/student/${studentId}`, { replace: true });
        return;
      }
      if (studentId) {
        await fetchDashboardData(studentId, generation);
      }
    };
    void init();
  }, [id, activeGrade, navigate, user?.role, user?.student_id]);

  useEffect(() => {
    if (!data || !currentStudentId) return;
    if (lastRadarStudentRef.current !== currentStudentId) {
      lastRadarStudentRef.current = currentStudentId;
      const tus = data.targetUniversities;
      if (!tus.length) {
        setRadarFocusUniversityId(null);
        return;
      }
      const firstReach = [...tus]
        .filter((u) => u.status === 'reach')
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))[0];
      setRadarFocusUniversityId(firstReach?.studentUniversityId || tus[0].studentUniversityId || null);
    }
  }, [data, currentStudentId]);

  const handleStudentChange = (studentId: string) => {
    if (studentId === 'manage') {
      navigate('/students');
      return;
    }
    navigate(`/student/${studentId}`);
  };

  const handlePrevStudent = () => {
    const idx = students.findIndex(s => s.id === currentStudentId);
    if (idx > 0) handleStudentChange(students[idx - 1].id);
  };

  const handleNextStudent = () => {
    const idx = students.findIndex(s => s.id === currentStudentId);
    if (idx < students.length - 1) handleStudentChange(students[idx + 1].id);
  };

  const generateStudentSummary = (d: ReturnType<typeof transformDashboardData>) => {
    const submittedCount = d.targetUniversities.filter(
      u => u.applicationStatus === 'submitted' || u.applicationStatus === 'offer'
    ).length;
    const offerCount = d.targetUniversities.filter(u => u.applicationStatus === 'offer').length;
    const retakeCount = d.aLevelSubjects.filter(s => s.needsRetake).length;
    const bestIelts = d.languageScores.find(s => s.type === 'IELTS' && s.bestScore);
    const ieltsScore = bestIelts?.overall || 0;

    if (offerCount > 0) return `恭喜！已收获 ${offerCount} 个offer，继续保持`;
    if (submittedCount > 0) return `申请已提交 ${submittedCount} 所，静候佳音`;
    if (retakeCount > 0) return `有 ${retakeCount} 科需补考，建议优先准备`;
    if (ieltsScore > 0 && ieltsScore < 7) return `雅思 ${ieltsScore} 分，建议冲刺 7.0+`;
    return `整体进展良好，按计划推进申请`;
  };

  if (user?.role === 'student' && user.student_id && id && id !== user.student_id) {
    return <Navigate to={`/student/${user.student_id}`} replace />;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-3">
            <Skeleton className="h-[500px] w-full" />
          </div>
          <div className="xl:col-span-2">
            <Skeleton className="h-[500px] w-full" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error || '加载失败'}</AlertDescription>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() =>
            navigate(user?.role === 'student' && user.student_id ? `/students/${user.student_id}` : '/students')
          }
        >
          {user?.role === 'student' ? '返回我的档案' : '前往学生管理'}
        </Button>
      </Alert>
    );
  }

  const currentIndex = students.findIndex(s => s.id === currentStudentId);
  const goStudentTab = (tab: string) => {
    if (!currentStudentId) return;
    navigate(`/students/${currentStudentId}?tab=${encodeURIComponent(tab)}`);
  };

  return (
    <div className="space-y-4">
      {/* 顶栏：学生信息 + 核心指标 */}
      <StudentHeader
        student={data.student}
        summary={generateStudentSummary(data)}
        dashboardData={data}
        students={students.map(s => ({ id: s.id, name: s.name, grade: s.grade }))}
        currentStudentId={currentStudentId}
        currentIndex={currentIndex}
        onStudentChange={handleStudentChange}
        onPrevStudent={handlePrevStudent}
        onNextStudent={handleNextStudent}
        canGoPrev={currentIndex > 0}
        canGoNext={currentIndex < students.length - 1}
        onAvatarUpdated={async () => {
          const sid = currentStudentId || data.student.id;
          const gen = loadGeneration.current;
          if (sid) await fetchDashboardData(sid, gen);
        }}
      />

      {/* 主体双栏：左竞争力分析 / 右目标院校与行动计划 */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        {/* 左栏：竞争力分析 (60%) */}
        <div className="xl:col-span-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-primary rounded-full" />
              <h2 className="text-sm font-semibold text-foreground">竞争力分析</h2>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => goStudentTab('grades')}>
              查看成绩详情
            </Button>
          </div>
          <CompetencyAnalysis data={data} focusUniversityId={radarFocusUniversityId} />
        </div>

        {/* 右栏：目标院校匹配 + 行动计划 (40%) */}
        <div className="xl:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-5 w-1 bg-primary/45 rounded-full" />
              <h2 className="text-sm font-semibold text-foreground">目标院校与行动计划</h2>
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => goStudentTab('universities')}>
              查看详情
            </Button>
          </div>
          <GoalsAndActions
            data={data}
            selectedUniversityId={radarFocusUniversityId}
            onSelectUniversity={setRadarFocusUniversityId}
          />
        </div>
      </div>

      {/* 底部横栏：考季进度 */}
      {currentStudentId && <SessionOverviewPanel studentId={currentStudentId} compact />}
    </div>
  );
}

export default Dashboard;
