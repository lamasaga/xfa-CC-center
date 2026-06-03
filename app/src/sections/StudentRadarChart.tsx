import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { StudentDashboardData } from '@/types/student';
import { Target, TrendingUp } from 'lucide-react';

interface StudentRadarChartProps {
  data: StudentDashboardData;
}

function getSubjectScore(s: { computedFinalScore?: number | null; computedInternalAvg?: number | null; unitGrades: { score: number; maxScore: number; examType?: string }[]; internalScore?: number; mockScore?: number; finalScore?: number }) {
  if (s.computedFinalScore != null && s.computedFinalScore > 0) return s.computedFinalScore;
  if (s.computedInternalAvg != null && s.computedInternalAvg > 0) return s.computedInternalAvg;
  if (s.finalScore) return Math.min(s.finalScore, 100);
  if (s.mockScore) return Math.min(s.mockScore, 100);
  if (s.internalScore) return Math.min(s.internalScore, 100);
  return 0;
}

export function StudentRadarChart({ data }: StudentRadarChartProps) {
  const radarData: { subject: string; '当前水平': number; '目标水平': number }[] = [];

  data.aLevelSubjects.forEach(s => {
    radarData.push({
      subject: s.name,
      '当前水平': Math.round(getSubjectScore(s)),
      '目标水平': 90,
    });
  });

  const bestIelts = data.languageScores.find(s => s.type === 'IELTS' && s.bestScore);
  const bestLang = bestIelts || data.languageScores[0];
  radarData.push({
    subject: '语言能力',
    '当前水平': bestLang ? Math.round((bestLang.overall / 9) * 100) : 0,
    '目标水平': 85,
  });

  const totalUni = data.targetUniversities?.length || 0;
  const submitted = totalUni > 0
    ? data.targetUniversities.filter(u => u.applicationStatus === 'submitted' || u.applicationStatus === 'offer').length
    : 0;
  radarData.push({
    subject: '申请进度',
    '当前水平': totalUni > 0 ? Math.round((submitted / totalUni) * 100) : 0,
    '目标水平': 100,
  });

  const subjectScores = data.aLevelSubjects.map(s => getSubjectScore(s));
  const avgSubject = subjectScores.length > 0 ? subjectScores.reduce((a, b) => a + b, 0) / subjectScores.length : 0;
  const langScore = bestLang ? (bestLang.overall / 9) * 100 : 0;
  const appScore = totalUni > 0 ? (submitted / totalUni) * 100 : 0;
  const overall = Math.round(avgSubject * 0.5 + langScore * 0.3 + appScore * 0.2);

  const weakestArea = radarData.reduce((a, b) => a['当前水平'] < b['当前水平'] ? a : b);

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            能力雷达图
          </CardTitle>
          <Badge variant="outline" className="text-primary">
            <TrendingUp className="h-3 w-3 mr-1" />
            综合: {overall}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
              <Radar name="当前水平" dataKey="当前水平" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} strokeWidth={2} />
              <Radar name="目标水平" dataKey="目标水平" stroke="#10b981" fill="#10b981" fillOpacity={0.05} strokeWidth={2} strokeDasharray="5 5" />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 p-3 bg-primary/10 rounded-lg">
          <p className="text-sm text-foreground">
            <span className="font-semibold">关键洞察:</span>{' '}
            <span className="font-semibold text-primary">{weakestArea.subject}</span>
            {' '}相对较弱（{weakestArea['当前水平']}分），建议优先提升。
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
