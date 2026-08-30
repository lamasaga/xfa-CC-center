import { Card, CardContent } from '@/components/ui/card';
import type { StudentDashboardData } from '@/types/student';
import { 
  BookOpen, 
  Target, 
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface CoreMetricsPanelProps {
  data: StudentDashboardData;
}

function getSubjectScore(s: { computedFinalScore?: number | null; computedInternalAvg?: number | null; unitGrades: { score: number; maxScore: number; examType?: string }[]; internalScore?: number; mockScore?: number; finalScore?: number }) {
  if (s.computedFinalScore != null && s.computedFinalScore > 0) return s.computedFinalScore;
  if (s.computedInternalAvg != null && s.computedInternalAvg > 0) return s.computedInternalAvg;
  if (s.finalScore) return s.finalScore;
  if (s.mockScore) return s.mockScore;
  if (s.internalScore) return s.internalScore;
  return 0;
}

export function CoreMetricsPanel({ data }: CoreMetricsPanelProps) {
  const calculateReadiness = () => {
    let academic = 0;
    let language = 0;
    let application = 0;

    if (data.aLevelSubjects.length > 0) {
      const scores = data.aLevelSubjects.map(s => getSubjectScore(s));
      const validScores = scores.filter(s => s > 0);
      if (validScores.length > 0) {
        const avg = validScores.reduce((a, b) => a + b, 0) / validScores.length;
        academic = Math.min((avg / 90) * 100, 100);
      }
    }

    const bestIelts = data.languageScores.find(s => s.type === 'IELTS' && s.bestScore);
    if (bestIelts && bestIelts.overall > 0) {
      language = Math.min((bestIelts.overall / 7.5) * 100, 100);
    }

    const totalUni = data.targetUniversities?.length || 0;
    if (totalUni > 0) {
      const submitted = data.targetUniversities.filter(
        u => u.applicationStatus === 'submitted' || u.applicationStatus === 'offer'
      ).length;
      application = (submitted / totalUni) * 100;
    }

    const total = academic * 0.5 + language * 0.3 + application * 0.2;
    const result = Math.round(total);
    return isNaN(result) ? 0 : result;
  };

  const calculateAcademicStatus = () => {
    const grades = data.aLevelSubjects.map(s => {
      if (s.computedAlevelGrade) return s.computedAlevelGrade;
      if (s.finalGrade) return s.finalGrade;
      if (s.mockGrade) return s.mockGrade;
      return s.predictedGrade || 'N/A';
    });
    const hasAStar = grades.some(g => g === 'A*');
    const hasA = grades.some(g => g === 'A');
    const retakeCount = data.aLevelSubjects.filter(s => s.needsRetake).length;
    
    return {
      range: hasAStar ? 'A*-A' : hasA ? 'A-B' : grades.every(g => g === 'N/A') ? '--' : 'B-C',
      retakeCount,
      totalSubjects: data.aLevelSubjects.length,
    };
  };

  const calculateApplicationProgress = () => {
    const submitted = data.targetUniversities.filter(
      u => u.applicationStatus === 'submitted' || u.applicationStatus === 'offer'
    ).length;
    const offers = data.targetUniversities.filter(u => u.applicationStatus === 'offer').length;
    const total = data.targetUniversities.length;
    const percentage = total > 0 ? Math.round((submitted / total) * 100) : 0;
    
    return { submitted, offers, total, percentage };
  };

  const calculateUpcomingAlerts = () => {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const urgentItems = data.timeline.filter(t => {
      if (t.completed) return false;
      const date = new Date(t.date);
      return date <= sevenDays && date >= now;
    });

    const upcomingItems = data.timeline.filter(t => {
      if (t.completed) return false;
      const date = new Date(t.date);
      return date <= thirtyDays && date > sevenDays;
    });

    const nearestDeadline = data.timeline
      .filter(t => !t.completed && t.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

    const daysUntilNearest = nearestDeadline
      ? Math.ceil((new Date(nearestDeadline.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return { urgent: urgentItems.length, upcoming: upcomingItems.length, daysUntilNearest, nearestTitle: nearestDeadline?.title };
  };

  const readiness = calculateReadiness();
  const academic = calculateAcademicStatus();
  const application = calculateApplicationProgress();
  const alerts = calculateUpcomingAlerts();

  const getReadinessStatus = (score: number) => {
    if (score >= 80) return { color: 'text-green-600', ringColor: 'stroke-green-500', label: '优秀' };
    if (score >= 60) return { color: 'text-primary', ringColor: 'stroke-primary', label: '良好' };
    if (score >= 40) return { color: 'text-orange-600', ringColor: 'stroke-orange-500', label: '进行中' };
    return { color: 'text-red-600', ringColor: 'stroke-red-500', label: '需努力' };
  };

  const readinessStatus = getReadinessStatus(readiness);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 整体就绪度 */}
      <Card className="border-0 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 flex-shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="currentColor" strokeWidth="3"
                />
                <path
                  className={readinessStatus.ringColor}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="currentColor" strokeWidth="3"
                  strokeDasharray={`${readiness}, 100`} strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-base font-bold ${readinessStatus.color}`}>{readiness}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">整体就绪度</p>
              <p className={`text-base font-semibold ${readinessStatus.color}`}>{readinessStatus.label}</p>
              <p className="text-[10px] text-slate-400">学术50%·语言30%·申请20%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 学术表现 */}
      <Card className="border-0 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">学术表现</p>
              <p className="text-xl font-bold text-slate-900">{academic.range}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{academic.totalSubjects} 科预估等级</p>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${academic.retakeCount > 0 ? 'bg-orange-100' : 'bg-primary/15'}`}>
              <BookOpen className={`h-4 w-4 ${academic.retakeCount > 0 ? 'text-orange-600' : 'text-primary'}`} />
            </div>
          </div>
          {academic.retakeCount > 0 && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded">
              <AlertCircle className="h-3 w-3" />
              <span>{academic.retakeCount} 科需补考</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 申请进度 */}
      <Card className="border-0 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">申请进度</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-slate-900">{application.submitted}</span>
                <span className="text-base text-slate-400">/{application.total}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {application.offers > 0 ? `已获 ${application.offers} 个 offer` : application.total > 0 ? '申请进行中' : '暂未添加目标院校'}
              </p>
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${application.offers > 0 ? 'bg-green-100' : 'bg-primary/10'}`}>
              <Target className={`h-4 w-4 ${application.offers > 0 ? 'text-green-600' : 'text-primary'}`} />
            </div>
          </div>
          {application.total > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${application.offers > 0 ? 'bg-green-500' : 'bg-primary/80'}`}
                  style={{ width: `${application.percentage}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 近期事项 */}
      <Card className={`border-0 shadow-sm ${alerts.urgent > 0 ? 'bg-red-50' : 'bg-white'}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className={`text-xs mb-0.5 ${alerts.urgent > 0 ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                {alerts.urgent > 0 ? '有紧急事项' : '近期事项'}
              </p>
              {alerts.daysUntilNearest !== null ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-bold ${alerts.urgent > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                      {alerts.daysUntilNearest}
                    </span>
                    <span className="text-sm text-slate-500">天</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate" title={alerts.nearestTitle}>
                    {alerts.nearestTitle}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-slate-900">--</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">暂无截止事项</p>
                </>
              )}
            </div>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
              alerts.urgent > 0 ? 'bg-red-100' : alerts.upcoming > 0 ? 'bg-orange-100' : 'bg-slate-100'
            }`}>
              {alerts.urgent > 0 ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : alerts.upcoming > 0 ? (
                <Clock className="h-4 w-4 text-orange-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-slate-500" />
              )}
            </div>
          </div>
          {(alerts.urgent > 0 || alerts.upcoming > 0) && (
            <div className="mt-2 flex items-center gap-1.5">
              {alerts.urgent > 0 && (
                <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                  {alerts.urgent} 紧急
                </span>
              )}
              {alerts.upcoming > 0 && (
                <span className="text-[10px] text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                  {alerts.upcoming} 近期
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
