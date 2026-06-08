import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  examSessionApi,
  studentApi,
  type SessionPlanResponse,
  type SessionPlanCourse,
  type SessionUnitPlan,
  type ExamSession,
  type SessionPlanUnit,
} from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  formatExamMonthLabel,
  normalizeExamMonth,
  STANDARD_EXAM_MONTHS,
  unitAllowsExamMonth,
} from '@/lib/examMonths';
import { toast } from 'sonner';
import {
  Calendar,
  GripVertical,
  RotateCcw,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';

interface ExamSessionPlannerProps {
  studentId: string;
}

const SUBJECT_COLORS = [
  { bg: 'bg-primary/10', border: 'border-primary/35', text: 'text-primary', badge: 'bg-primary/15 text-primary', bar: 'bg-primary' },
  { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' },
  { bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-700', bar: 'bg-violet-500' },
  { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', bar: 'bg-rose-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-700', bar: 'bg-cyan-500' },
];

interface DragItem {
  courseIndex: number;
  unitId: string;
  planId?: string;
  fromSessionId: string | null; // null = unassigned
}

export function ExamSessionPlanner({ studentId }: ExamSessionPlannerProps) {
  const { canEditExamSessions: canEdit, canEditSchoolData: canEditSchool } = useAuth();
  const [data, setData] = useState<SessionPlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Local state for plans (optimistic updates)
  const [localPlans, setLocalPlans] = useState<Map<string, SessionUnitPlan[]>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);

  // Drag state
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dragOverSession, setDragOverSession] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      const result = await examSessionApi.getStudentPlans(studentId);

      // Auto-generate sessions if none exist
      if (result.sessions.length === 0 && result.student.enrollment_year) {
        await examSessionApi.generate({
          enrollment_year: result.student.enrollment_year,
          study_duration: result.student.study_duration || 2,
        });
        const refreshed = await examSessionApi.getStudentPlans(studentId);
        setData(refreshed);
        initLocalPlans(refreshed);
      } else {
        setData(result);
        initLocalPlans(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  const initLocalPlans = (result: SessionPlanResponse) => {
    const map = new Map<string, SessionUnitPlan[]>();
    for (const course of result.courses) {
      map.set(course.student_course_id, [...course.plans]);
    }
    setLocalPlans(map);
    setHasChanges(false);
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build the items for each column
  const validSessionIds = useMemo(
    () => new Set((data?.sessions ?? []).map((s) => s.id)),
    [data?.sessions]
  );

  const getColumnItems = (sessionId: string | null, course: SessionPlanCourse): Array<{
    unit: SessionPlanUnit;
    plan: SessionUnitPlan | null;
  }> => {
    const plans = localPlans.get(course.student_course_id) || [];

    if (sessionId === null) {
      const assignedUnitIds = new Set(
        plans
          .filter((p) => validSessionIds.has(p.exam_session_id))
          .map((p) => p.course_unit_id)
      );
      const orphanPlans = plans.filter((p) => !validSessionIds.has(p.exam_session_id));
      const unassignedUnits = course.units
        .filter((u) => !assignedUnitIds.has(u.unit_id))
        .map((u) => ({ unit: u, plan: null as SessionUnitPlan | null }));
      const orphanItems = orphanPlans
        .map((p) => {
          const unit = course.units.find((u) => u.unit_id === p.course_unit_id);
          return unit ? { unit, plan: p } : null;
        })
        .filter((item): item is { unit: SessionPlanUnit; plan: SessionUnitPlan } => item != null);
      return [...unassignedUnits, ...orphanItems];
    }

    // Units assigned to this session
    const sessionPlans = plans.filter(p => p.exam_session_id === sessionId);
    return sessionPlans.map(p => {
      const unit = course.units.find(u => u.unit_id === p.course_unit_id);
      return { unit: unit!, plan: p };
    }).filter(item => item.unit);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, item: DragItem) => {
    if (!canEdit) return;
    setDragItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(item));
    (e.target as HTMLElement).style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    setDragItem(null);
    setDragOverSession(null);
  };

  const handleDragOver = (e: React.DragEvent, sessionId: string | null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const id = sessionId ?? '__unassigned__';
    if (dragOverSession !== id) setDragOverSession(id);
  };

  const handleDragLeave = () => {
    setDragOverSession(null);
  };

  const handleDrop = (e: React.DragEvent, targetSessionId: string | null) => {
    e.preventDefault();
    setDragOverSession(null);

    if (!dragItem || !data) return;

    const { courseIndex, unitId, planId, fromSessionId } = dragItem;
    if (fromSessionId === targetSessionId) return;

    const course = data.courses[courseIndex];
    if (!course) return;

    // 目标考季可用性检查：若该单元限制了考季月份，则阻止拖放到不符合条件的列
    if (targetSessionId) {
      const targetSession = data.sessions.find(s => s.id === targetSessionId);
      const unit = course.units.find(u => u.unit_id === unitId);
      if (targetSession && unit && !unitAllowsExamMonth(unit.allowed_months, targetSession.month)) {
        const labels = [...new Set((unit.allowed_months ?? []).map(normalizeExamMonth))]
          .filter((m) => (STANDARD_EXAM_MONTHS as readonly number[]).includes(m))
          .sort((a, b) => a - b)
          .map((m) => formatExamMonthLabel(m))
          .join(' / ');
        toast.error(`该单元只能安排在 ${labels} 考季`);
        return;
      }
    }

    setLocalPlans(prev => {
      const next = new Map(prev);
      const plans = [...(next.get(course.student_course_id) || [])];

      if (targetSessionId === null) {
        // Moving to unassigned — remove the plan
        const idx = plans.findIndex(p => p.course_unit_id === unitId);
        if (idx >= 0) plans.splice(idx, 1);
      } else if (planId) {
        // Update existing plan to new session
        const idx = plans.findIndex(p => p.id === planId);
        if (idx >= 0) {
          plans[idx] = { ...plans[idx], exam_session_id: targetSessionId };
        }
      } else {
        // Create new plan (was unassigned)
        const unit = course.units.find(u => u.unit_id === unitId);
        plans.push({
          id: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          student_course_id: course.student_course_id,
          course_unit_id: unitId,
          exam_session_id: targetSessionId,
          plan_type: unit?.needs_resit ? 'resit' : 'first_sit',
          status: 'planned',
          notes: null,
        });
      }

      next.set(course.student_course_id, plans);
      return next;
    });

    setHasChanges(true);
    setDragItem(null);
  };

  // Save all changes
  const handleSave = async () => {
    if (!data) return;
    setIsSaving(true);

    try {
      const batchPlans: Array<Partial<SessionUnitPlan> & { _delete?: boolean }> = [];

      for (const course of data.courses) {
        const currentPlans = localPlans.get(course.student_course_id) || [];
        const originalPlans = course.plans;

        // Find deleted plans
        for (const orig of originalPlans) {
          if (!currentPlans.find(p => p.id === orig.id)) {
            batchPlans.push({ id: orig.id, _delete: true });
          }
        }

        // Find new and updated plans
        for (const plan of currentPlans) {
          if (plan.id.startsWith('temp_')) {
            batchPlans.push({
              student_course_id: plan.student_course_id,
              course_unit_id: plan.course_unit_id,
              exam_session_id: plan.exam_session_id,
              plan_type: plan.plan_type,
              status: plan.status,
            });
          } else {
            const orig = originalPlans.find(p => p.id === plan.id);
            if (orig && orig.exam_session_id !== plan.exam_session_id) {
              batchPlans.push({
                id: plan.id,
                exam_session_id: plan.exam_session_id,
              });
            }
          }
        }
      }

      if (batchPlans.length > 0) {
        await examSessionApi.batchUpdatePlans(studentId, batchPlans);
      }

      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (data) {
      initLocalPlans(data);
    }
  };

  // Toggle plan type (first_sit <-> resit)
  const togglePlanType = (courseScId: string, planId: string) => {
    if (!canEdit) return;
    setLocalPlans(prev => {
      const next = new Map(prev);
      const plans = [...(next.get(courseScId) || [])];
      const idx = plans.findIndex(p => p.id === planId);
      if (idx >= 0) {
        plans[idx] = {
          ...plans[idx],
          plan_type: plans[idx].plan_type === 'first_sit' ? 'resit' : 'first_sit',
        };
      }
      next.set(courseScId, plans);
      return next;
    });
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="text-center py-12 text-red-500">
          <p>{error || '加载失败'}</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>重试</Button>
        </CardContent>
      </Card>
    );
  }

  const sessions = data.sessions;
  const courses = data.courses;
  const isSessionPast = (s: ExamSession) => {
    const d = new Date(s.year, s.month - 1, 28);
    return d < new Date();
  };

  // 需重考单元列表（用于重考任务安排）
  const resitUnits: Array<{
    course: SessionPlanCourse;
    unit: SessionPlanUnit;
    plan: SessionUnitPlan | null;
    sessionLabel: string | null;
  }> = courses.flatMap((course) => {
    const plans = localPlans.get(course.student_course_id) || [];
    return course.units
      .filter(u => u.needs_resit)
      .map(unit => {
        const plan = plans.find(p => p.course_unit_id === unit.unit_id) || null;
        const sessionLabel = plan
          ? sessions.find(s => s.id === plan.exam_session_id)?.label ?? null
          : null;
        return { course, unit, plan, sessionLabel };
      });
  });

  const handleCreateResitTask = async (courseName: string, unitCode: string) => {
    if (!canEditSchool) return;
    try {
      await studentApi.createTask(studentId, {
        title: `重考：${courseName} ${unitCode}`,
        description: '请将上方该单元拖入目标考季列完成考季安排，并在考前按计划复习。',
        category: 'academic',
        priority: 'high',
      });
      toast.success('已添加待办任务，可在「待办任务」Tab 中查看');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加失败');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">考季规划</h3>
          <Badge variant="outline">
            {data.student.study_duration}年制 · {data.student.enrollment_year}年入学
          </Badge>
          <Badge variant="secondary">{sessions.length} 个可用考季</Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            含入学年 10 月首考季（9 月入学后已学单元可报考）
          </span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />撤销
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                  保存
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={isSaving}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {courses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-slate-400">
            该学生尚未选课，请先在成绩管理中添加选课
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Kanban board */}
          <div className="space-y-2">
            {/* 上方考季泳道：单独横向滚动（不影响下方备选池） */}
            <div className="overflow-x-auto pb-3">
              <div
                className="flex gap-3 pb-1"
                style={{ minWidth: `${sessions.length * 220 + Math.max(sessions.length - 1, 0) * 12}px` }}
              >
                {/* Session columns */}
                {sessions.map(session => (
                  <KanbanColumn
                    key={session.id}
                    title={session.label}
                    sessionId={session.id}
                    isPast={isSessionPast(session)}
                    courses={courses}
                    colorMap={SUBJECT_COLORS}
                    getColumnItems={getColumnItems}
                    dragOverSession={dragOverSession}
                    canEdit={canEdit}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onTogglePlanType={togglePlanType}
                  />
                ))}
              </div>
            </div>

            {/* 下方备选池：不跟随上方滑轨滚动 */}
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">未分配单元</span>
                  <span className="text-xs text-slate-400">拖拽到上方任意考季列完成安排</span>
                </div>
              </div>
              <div
                className={`flex flex-wrap gap-2 min-h-[60px] ${dragOverSession === '__unassigned__' ? 'bg-primary/15 border border-primary/35 rounded-md p-2 -m-2' : ''}`}
                onDragOver={(e) => handleDragOver(e, null)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, null)}
              >
                {courses.flatMap((course, ci) => {
                  const color = SUBJECT_COLORS[ci % SUBJECT_COLORS.length];
                  const items = getColumnItems(null, course);
                  return items.map(({ unit, plan }) => (
                    <UnitCard
                      key={`${course.student_course_id}-${unit.unit_id}-unassigned`}
                      courseIndex={ci}
                      course={course}
                      unit={unit}
                      plan={plan}
                      sessionId={null}
                      color={color}
                      isPast={false}
                      canEdit={canEdit}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onTogglePlanType={togglePlanType}
                    />
                  ));
                })}
                {courses.every(course => getColumnItems(null, course).length === 0) && (
                  <div className="text-xs text-slate-300 py-4">
                    当前没有未分配单元
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 重考安排 */}
          {resitUnits.length > 0 && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  重考安排
                </CardTitle>
                <p className="text-xs text-orange-700/80 mt-1">
                  需重考单元请拖入上方考季列；可创建待办任务以便在「待办任务」中跟进。
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {resitUnits.map(({ course, unit, plan, sessionLabel }) => (
                  <div
                    key={`${course.student_course_id}-${unit.unit_id}`}
                    className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-white border border-orange-200"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-medium text-slate-800">{course.course_name}</span>
                      <span className="font-mono text-sm text-slate-500">{unit.unit_code}</span>
                      {unit.best_grade && (
                        <span className="text-xs text-slate-500">
                          当前 {unit.best_grade.grade}（{unit.best_grade.score}/{unit.max_score}）
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {plan && sessionLabel ? (
                        <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                          <CheckCircle className="h-3 w-3 mr-0.5" />
                          已安排至 {sessionLabel}
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                            未安排考季
                          </Badge>
                          {canEditSchool && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleCreateResitTask(course.course_name, unit.unit_code)}
                            >
                              <ClipboardList className="h-3 w-3 mr-1" />
                              创建待办任务
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Subject summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-600">科目考季进度汇总</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {courses.map((course, ci) => {
                const color = SUBJECT_COLORS[ci % SUBJECT_COLORS.length];
                const plans = localPlans.get(course.student_course_id) || [];
                const totalUnits = course.units.length;
                const assignedUnits = new Set(plans.map(p => p.course_unit_id)).size;
                const passedUnits = course.units.filter(u => u.best_grade && !u.needs_resit).length;
                const resitNeeded = course.units.filter(u => u.needs_resit).length;

                const effectiveTotal = Math.max(totalUnits, 1);
                const passedRatio = Math.min(passedUnits, effectiveTotal) / effectiveTotal;
                const plannedButNotPassed = Math.max(assignedUnits - passedUnits, 0);
                const plannedRatio = plannedButNotPassed / effectiveTotal;
                const remainingRatio = Math.max(effectiveTotal - passedUnits - plannedButNotPassed, 0) / effectiveTotal;

                return (
                  <div key={course.student_course_id} className="flex items-center gap-4">
                    <div className="w-36 flex-shrink-0">
                      <span className={`text-sm font-medium ${color.text}`}>{course.course_name}</span>
                      <span className="text-xs text-slate-400 ml-1">({course.board})</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                        {passedUnits > 0 && (
                          <div
                            className="h-2 bg-emerald-500"
                            style={{ width: `${passedRatio * 100}%` }}
                          />
                        )}
                        {plannedButNotPassed > 0 && (
                          <div
                            className="h-2 bg-primary/70"
                            style={{ width: `${plannedRatio * 100}%` }}
                          />
                        )}
                        {remainingRatio > 0 && (
                          <div
                            className="h-2 bg-slate-200"
                            style={{ width: `${remainingRatio * 100}%` }}
                          />
                        )}
                      </div>
                    </div>
                    <div className="w-40 text-right flex-shrink-0 flex flex-col items-end justify-center gap-0.5">
                      <span className="text-xs text-slate-500">
                        已合格 {passedUnits}/{totalUnits}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        待考 {Math.max(assignedUnits - passedUnits, 0)} · 未安排 {Math.max(totalUnits - assignedUnits, 0)}
                      </span>
                    </div>
                    {resitNeeded > 0 && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs flex-shrink-0">
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                        {resitNeeded}需重考
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ========== Kanban Column ==========

interface KanbanColumnProps {
  title: string;
  sessionId: string | null;
  isPast: boolean;
  courses: SessionPlanCourse[];
  colorMap: typeof SUBJECT_COLORS;
  getColumnItems: (sessionId: string | null, course: SessionPlanCourse) => Array<{
    unit: SessionPlanUnit;
    plan: SessionUnitPlan | null;
  }>;
  dragOverSession: string | null;
  canEdit: boolean;
  onDragStart: (e: React.DragEvent, item: DragItem) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, sessionId: string | null) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, sessionId: string | null) => void;
  onTogglePlanType: (courseScId: string, planId: string) => void;
}

function KanbanColumn({
  title, sessionId, isPast, courses, colorMap, getColumnItems,
  dragOverSession, canEdit,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onTogglePlanType,
}: KanbanColumnProps) {
  const dropId = sessionId ?? '__unassigned__';
  const isOver = dragOverSession === dropId;

  const allItems: Array<{
    courseIndex: number;
    course: SessionPlanCourse;
    unit: SessionPlanUnit;
    plan: SessionUnitPlan | null;
  }> = [];

  courses.forEach((course, ci) => {
    const items = getColumnItems(sessionId, course);
    items.forEach(item => {
      allItems.push({ courseIndex: ci, course, ...item });
    });
  });

  return (
    <div
      className={`flex-shrink-0 w-[200px] rounded-lg border-2 transition-colors ${
        isOver ? 'border-primary/50 bg-primary/15' :
        isPast ? 'border-slate-200 bg-slate-50/60' :
        sessionId === null ? 'border-dashed border-slate-300 bg-slate-50' :
        'border-slate-200 bg-white'
      }`}
      onDragOver={(e) => onDragOver(e, sessionId)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, sessionId)}
    >
      <div className={`px-3 py-2 text-center border-b ${
        isPast ? 'bg-slate-100' : sessionId === null ? 'bg-slate-100' : 'bg-slate-50'
      }`}>
        <span className={`text-sm font-semibold ${isPast ? 'text-slate-400' : 'text-slate-700'}`}>
          {title}
        </span>
        {allItems.length > 0 && (
          <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{allItems.length}</Badge>
        )}
      </div>

      <div className={`p-2 space-y-2 min-h-[120px] ${isPast ? 'opacity-60' : ''}`}>
        {allItems.length === 0 ? (
          <div className="text-xs text-slate-300 text-center py-6">
            {canEdit ? '拖拽单元到此处' : '无安排'}
          </div>
        ) : (
          allItems.map((item) => {
            const color = colorMap[item.courseIndex % colorMap.length];
            return (
              <UnitCard
                key={`${item.course.student_course_id}-${item.unit.unit_id}`}
                courseIndex={item.courseIndex}
                course={item.course}
                unit={item.unit}
                plan={item.plan}
                sessionId={sessionId}
                color={color}
                isPast={isPast}
                canEdit={canEdit}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onTogglePlanType={onTogglePlanType}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ========== Unit Card ==========

interface UnitCardProps {
  courseIndex: number;
  course: SessionPlanCourse;
  unit: SessionPlanUnit;
  plan: SessionUnitPlan | null;
  sessionId: string | null;
  color: (typeof SUBJECT_COLORS)[0];
  isPast: boolean;
  canEdit: boolean;
  onDragStart: (e: React.DragEvent, item: DragItem) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onTogglePlanType: (courseScId: string, planId: string) => void;
}

function UnitCard({
  courseIndex, course, unit, plan, sessionId, color, isPast, canEdit,
  onDragStart, onDragEnd, onTogglePlanType,
}: UnitCardProps) {
  const isResit = plan?.plan_type === 'resit' || unit.needs_resit;
  const isCompleted = plan?.status === 'completed';
  const isPassed = !!unit.best_grade && !unit.needs_resit;

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => onDragStart(e, {
        courseIndex,
        unitId: unit.unit_id,
        planId: plan?.id,
        fromSessionId: sessionId,
      })}
      onDragEnd={onDragEnd}
      className={`rounded-md border px-2.5 py-2 transition-shadow ${
        canEdit ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''
      } ${color.bg} ${
        isResit
          ? 'border-orange-400 border-l-4'
          : isPassed
            ? 'border-emerald-400 border-l-4'
            : color.border
      } ${
        isPast ? 'opacity-70' : (isCompleted ? 'opacity-70' : '')
      }`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          {canEdit && <GripVertical className="h-3 w-3 text-slate-300 flex-shrink-0" />}
          <span className={`text-xs font-bold truncate ${color.text}`}>
            {course.course_name.length > 6 ? course.course_name.slice(0, 6) : course.course_name}
          </span>
        </div>
        <span className="flex-shrink-0">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-mono font-semibold text-slate-600">
            {unit.unit_code}
          </span>
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1 flex-wrap">
        {isResit ? (
          <Badge
            className="text-[10px] px-1 py-0 bg-orange-100 text-orange-700 border-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              if (plan && canEdit) onTogglePlanType(course.student_course_id, plan.id);
            }}
          >
            重考
          </Badge>
        ) : (
          <Badge
            className={`text-[10px] px-1 py-0 ${color.badge} border-0 cursor-pointer`}
            onClick={(e) => {
              e.stopPropagation();
              if (plan && canEdit) onTogglePlanType(course.student_course_id, plan.id);
            }}
          >
            首考
          </Badge>
        )}

        {plan?.status === 'registered' && (
          <Badge className="text-[10px] px-1 py-0 bg-primary/15 text-primary border-0">
            <Clock className="h-2.5 w-2.5 mr-0.5" />已注册
          </Badge>
        )}
        {isPassed && (
          <Badge className="text-[10px] px-1 py-0 bg-emerald-100 text-emerald-700 border-0">
            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />已合格
          </Badge>
        )}
        {!isPassed && isCompleted && (
          <Badge className="text-[10px] px-1 py-0 bg-green-100 text-green-600 border-0">
            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />已完成
          </Badge>
        )}
      </div>

      {unit.best_grade && (
        <div className="mt-1 text-[10px] text-slate-500">
          {unit.best_grade.grade && (
            <span className={`font-semibold ${
              ['A*', 'A'].includes(unit.best_grade.grade) ? 'text-green-600' :
              ['B', 'C'].includes(unit.best_grade.grade) ? 'text-primary' :
              'text-orange-600'
            }`}>
              {unit.best_grade.grade}
            </span>
          )}
          {' '}{unit.best_grade.score}/{unit.max_score}
        </div>
      )}
    </div>
  );
}
