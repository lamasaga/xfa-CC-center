import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { StudentDashboardData } from '@/types/student';
import { School, AlertCircle, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { computeUniHardGate, computeUniMatchScore } from '@/lib/universityMatchHelpers';

interface UniversityMatchPanelProps {
  data: StudentDashboardData;
}

export function UniversityMatchPanel({ data }: UniversityMatchPanelProps) {
  const universityMatches = data.targetUniversities.map((uni) => ({
    ...uni,
    hardGate: computeUniHardGate(data, uni),
    matchScore: computeUniMatchScore(data, uni),
  }));

  universityMatches.sort((a, b) => b.matchScore - a.matchScore);

  const getMatchBadge = (score: number) => {
    if (score >= 80) {
      return (
        <Badge className="bg-green-100 text-green-700 border-0">
          <CheckCircle className="h-3 w-3 mr-1" />
          匹配度高
        </Badge>
      );
    } else if (score >= 60) {
      return (
        <Badge className="bg-yellow-100 text-yellow-700 border-0">
          <TrendingUp className="h-3 w-3 mr-1" />
          有竞争力
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-700 border-0">
          <AlertCircle className="h-3 w-3 mr-1" />
          需努力
        </Badge>
      );
    }
  };

  const getStatusIcon = (status: (typeof data.targetUniversities)[0]['applicationStatus']) => {
    switch (status) {
      case 'offer':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'submitted':
        return <TrendingUp className="h-4 w-4 text-primary" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <School className="h-5 w-5 text-primary" />
          目标院校匹配度分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {universityMatches.map((uni, idx) => (
            <div
              key={uni.studentUniversityId || uni.universityId || `${uni.name}-${idx}`}
              className="border rounded-lg p-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {uni.country === 'UK' ? '🇬🇧' : uni.country === 'US' ? '🇺🇸' : '🌍'}
                  </span>
                  <span className="font-semibold">{uni.name}</span>
                  {getStatusIcon(uni.applicationStatus)}
                </div>
                <div className="flex items-center gap-2">
                  {!uni.hardGate.ok && (
                    <Badge className="bg-red-100 text-red-700 border-0">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      硬门槛未满足
                    </Badge>
                  )}
                  {getMatchBadge(uni.matchScore)}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">匹配度</span>
                  <span className="font-semibold">{uni.matchScore}%</span>
                </div>
                <Progress
                  value={uni.matchScore}
                  className="h-2"
                />

                <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-gray-500">要求:</span>
                    <span className="font-medium">{uni.requirements.aLevel}</span>
                    <span className="text-gray-400">|</span>
                    <span className="font-medium">{uni.requirements.language}</span>
                    {uni.country === 'US' && (uni.requirements.sat || uni.requirements.act) && (
                      <>
                        <span className="text-gray-400">|</span>
                        <span className="font-medium">
                          {uni.requirements.sat && `SAT ${uni.requirements.sat}+`}
                          {uni.requirements.sat && uni.requirements.act && ' / '}
                          {uni.requirements.act && `ACT ${uni.requirements.act}+`}
                        </span>
                      </>
                    )}
                  </div>
                  {!uni.hardGate.ok && (
                    <div className="mt-1 text-xs text-red-600">
                      硬门槛：{uni.hardGate.reasons.slice(0, 3).join('；')}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>截止: {uni.deadline}</span>
                    {uni.notes && (
                      <span className="text-orange-600">· {uni.notes}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
