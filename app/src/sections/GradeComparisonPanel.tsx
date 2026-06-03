import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { StudentDashboardData } from '@/types/student';
import { BookOpen, AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';

interface GradeComparisonPanelProps {
  data: StudentDashboardData;
}

export function GradeComparisonPanel({ data }: GradeComparisonPanelProps) {
  // 分析各科成绩与目标要求的差距
  const analyzeSubjects = () => {
    return data.aLevelSubjects.map((subject) => {
      let avgScore = 0;
      if (subject.computedFinalScore != null && subject.computedFinalScore > 0) {
        avgScore = subject.computedFinalScore;
      } else if (subject.computedInternalAvg != null && subject.computedInternalAvg > 0) {
        avgScore = subject.computedInternalAvg;
      } else if (subject.finalScore) {
        avgScore = subject.finalScore;
      } else if (subject.mockScore) {
        avgScore = subject.mockScore;
      } else if (subject.internalScore) {
        avgScore = subject.internalScore;
      }

      // 根据预估等级确定目标分数
      const targetGrade = subject.predictedGrade || 'A';
      const gradeToScore: Record<string, number> = {
        'A*': 95,
        A: 85,
        B: 75,
        C: 65,
        D: 55,
      };
      const targetScore = gradeToScore[targetGrade] || 85;

      // 计算差距
      const gap = avgScore - targetScore;
      const progress = Math.min((avgScore / targetScore) * 100, 100);

      return {
        name: subject.name,
        currentScore: Math.round(avgScore),
        targetScore,
        targetGrade,
        gap: Math.round(gap),
        progress,
        needsRetake: subject.needsRetake,
        retakeUnits: subject.retakeUnits,
      };
    });
  };

  const subjectAnalysis = analyzeSubjects();

  // 找出最需要提升的科目
  const needsImprovement = subjectAnalysis
    .filter((s) => s.gap < 0)
    .sort((a, b) => a.gap - b.gap);

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-green-600" />
          成绩与目标对比
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {subjectAnalysis.map((subject, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{subject.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    目标: {subject.targetGrade}
                  </Badge>
                  {subject.needsRetake && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      需补考
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {subject.gap >= 0 ? (
                    <Badge className="bg-green-100 text-green-700 border-0">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      达标
                    </Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-700 border-0">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      差{Math.abs(subject.gap)}分
                    </Badge>
                  )}
                </div>
              </div>

              <div className="relative">
                <Progress value={subject.progress} className="h-3" />
                <div
                  className="absolute top-0 w-0.5 h-3 bg-red-500"
                  style={{ left: `${(subject.targetScore / 100) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>当前: {subject.currentScore}分</span>
                <span>目标: {subject.targetScore}分</span>
              </div>

              {subject.retakeUnits.length > 0 && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                  补考单元: {subject.retakeUnits.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 最需要提升的科目 */}
        {needsImprovement.length > 0 && (
          <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-orange-800 flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4" />
              优先提升建议
            </h4>
            <p className="text-sm text-orange-700">
              建议优先提升
              <span className="font-semibold">{needsImprovement[0].name}</span>
              ，当前距离目标还差
              <span className="font-semibold">{Math.abs(needsImprovement[0].gap)}分</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
