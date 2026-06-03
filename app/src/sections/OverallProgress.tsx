import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  Target,
  Calendar,
  Trophy,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { StudentDashboardData } from '@/types/student';

interface OverallProgressProps {
  data: StudentDashboardData;
}

export function OverallProgress({ data }: OverallProgressProps) {
  // 计算A-Level完成进度
  const totalUnits = data.aLevelSubjects.reduce((acc, subj) => acc + subj.unitGrades.length, 0);
  const completedUnits = data.aLevelSubjects.reduce(
    (acc, subj) => acc + subj.unitGrades.filter((u) => u.grade).length,
    0
  );
  const alevelProgress = Math.round((completedUnits / totalUnits) * 100);

  // 获取最佳语言成绩
  const bestLanguage = data.languageScores.find((l) => l.bestScore);
  const languageReady = bestLanguage && bestLanguage.overall >= 7.0;

  // 获取最佳SAT成绩
  const bestSAT = data.standardizedTests.find((t) => t.type === 'SAT' && t.bestScore);
  const satReady = bestSAT && bestSAT.score >= 1400;

  // 计算申请进度
  const totalUniversities = data.targetUniversities.length;
  const submittedApplications = data.targetUniversities.filter(
    (u) => u.applicationStatus === 'submitted' || u.applicationStatus === 'offer'
  ).length;
  const applicationProgress = Math.round((submittedApplications / totalUniversities) * 100);

  // 计算补考需求
  const retakeNeeded = data.aLevelSubjects.filter((s) => s.needsRetake).length;

  // 计算 upcoming 任务
  const upcomingTasks = data.timeline.filter((t) => !t.completed).length;
  const urgentTasks = data.timeline.filter(
    (t) => !t.completed && t.priority === 'high'
  ).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* A-Level进度 */}
      <Card className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground border-0 shadow-md shadow-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <BookOpen className="h-6 w-6 text-primary-foreground/80" />
            <Badge className="bg-primary-foreground/15 text-primary-foreground border-0">{alevelProgress}%</Badge>
          </div>
          <p className="text-2xl font-bold">{completedUnits}/{totalUnits}</p>
          <p className="text-sm text-primary-foreground/85">A-Level单元完成</p>
          <Progress value={alevelProgress} className="h-1 mt-2 bg-white/20" />
          {retakeNeeded > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-yellow-200">
              <AlertCircle className="h-3 w-3" />
              {retakeNeeded}科需补考
            </div>
          )}
        </CardContent>
      </Card>

      {/* 语言成绩 */}
      <Card
        className={`border-0 ${
          languageReady
            ? 'bg-gradient-to-br from-green-500 to-green-600 text-white'
            : 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Target className="h-6 w-6 text-white/70" />
            {languageReady ? (
              <CheckCircle className="h-5 w-5 text-green-100" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-100" />
            )}
          </div>
          <p className="text-2xl font-bold">
            {bestLanguage ? bestLanguage.overall : 'N/A'}
          </p>
          <p className="text-sm text-white/70">
            {bestLanguage ? bestLanguage.type : '暂无成绩'}
          </p>
          {bestLanguage && (
            <div className="mt-2 text-xs text-white/70">
              有效期至: {bestLanguage.validUntil}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 标化考试 */}
      <Card
        className={`border-0 ${
          satReady
            ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
            : 'bg-gradient-to-br from-gray-500 to-gray-600 text-white'
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Trophy className="h-6 w-6 text-white/70" />
            {satReady && <CheckCircle className="h-5 w-5 text-purple-100" />}
          </div>
          <p className="text-2xl font-bold">{bestSAT ? bestSAT.score : 'N/A'}</p>
          <p className="text-sm text-white/70">{bestSAT ? 'SAT最佳' : 'SAT待考'}</p>
          {bestSAT && bestSAT.sectionScores && (
            <div className="mt-2 text-xs text-white/70">
              R: {bestSAT.sectionScores[0]?.score} · M: {bestSAT.sectionScores[1]?.score}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 申请进度 */}
      <Card className="bg-gradient-to-br from-pink-500 to-rose-600 text-white border-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="h-6 w-6 text-pink-100" />
            <Badge className="bg-white/20 text-white border-0">{applicationProgress}%</Badge>
          </div>
          <p className="text-2xl font-bold">{submittedApplications}/{totalUniversities}</p>
          <p className="text-sm text-pink-100">申请已提交</p>
          <Progress value={applicationProgress} className="h-1 mt-2 bg-white/20" />
          {upcomingTasks > 0 && (
            <div className="mt-2 flex items-center gap-1 text-xs text-yellow-200">
              <Clock className="h-3 w-3" />
              {upcomingTasks}项待办 ({urgentTasks}项紧急)
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
