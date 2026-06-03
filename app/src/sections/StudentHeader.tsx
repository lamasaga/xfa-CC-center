import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import type { StudentInfo, StudentDashboardData } from '@/types/student';
import { studentApi } from '@/services/api';
import {
  School,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronsUpDown,
  BookOpen,
  Target,
  Clock,
  Flame,
  Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCohortDisplay } from '@/lib/cohortLabels';
import { useMemo, useRef, useState } from 'react';

/** 与后端 ENABLE_STUDENT_AVATAR_UPLOAD=true 同时为 true 时再打开上传入口；关闭时仍可展示已有头像 */
const STUDENT_AVATAR_UPLOAD_UI_ENABLED = false;

interface StudentSelectorInfo {
  id: string;
  name: string;
  grade: string;
}

function getSubjectScore(s: { computedFinalScore?: number | null; computedInternalAvg?: number | null; unitGrades: { score: number; maxScore: number; examType?: string }[]; internalScore?: number; mockScore?: number; finalScore?: number }) {
  if (s.computedFinalScore != null && s.computedFinalScore > 0) return s.computedFinalScore;
  if (s.computedInternalAvg != null && s.computedInternalAvg > 0) return s.computedInternalAvg;
  if (s.finalScore) return s.finalScore;
  if (s.mockScore) return s.mockScore;
  if (s.internalScore) return s.internalScore;
  return 0;
}

interface StudentHeaderProps {
  student: StudentInfo;
  summary: string;
  dashboardData?: StudentDashboardData;
  students?: StudentSelectorInfo[];
  currentStudentId?: string;
  currentIndex?: number;
  onStudentChange?: (studentId: string) => void;
  onPrevStudent?: () => void;
  onNextStudent?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
  /** 头像上传成功后刷新仪表盘数据 */
  onAvatarUpdated?: () => void | Promise<void>;
}

export function StudentHeader({
  student,
  summary,
  dashboardData,
  students = [],
  currentStudentId = '',
  currentIndex = 0,
  onStudentChange,
  onPrevStudent,
  onNextStudent,
  canGoPrev = false,
  canGoNext = false,
  onAvatarUpdated,
}: StudentHeaderProps) {
  const [open, setOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const currentLabel = useMemo(() => {
    const cur = students.find((s) => s.id === currentStudentId);
    return cur ? cur.name : '';
  }, [students, currentStudentId]);

  const grouped = useMemo(() => {
    const map = new Map<string, StudentSelectorInfo[]>();
    for (const s of students) {
      const g = s.grade || '未分年级';
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'zh-Hans-CN'));
  }, [students]);

  const metrics = useMemo(() => {
    if (!dashboardData) return null;
    const d = dashboardData;

    let academic = 0, language = 0, application = 0;
    if (d.aLevelSubjects.length > 0) {
      const scores = d.aLevelSubjects.map(s => getSubjectScore(s));
      const valid = scores.filter(s => s > 0);
      if (valid.length > 0) {
        academic = Math.min((valid.reduce((a, b) => a + b, 0) / valid.length / 90) * 100, 100);
      }
    }
    const bestIelts = d.languageScores.find(s => s.type === 'IELTS' && s.bestScore);
    if (bestIelts && bestIelts.overall > 0) language = Math.min((bestIelts.overall / 7.5) * 100, 100);
    const totalUni = d.targetUniversities?.length || 0;
    if (totalUni > 0) {
      const submitted = d.targetUniversities.filter(u => u.applicationStatus === 'submitted' || u.applicationStatus === 'offer').length;
      application = (submitted / totalUni) * 100;
    }
    const readiness = Math.round(academic * 0.5 + language * 0.3 + application * 0.2) || 0;

    const grades = d.aLevelSubjects.map(s => s.finalGrade || s.mockGrade || s.predictedGrade || 'N/A');
    const hasAStar = grades.some(g => g === 'A*');
    const hasA = grades.some(g => g === 'A');
    const academicRange = hasAStar ? 'A*-A' : hasA ? 'A-B' : grades.every(g => g === 'N/A') ? '--' : 'B-C';
    const retakeCount = d.aLevelSubjects.filter(s => s.needsRetake).length;

    const submitted = d.targetUniversities.filter(u => u.applicationStatus === 'submitted' || u.applicationStatus === 'offer').length;
    const offers = d.targetUniversities.filter(u => u.applicationStatus === 'offer').length;

    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const urgentCount = d.timeline.filter(t => {
      if (t.completed) return false;
      const date = new Date(t.date);
      return date <= sevenDays && date >= now;
    }).length;
    const nearestDeadline = d.timeline
      .filter(t => !t.completed && t.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
    const daysUntilNearest = nearestDeadline
      ? Math.ceil((new Date(nearestDeadline.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      readiness,
      academicRange,
      retakeCount,
      subjectCount: d.aLevelSubjects.length,
      submitted,
      offers,
      totalUni,
      urgentCount,
      daysUntilNearest,
      nearestTitle: nearestDeadline?.title,
      ieltsScore: bestIelts?.overall || 0,
    };
  }, [dashboardData]);

  const getReadinessColor = (score: number) => {
    if (score >= 80) return { ring: 'stroke-emerald-500', text: 'text-emerald-600', label: '优秀' };
    if (score >= 60) return { ring: 'stroke-primary', text: 'text-primary', label: '良好' };
    if (score >= 40) return { ring: 'stroke-amber-500', text: 'text-amber-600', label: '进行中' };
    return { ring: 'stroke-red-500', text: 'text-red-600', label: '需努力' };
  };

  return (
    <Card className="border border-border/60 shadow-sm shadow-black/[0.03] bg-card overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* 头像（可上传小图；无图时显示姓名首字） */}
          <div className="relative flex-shrink-0">
            <Avatar className="h-11 w-11 bg-gradient-to-br from-primary to-primary/80 border-2 border-card shadow-md">
              {student.avatarUrl ? (
                <AvatarImage src={student.avatarUrl} alt="" className="object-cover" />
              ) : null}
              <AvatarFallback className="text-base font-bold text-white bg-transparent">
                {student.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            {STUDENT_AVATAR_UPLOAD_UI_ENABLED && onAvatarUpdated ? (
              <Popover open={avatarOpen} onOpenChange={setAvatarOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-border/80 bg-background shadow-sm hover:bg-muted/90 text-muted-foreground hover:text-foreground"
                    aria-label="更换头像"
                    title="更换头像"
                  >
                    <Camera className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start" sideOffset={6}>
                  <p className="text-xs text-muted-foreground mb-2">
                    支持 JPG / PNG / WebP，单张不超过 800KB。
                  </p>
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      setAvatarUploading(true);
                      try {
                        await studentApi.uploadAvatar(student.id, file);
                        setAvatarOpen(false);
                        await onAvatarUpdated();
                      } catch (err) {
                        alert(err instanceof Error ? err.message : '上传失败');
                      } finally {
                        setAvatarUploading(false);
                      }
                    }}
                  />
                  <Button type="button" size="sm" className="w-full" disabled={avatarUploading} onClick={() => avatarFileRef.current?.click()}>
                    {avatarUploading ? '上传中…' : '选择图片'}
                  </Button>
                </PopoverContent>
              </Popover>
            ) : null}
          </div>

          {/* 姓名 + 届别（班级可保留一行） */}
          <div className="min-w-0 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-foreground font-serif tracking-tight">{student.name}</h1>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px] px-1.5 py-0">
                {formatCohortDisplay(student.grade)}
              </Badge>
            </div>
            {student.school?.trim() ? (
              <div className="flex items-center gap-0.5 mt-0.5 text-[11px] text-slate-500">
                <School className="h-3 w-3 shrink-0" />
                <span className="truncate" title={student.school}>
                  {student.school}
                </span>
              </div>
            ) : null}
          </div>

          {/* 核心指标（嵌入 Header） */}
          {metrics && (
            <div className="hidden lg:flex items-center gap-3 border-l border-border/70 pl-4 flex-1 min-w-0">
              {/* 就绪度环 */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative w-10 h-10">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-muted-foreground/20"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="currentColor" strokeWidth="3"
                    />
                    <path
                      className={getReadinessColor(metrics.readiness).ring}
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none" stroke="currentColor" strokeWidth="3"
                      strokeDasharray={`${metrics.readiness}, 100`} strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xs font-bold ${getReadinessColor(metrics.readiness).text}`}>{metrics.readiness}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 leading-tight">就绪度</p>
                  <p className={`text-xs font-semibold ${getReadinessColor(metrics.readiness).text}`}>
                    {getReadinessColor(metrics.readiness).label}
                  </p>
                </div>
              </div>

              <div className="w-px h-8 bg-border/80 flex-shrink-0" />

              {/* 学术 */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${metrics.retakeCount > 0 ? 'bg-amber-50' : 'bg-primary/10'}`}>
                  <BookOpen className={`h-3.5 w-3.5 ${metrics.retakeCount > 0 ? 'text-amber-600' : 'text-primary'}`} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 leading-tight">学术</p>
                  <p className="text-xs font-bold text-slate-800">{metrics.academicRange}</p>
                </div>
                {metrics.retakeCount > 0 && (
                  <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded ml-0.5">
                    {metrics.retakeCount}科补考
                  </span>
                )}
              </div>

              <div className="w-px h-8 bg-border/80 flex-shrink-0" />

              {/* 申请 */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${metrics.offers > 0 ? 'bg-emerald-50' : 'bg-primary/8'}`}>
                  <Target className={`h-3.5 w-3.5 ${metrics.offers > 0 ? 'text-emerald-600' : 'text-primary'}`} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 leading-tight">申请</p>
                  <p className="text-xs font-bold text-slate-800">{metrics.submitted}/{metrics.totalUni}</p>
                </div>
                {metrics.offers > 0 && (
                  <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded ml-0.5">
                    {metrics.offers} offer
                  </span>
                )}
              </div>

              <div className="w-px h-8 bg-border/80 flex-shrink-0" />

              {/* 近期事项 */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${metrics.urgentCount > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                  {metrics.urgentCount > 0
                    ? <Flame className="h-3.5 w-3.5 text-red-500" />
                    : <Clock className="h-3.5 w-3.5 text-slate-500" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {metrics.urgentCount > 0 ? '紧急' : '截止'}
                  </p>
                  <p className={`text-xs font-bold truncate ${metrics.urgentCount > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {metrics.daysUntilNearest != null ? `${metrics.daysUntilNearest}天` : '--'}
                  </p>
                </div>
                {metrics.urgentCount > 0 && (
                  <span className="text-[9px] text-red-600 bg-red-50 px-1 py-0.5 rounded">
                    {metrics.urgentCount}项
                  </span>
                )}
              </div>

              {/* 雅思 */}
              {metrics.ieltsScore > 0 && (
                <>
                  <div className="w-px h-8 bg-border/80 flex-shrink-0" />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${metrics.ieltsScore >= 7 ? 'bg-emerald-50' : 'bg-primary/10'}`}>
                      <span className={`text-[10px] font-bold ${metrics.ieltsScore >= 7 ? 'text-emerald-600' : 'text-primary'}`}>IE</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 leading-tight">雅思</p>
                      <p className={`text-xs font-bold ${metrics.ieltsScore >= 7 ? 'text-emerald-600' : 'text-primary'}`}>
                        {metrics.ieltsScore}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 一句话总结 (仅在无指标时展示) */}
          {!metrics && (
            <div className="flex-1 border-l border-border/70 pl-4 hidden lg:block">
              <p className="text-sm text-muted-foreground italic line-clamp-1">{summary}</p>
            </div>
          )}

          {/* 学生切换器 */}
          {students.length > 0 && onStudentChange && (
            <div className="flex items-center gap-2 border-l border-border/70 pl-3 flex-shrink-0">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-9 min-w-[11rem] max-w-[14rem] justify-between gap-2 rounded-lg border-border/80 bg-background px-3 text-xs font-medium shadow-sm hover:bg-muted/40"
                  >
                    <span className={cn('truncate text-left', !currentLabel && 'text-muted-foreground')}>
                      {currentLabel || '选择学生'}
                    </span>
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[min(100vw-1.5rem,20rem)] overflow-hidden rounded-xl border border-border/80 p-0 shadow-lg"
                  align="end"
                  sideOffset={6}
                >
                  <Command className="rounded-xl">
                    <CommandInput placeholder="搜索姓名或年级…" />
                    <CommandList className="max-h-[min(50vh,18rem)]">
                      <CommandEmpty className="py-8 text-xs text-muted-foreground">未找到匹配学生</CommandEmpty>
                      {grouped.map(([grade, list]) => (
                        <CommandGroup key={grade} heading={formatCohortDisplay(grade)}>
                          {list.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={`${s.name} ${s.grade}`}
                              onSelect={() => {
                                setOpen(false);
                                onStudentChange(s.id);
                              }}
                            >
                              <Check
                                className={cn(
                                  'h-3.5 w-3.5 shrink-0 text-primary',
                                  s.id === currentStudentId ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <span className="truncate font-medium">{s.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                      <CommandSeparator className="my-0.5 bg-border/60" />
                      <CommandGroup className="p-1.5 pt-0">
                        <CommandItem
                          value="manage"
                          onSelect={() => {
                            setOpen(false);
                            onStudentChange('manage');
                          }}
                          className="text-primary font-medium"
                        >
                          管理学生…
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrevStudent} disabled={!canGoPrev}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-[10px] text-slate-400 min-w-[2.5rem] text-center">
                  {currentIndex + 1}/{students.length}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNextStudent} disabled={!canGoNext}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
