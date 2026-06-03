import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { StudentDashboardData } from '@/types/student';
import { resolveLanguageForMatch, pickBestLanguageForType } from '@/lib/languageScores';
import {
  computeUniHardGate,
  computeUniMatchScore,
  parseIeltsReq,
} from '@/lib/universityMatchHelpers';
import { 
  School, 
  Target, 
  Flame, 
  Calendar, 
  Clock, 
  CheckCircle,
  BookOpen,
  Languages,
  FileText,
  ClipboardList,
} from 'lucide-react';

interface GoalsAndActionsProps {
  data: StudentDashboardData;
  /** 与左侧雷达图联动：选中某所目标院校 */
  selectedUniversityId?: string | null;
  onSelectUniversity?: (studentUniversityId: string) => void;
}

export function GoalsAndActions({ data, selectedUniversityId, onSelectUniversity }: GoalsAndActionsProps) {
  return (
    <div className="space-y-4">
      <UniversityMatchSection
        data={data}
        selectedUniversityId={selectedUniversityId}
        onSelectUniversity={onSelectUniversity}
      />
      <ActionPlanSection data={data} />
    </div>
  );
}

function UniversityMatchSection({
  data,
  selectedUniversityId,
  onSelectUniversity,
}: {
  data: StudentDashboardData;
  selectedUniversityId?: string | null;
  onSelectUniversity?: (studentUniversityId: string) => void;
}) {
  const uniKey = (u: (typeof data.targetUniversities)[0]) => u.studentUniversityId || u.universityId || '';
  const analyzeGap = (uni: (typeof data.targetUniversities)[0]) => {
    const gaps: string[] = [];
    
    const requiredGrades: string[] = (uni.requirements.aLevel || '').match(/[A-D][*]?/g) || [];
    const hasAStar = data.aLevelSubjects.some(s => {
      const grade = s.finalGrade || s.mockGrade || s.predictedGrade;
      return grade === 'A*';
    });
    if (requiredGrades.includes('A*') && !hasAStar) {
      gaps.push('需 A* 成绩');
    }
    
    const bestIelts = resolveLanguageForMatch(
      data.languageScores,
      'IELTS',
      uni.matchingPrefs ?? null
    );
    const ieltsReq = parseIeltsReq(uni.requirements.language || '');
    if (!bestIelts || bestIelts.overall < ieltsReq) {
      gaps.push(`雅思需 ${ieltsReq}+`);
    }
    
    const subjectReqs = uni.requirements.subjectRequirements || [];
    if (Array.isArray(subjectReqs)) {
      subjectReqs.forEach(req => {
        if (typeof req === 'string') {
          const examKeywords = ['STEP', 'MAT', 'PAT', 'TSA', 'BMAT', 'UCAT', 'LNAT', 'HAT'];
          examKeywords.forEach(exam => {
            if (req.toUpperCase().includes(exam)) {
              gaps.push(`需 ${exam} 成绩`);
            }
          });
        }
      });
    }
    
    return gaps;
  };

  const universityMatches = data.targetUniversities
    .map((uni) => ({
      ...uni,
      hardGate: computeUniHardGate(data, uni),
      matchScore: computeUniMatchScore(data, uni),
      gaps: analyzeGap(uni),
    }))
    .sort((a, b) => b.matchScore - a.matchScore);

  const getMatchColor = (score: number) => {
    if (score >= 80) return { bar: 'bg-green-500', text: 'text-green-600' };
    if (score >= 60) return { bar: 'bg-primary', text: 'text-primary' };
    if (score >= 40) return { bar: 'bg-orange-500', text: 'text-orange-600' };
    return { bar: 'bg-red-500', text: 'text-red-600' };
  };

  if (universityMatches.length === 0) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-6 text-center text-slate-500">
          <School className="h-10 w-10 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">暂无目标院校</p>
          <p className="text-xs text-slate-400 mt-1">请在学生详情中添加目标院校</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/70 shadow-sm shadow-black/[0.03]">
      <CardHeader className="pb-2 pt-3 px-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <School className="h-4 w-4 text-primary" />
            目标院校匹配度
          </CardTitle>
          <Badge variant="outline" className="text-[10px]">
            {data.targetUniversities.length} 所
          </Badge>
        </div>
        {onSelectUniversity && (
          <p className="text-[10px] text-muted-foreground mt-1">点击院校卡片，左侧雷达图将按该校要求显示目标水平</p>
        )}
      </CardHeader>
      <CardContent className="p-3">
        <div className="space-y-2.5">
          {universityMatches.map((uni, idx) => {
            const colors = getMatchColor(uni.matchScore);
            const id = uniKey(uni);
            const selected =
              !!selectedUniversityId &&
              (selectedUniversityId === uni.studentUniversityId || selectedUniversityId === uni.universityId);
            return (
              <div
                key={uni.studentUniversityId || uni.universityId || `${uni.name}-${idx}`}
                role={onSelectUniversity && id ? 'button' : undefined}
                tabIndex={onSelectUniversity && id ? 0 : undefined}
                onClick={() => id && onSelectUniversity?.(id)}
                onKeyDown={(e) => {
                  if (!onSelectUniversity || !id) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectUniversity(id);
                  }
                }}
                className={`border rounded-lg p-2.5 transition-colors ${
                  onSelectUniversity && id ? 'cursor-pointer hover:border-primary/50 hover:bg-primary/[0.03]' : ''
                } ${selected ? 'ring-2 ring-primary border-primary/40 bg-primary/[0.04]' : 'border-slate-100 hover:border-slate-200'}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">
                      {uni.country === 'UK' ? '🇬🇧' : uni.country === 'US' ? '🇺🇸' : uni.country === 'Canada' ? '🇨🇦' : '🌍'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 text-xs truncate">{uni.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{uni.course}</p>
                    </div>
                  </div>
                  <span className={`text-base font-bold ${colors.text} flex-shrink-0 ml-2`}>{uni.matchScore}%</span>
                </div>
                <div className="h-1 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                  <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${uni.matchScore}%` }} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 flex-wrap">
                    {!uni.hardGate.ok && (
                      <span className="text-[9px] text-red-600 bg-red-50 px-1 py-0.5 rounded">
                        硬门槛未满足
                      </span>
                    )}
                    {uni.gaps.length > 0 ? (
                      uni.gaps.slice(0, 2).map((gap, gidx) => (
                        <span key={gidx} className="text-[9px] text-orange-600 bg-orange-50 px-1 py-0.5 rounded">{gap}</span>
                      ))
                    ) : (
                      <span className="text-[9px] text-green-600 bg-green-50 px-1 py-0.5 rounded flex items-center gap-0.5">
                        <CheckCircle className="h-2.5 w-2.5" />匹配度高
                      </span>
                    )}
                  </div>
                  {uni.deadline && <span className="text-[10px] text-slate-400">{uni.deadline}</span>}
                </div>
                {!uni.hardGate.ok && (
                  <div className="mt-2 text-[10px] text-red-600 bg-red-50/50 border border-red-100 rounded p-2">
                    {uni.hardGate.reasons.slice(0, 3).join('；')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'academic' | 'language' | 'application' | 'other';
  deadline?: string;
}

function ActionPlanSection({ data }: { data: StudentDashboardData }) {
  const navigate = useNavigate();
  const goToSavedTasks = () => {
    if (data.student?.id) navigate(`/students/${data.student.id}?tab=tasks`);
  };

  const generateActionPlan = () => {
    const urgent: ActionItem[] = [];
    const upcoming: ActionItem[] = [];
    const regular: ActionItem[] = [];

    const retakeSubjects = data.aLevelSubjects.filter(s => s.needsRetake);
    retakeSubjects.forEach(subj => {
      urgent.push({
        id: `retake-${subj.name}`,
        title: `${subj.name} 补考冲刺`,
        description: subj.retakeUnits.length > 0
          ? `重点复习 ${subj.retakeUnits.join(', ')} 单元`
          : `重点复习薄弱单元`,
        category: 'academic',
      });
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    data.timeline
      .filter(t => !t.completed && t.date)
      .forEach(t => {
        const date = new Date(t.date);
        const item: ActionItem = {
          id: t.id,
          title: t.title,
          description: t.description,
          category: t.type === 'application' ? 'application' : t.type === 'exam' ? 'academic' : 'other',
          deadline: t.date,
        };
        if (date < startOfToday) {
          urgent.push({
            ...item,
            title: `【已逾期】${t.title}`,
            description: '截止日期已过，请尽快处理或更新计划。',
          });
        } else if (date <= sevenDays && date >= startOfToday) {
          urgent.push(item);
        } else if (date <= thirtyDays && date > sevenDays) {
          upcoming.push(item);
        } else if (date > thirtyDays) {
          regular.push(item);
        }
      });

    const bestIelts = pickBestLanguageForType(data.languageScores, 'IELTS');
    const anyUniversityNeedsHighIelts = data.targetUniversities.some(u => {
      const req = parseFloat((u.requirements.language || '').match(/[\d.]+/)?.[0] || '6.5');
      return req >= 7;
    });
    if ((!bestIelts || bestIelts.overall < 7) && anyUniversityNeedsHighIelts) {
      upcoming.push({
        id: 'ielts-improve',
        title: '雅思成绩提升',
        description: `目标 7.0+，当前 ${bestIelts?.overall || '无成绩'}`,
        category: 'language',
      });
    }

    const allSubjectReqs = data.targetUniversities.flatMap(u => u.requirements.subjectRequirements || []);
    const examKeywords = ['STEP', 'MAT', 'PAT', 'TSA', 'BMAT', 'UCAT', 'LNAT', 'HAT'];
    const detectedExams = new Set<string>();
    allSubjectReqs.forEach(req => {
      if (typeof req === 'string') {
        examKeywords.forEach(exam => {
          if (req.toUpperCase().includes(exam)) detectedExams.add(exam);
        });
      }
    });
    detectedExams.forEach(exam => {
      upcoming.push({
        id: `exam-${exam.toLowerCase()}`,
        title: `${exam} 考试准备`,
        description: `目标院校要求 ${exam}，建议尽早准备`,
        category: 'academic',
      });
    });

    const notStartedUnis = data.targetUniversities.filter(u => u.applicationStatus === 'not_started' || u.applicationStatus === 'preparing');
    if (notStartedUnis.length > 0) {
      const withDeadline = notStartedUnis.filter(u => u.deadline);
      const nearestDeadlineUni = withDeadline.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0];
      if (nearestDeadlineUni) {
        const daysToDeadline = Math.ceil((new Date(nearestDeadlineUni.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToDeadline <= 60 && daysToDeadline > 0) {
          upcoming.push({
            id: 'application-reminder',
            title: `${nearestDeadlineUni.name} 申请`,
            description: `距截止还有 ${daysToDeadline} 天，请加紧准备申请材料`,
            category: 'application',
            deadline: nearestDeadlineUni.deadline,
          });
        }
      }
    }

    return { urgent, upcoming, regular };
  };

  const actionPlan = generateActionPlan();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'academic': return <BookOpen className="h-3 w-3" />;
      case 'language': return <Languages className="h-3 w-3" />;
      case 'application': return <FileText className="h-3 w-3" />;
      default: return <Calendar className="h-3 w-3" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = { academic: '学术', language: '语言', application: '申请', other: '其他' };
    return labels[category] || category;
  };

  const getUrgencyDays = (deadline?: string) => {
    if (!deadline) return null;
    return Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  };

  const totalItems = actionPlan.urgent.length + actionPlan.upcoming.length + actionPlan.regular.length;

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-3 px-4 border-b border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-orange-600" />
            智能行动计划
          </CardTitle>
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              title="打开学生详情中的「待办任务」列表（数据库已保存项）"
              onClick={goToSavedTasks}
              disabled={!data.student?.id}
            >
              <ClipboardList className="h-3.5 w-3.5 mr-1" />
              待办任务
            </Button>
            {actionPlan.urgent.length > 0 && (
              <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5">
                <Flame className="h-2.5 w-2.5 mr-0.5" />{actionPlan.urgent.length}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">{totalItems} 项</Badge>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          本区含<strong>系统建议</strong>（补考冲刺、语言提升、院校要求等）与<strong>待办任务同步到时间轴</strong>的条目；学生详情「待办任务」Tab 仅显示已保存的数据库任务，故<strong>数量常不一致</strong>。
        </p>
      </CardHeader>
      <CardContent className="p-3">
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {actionPlan.urgent.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Flame className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-700">紧急</span>
              </div>
              <div className="space-y-1.5">
                {actionPlan.urgent.map((item, idx) => {
                  const days = getUrgencyDays(item.deadline);
                  return (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                      <Checkbox className="mt-0.5 h-3.5 w-3.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-slate-900 text-xs">{item.title}</span>
                          <span className="text-[9px] text-slate-500 bg-white px-1 py-0.5 rounded border border-slate-200 flex items-center gap-0.5">
                            {getCategoryIcon(item.category)}{getCategoryLabel(item.category)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-0.5">{item.description}</p>
                        {days !== null && (
                          <p className={`text-[10px] mt-0.5 ${days <= 0 ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                            {days <= 0 ? '已过期' : `${days}天`}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {actionPlan.upcoming.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-semibold text-orange-700">近期</span>
              </div>
              <div className="space-y-1.5">
                {actionPlan.upcoming.slice(0, 4).map((item, idx) => {
                  const days = getUrgencyDays(item.deadline);
                  return (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-orange-50 border border-orange-100 rounded-lg">
                      <Checkbox className="mt-0.5 h-3.5 w-3.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-slate-900 text-xs">{item.title}</span>
                          <span className="text-[9px] text-slate-500 bg-white px-1 py-0.5 rounded border border-slate-200 flex items-center gap-0.5">
                            {getCategoryIcon(item.category)}{getCategoryLabel(item.category)}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-600 mt-0.5">{item.description}</p>
                        {days !== null && <p className="text-[10px] text-slate-500 mt-0.5">{days}天</p>}
                      </div>
                    </div>
                  );
                })}
                {actionPlan.upcoming.length > 4 && (
                  <p className="text-[10px] text-slate-400 text-center">+{actionPlan.upcoming.length - 4} 项</p>
                )}
              </div>
            </div>
          )}

          {actionPlan.regular.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-xs font-semibold text-slate-700">常规</span>
              </div>
              <div className="space-y-1.5">
                {actionPlan.regular.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-slate-50 border border-slate-100 rounded-lg">
                    <Checkbox className="mt-0.5 h-3.5 w-3.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-slate-900 text-xs">{item.title}</span>
                        <span className="text-[9px] text-slate-500 bg-white px-1 py-0.5 rounded border border-slate-200 flex items-center gap-0.5">
                          {getCategoryIcon(item.category)}{getCategoryLabel(item.category)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalItems === 0 && (
            <div className="text-center py-6">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p className="text-slate-600 text-sm font-medium">所有任务已完成！</p>
              <p className="text-xs text-slate-400 mt-1">当前状态良好</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={goToSavedTasks}
                disabled={!data.student?.id}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                查看已保存待办
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
