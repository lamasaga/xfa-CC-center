import { Card, CardContent } from '@/components/ui/card';
import type { StudentDashboardData } from '@/types/student';
import {
  BookOpen,
  Target,
  Trophy,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';

interface KeyMetricsPanelProps {
  data: StudentDashboardData;
}

export function KeyMetricsPanel({ data }: KeyMetricsPanelProps) {
  // 计算各项指标

  // 1. A-Level整体表现
  const subjectScores = data.aLevelSubjects.map((s) => ({
    name: s.name,
    avg: s.unitGrades.length > 0
      ? s.unitGrades.reduce((a, b) => a + (b.score || 0), 0) / s.unitGrades.length
      : 0,
    predicted: s.predictedGrade || 'N/A',
    needsRetake: s.needsRetake,
  }));
  const overallAcademic = subjectScores.length > 0
    ? subjectScores.reduce((a, b) => a + b.avg, 0) / subjectScores.length
    : 0;

  // 2. 语言成绩
  const bestIelts = data.languageScores.find((s) => s.type === 'IELTS' && s.bestScore);

  // 3. 标化成绩
  const bestSat = data.standardizedTests.find((s) => s.type === 'SAT' && s.bestScore);

  // 4. 申请进度
  const submittedCount = data.targetUniversities.filter(
    (u) => u.applicationStatus === 'submitted' || u.applicationStatus === 'offer'
  ).length;
  const offerCount = data.targetUniversities.filter(
    (u) => u.applicationStatus === 'offer'
  ).length;

  // 5. upcoming 事项
  const upcomingExams = data.examSchedule.filter((e) => e.status === 'upcoming').length;
  const upcomingDeadlines = data.timeline.filter(
    (t) => !t.completed && new Date(t.date) > new Date()
  ).length;

  // 6. 需要补考的科目
  const retakeCount = data.aLevelSubjects.filter((s) => s.needsRetake).length;

  const metrics = [
    {
      title: 'A-Level均分',
      value: Math.round(overallAcademic),
      unit: '分',
      icon: BookOpen,
      color: 'bg-primary',
      status: overallAcademic >= 85 ? 'good' : overallAcademic >= 75 ? 'warning' : 'danger',
      detail: `${subjectScores.length}科 · ${retakeCount}科需补考`,
    },
    {
      title: '雅思成绩',
      value: bestIelts?.overall || 'N/A',
      unit: bestIelts ? '' : '',
      icon: Target,
      color: 'bg-green-500',
      status: bestIelts && bestIelts.overall >= 7 ? 'good' : bestIelts && bestIelts.overall >= 6.5 ? 'warning' : 'danger',
      detail: bestIelts ? `有效期至 ${bestIelts.validUntil}` : '暂无成绩',
    },
    {
      title: 'SAT成绩',
      value: bestSat?.score || 'N/A',
      unit: bestSat ? '' : '',
      icon: Trophy,
      color: 'bg-primary',
      status: bestSat && bestSat.score >= 1400 ? 'good' : bestSat && bestSat.score >= 1200 ? 'warning' : 'danger',
      detail: bestSat ? `${bestSat.testDate}` : '暂无成绩',
    },
    {
      title: '申请进度',
      value: `${submittedCount}/${data.targetUniversities.length}`,
      unit: '',
      icon: CheckCircle,
      color: 'bg-emerald-600',
      status: submittedCount >= data.targetUniversities.length ? 'good' : submittedCount > 0 ? 'warning' : 'danger',
      detail: offerCount > 0 ? `已获 ${offerCount} 个offer` : '申请中',
    },
    {
      title: ' upcoming 考试',
      value: upcomingExams,
      unit: '场',
      icon: Calendar,
      color: 'bg-orange-500',
      status: upcomingExams > 0 ? 'warning' : 'good',
      detail: upcomingExams > 0 ? '需关注备考' : '暂无 upcoming 考试',
    },
    {
      title: ' upcoming 截止',
      value: upcomingDeadlines,
      unit: '项',
      icon: Clock,
      color: 'bg-red-500',
      status: upcomingDeadlines > 3 ? 'danger' : upcomingDeadlines > 0 ? 'warning' : 'good',
      detail: upcomingDeadlines > 0 ? '请留意截止日期' : '暂无 upcoming 截止',
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <TrendingUp className="h-4 w-4 text-yellow-500" />;
      case 'danger':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {metrics.map((metric, idx) => (
        <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div
                className={`w-10 h-10 rounded-lg ${metric.color} flex items-center justify-center`}
              >
                <metric.icon className="h-5 w-5 text-white" />
              </div>
              {getStatusIcon(metric.status)}
            </div>
            <div className="mt-3">
              <p className="text-sm text-gray-500">{metric.title}</p>
              <p className="text-2xl font-bold">
                {metric.value}
                <span className="text-sm font-normal text-gray-500 ml-1">{metric.unit}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">{metric.detail}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
