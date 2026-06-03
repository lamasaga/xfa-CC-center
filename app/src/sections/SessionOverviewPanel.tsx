import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { examSessionApi, type SessionOverview } from '@/services/api';
import {
  Calendar,
  Clock,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

interface SessionOverviewPanelProps {
  studentId: string;
  compact?: boolean;
}

export function SessionOverviewPanel({ studentId, compact = false }: SessionOverviewPanelProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<SessionOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    setIsLoading(true);
    examSessionApi.getStudentOverview(studentId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }, [studentId]);

  if (isLoading) {
    return (
      <Card className="animate-pulse border border-border/70 shadow-sm">
        <CardContent className="py-6">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
          <div className="h-3 bg-slate-200 rounded w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;
  const hasAnyData = data.courses_summary.length > 0;
  if (!hasAnyData) return null;

  const daysUntilNext = data.next_session
    ? Math.ceil(
        (new Date(data.next_session.year, data.next_session.month - 1, 1).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
      )
    : null;

  if (compact) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-slate-900">考季进度</span>
              {data.remaining_sessions > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  余 {data.remaining_sessions} 季
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary hover:text-primary h-7 px-2"
              onClick={() => navigate(`/students/${studentId}?tab=sessions`)}
            >
              详情 <ArrowRight className="h-3 w-3 ml-0.5" />
            </Button>
          </div>

          <div className="flex gap-4 items-stretch">
            {/* 下一考季 */}
            {data.next_session && (
              <div className="flex items-center gap-3 bg-primary/10 rounded-lg px-3 py-2.5 flex-shrink-0 border border-primary/15">
                <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">{data.next_session.label}</p>
                  {daysUntilNext !== null && (
                    <p className={`text-[10px] mt-0.5 ${daysUntilNext <= 30 ? 'text-amber-600 font-medium' : 'text-primary'}`}>
                      {daysUntilNext} 天后
                    </p>
                  )}
                  {data.next_session_plans.length > 0 && (
                    <p className="text-[10px] text-primary mt-0.5">{data.next_session_plans.length} 单元报考</p>
                  )}
                </div>
              </div>
            )}

            {/* 警告 */}
            {(data.resit_unplanned_units.length > 0 || data.unplanned_units.length > 0) && (
              <div className="flex flex-col gap-1.5 flex-shrink-0 justify-center">
                {data.resit_unplanned_units.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-700 bg-red-50 rounded px-2 py-1 border border-red-100">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    {data.resit_unplanned_units.length} 重考未安排
                  </div>
                )}
                {data.unplanned_units.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-slate-50 rounded px-2 py-1 border border-slate-200">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    {data.unplanned_units.length} 首考未安排
                  </div>
                )}
              </div>
            )}

            {/* 科目进度 (横排) */}
            <div className="flex-1 min-w-0 grid gap-2" style={{
              gridTemplateColumns: `repeat(${Math.min(data.courses_summary.length, 4)}, minmax(0, 1fr))`
            }}>
              {data.courses_summary.map((c, i) => {
                const pct = c.total_units > 0 ? Math.round((c.planned_units / c.total_units) * 100) : 0;
                return (
                  <div key={i} className="bg-slate-50/80 rounded-lg px-3 py-2 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-slate-700 truncate">{c.course_name}</span>
                      <span className="text-[10px] text-slate-500 ml-1 flex-shrink-0">{c.planned_units}/{c.total_units}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                    {c.resit_needed > 0 && (
                      <div className="flex items-center gap-0.5 mt-1 text-[9px] text-amber-600">
                        <RotateCcw className="h-2.5 w-2.5" />
                        {c.resit_needed} 重考
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 完整 (非 compact) 模式：原有大面板
  return (
    <Card className="border-l-4 border-l-primary min-h-[320px] flex flex-col">
      <CardContent className="flex-1 flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">考季进度</span>
          </div>
          {data.remaining_sessions > 0 && (
            <Badge variant="outline" className="text-sm">
              剩余 {data.remaining_sessions} 个考季
            </Badge>
          )}
        </div>

        {data.next_session && (
          <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-xl">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-foreground">
                下一考季：{data.next_session.label}
              </div>
              {daysUntilNext !== null && (
                <div className={`mt-0.5 text-sm ${daysUntilNext <= 30 ? 'text-orange-600 font-medium' : 'text-primary'}`}>
                  距今 {daysUntilNext} 天
                </div>
              )}
              {data.next_session_deadlines?.registration_deadline && (
                <div className={`mt-0.5 text-xs ${
                  (data.next_session_deadlines.days_until_registration ?? 999) <= 30
                    ? 'text-red-600 font-medium'
                    : 'text-slate-600'
                }`}>
                  报名截止：{data.next_session_deadlines.registration_deadline}
                  {data.next_session_deadlines.days_until_registration != null
                    ? `（剩余 ${data.next_session_deadlines.days_until_registration} 天）`
                    : ''}
                </div>
              )}
            </div>
            {data.next_session_plans.length > 0 && (
              <Badge className="bg-primary/15 text-primary border-0 flex-shrink-0 text-sm px-2 py-0.5">
                {data.next_session_plans.length} 单元
              </Badge>
            )}
          </div>
        )}

        {(data.resit_unplanned_units.length > 0 || data.unplanned_units.length > 0) && (
          <div className="space-y-2">
            {data.resit_unplanned_units.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl text-sm">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <div className="flex-1 text-red-700 font-medium">
                  {data.resit_unplanned_units.length} 个需重考的单元尚未安排考季
                </div>
              </div>
            )}
            {data.unplanned_units.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl text-sm">
                <AlertTriangle className="h-5 w-5 text-slate-500 flex-shrink-0" />
                <div className="flex-1 text-slate-700 font-medium">
                  {data.unplanned_units.length} 个单元尚未安排考季
                </div>
              </div>
            )}
          </div>
        )}

        {data.next_session_plans.length > 0 && (
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-600">本次报考</div>
            <div className="space-y-2.5">
              {data.next_session_plans.map((p, i) => (
                <div key={i} className="flex items-center gap-3 text-sm pl-3 py-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                  <span className="text-slate-800 font-medium">{p.course_name}</span>
                  <span className="font-mono text-slate-500">{p.unit_code}</span>
                  <Badge className={`text-xs px-2 py-0 border-0 ${
                    p.plan_type === 'resit' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {p.plan_type === 'resit' ? '重考' : '首考'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4 flex-1">
          <div className="text-sm font-medium text-slate-600">科目进度</div>
          <div className="space-y-4">
            {data.courses_summary.map((c, i) => {
              const pct = c.total_units > 0 ? Math.round((c.planned_units / c.total_units) * 100) : 0;
              return (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-700">{c.course_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{c.planned_units}/{c.total_units}</span>
                      {c.resit_needed > 0 && (
                        <span className="text-xs text-orange-600 flex items-center font-medium">
                          <RotateCcw className="h-3 w-3 mr-0.5" />
                          {c.resit_needed} 需重考
                        </span>
                      )}
                    </div>
                  </div>
                  <Progress value={pct} className="h-2.5" />
                </div>
              );
            })}
          </div>
        </div>

        {data.total_resit_needed > 0 && (
          <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl text-sm">
            <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
            <span className="text-orange-700 font-medium">
              {data.total_resit_needed} 个单元需要重考
            </span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-primary hover:text-primary hover:bg-primary/10 py-2.5 text-sm"
          onClick={() => navigate(`/students/${studentId}?tab=sessions`)}
        >
          打开考季规划器
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
