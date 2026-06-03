import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TargetUniversity } from '@/types/student';
import { Target, Flag, CheckCircle, Clock, AlertCircle, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TargetUniversitiesProps {
  universities: TargetUniversity[];
}

export function TargetUniversities({ universities }: TargetUniversitiesProps) {
  const getStatusBadge = (status: TargetUniversity['status']) => {
    switch (status) {
      case 'reach':
        return (
          <Badge className="bg-purple-100 text-purple-700 border-0">
            <Target className="h-3 w-3 mr-1" />
            冲刺校
          </Badge>
        );
      case 'target':
        return (
          <Badge className="bg-primary/15 text-primary border-0">
            <Flag className="h-3 w-3 mr-1" />
            目标校
          </Badge>
        );
      case 'safety':
        return (
          <Badge className="bg-green-100 text-green-700 border-0">
            <CheckCircle className="h-3 w-3 mr-1" />
            保底校
          </Badge>
        );
    }
  };

  const getApplicationStatusBadge = (status: TargetUniversity['applicationStatus']) => {
    switch (status) {
      case 'not_started':
        return (
          <Badge variant="outline" className="text-gray-500">
            <Clock className="h-3 w-3 mr-1" />
            未开始
          </Badge>
        );
      case 'preparing':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-0">
            <AlertCircle className="h-3 w-3 mr-1" />
            准备中
          </Badge>
        );
      case 'submitted':
        return (
          <Badge className="bg-primary/15 text-primary border-0">
            <CheckCircle className="h-3 w-3 mr-1" />
            已提交
          </Badge>
        );
      case 'offer':
        return (
          <Badge className="bg-green-100 text-green-700 border-0">
            <CheckCircle className="h-3 w-3 mr-1" />
            已录取
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-100 text-red-700 border-0">
            <XCircle className="h-3 w-3 mr-1" />
            被拒
          </Badge>
        );
    }
  };

  const getCountryFlag = (country: TargetUniversity['country']) => {
    const flags: Record<string, string> = {
      UK: '🇬🇧',
      US: '🇺🇸',
      Canada: '🇨🇦',
      Australia: '🇦🇺',
      'Hong Kong': '🇭🇰',
      Singapore: '🇸🇬',
      Other: '🌍',
    };
    return flags[country] || '🌍';
  };

  // 按状态分组
  const reachSchools = universities.filter((u) => u.status === 'reach');
  const targetSchools = universities.filter((u) => u.status === 'target');
  const safetySchools = universities.filter((u) => u.status === 'safety');

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            目标院校
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-purple-600">
              {universities.length} 所
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 统计概览 */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center p-2 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{reachSchools.length}</p>
              <p className="text-xs text-gray-600">冲刺校</p>
            </div>
            <div className="text-center p-2 bg-primary/10 rounded-lg">
              <p className="text-2xl font-bold text-primary">{targetSchools.length}</p>
              <p className="text-xs text-gray-600">目标校</p>
            </div>
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{safetySchools.length}</p>
              <p className="text-xs text-gray-600">保底校</p>
            </div>
          </div>

          {/* 学校列表 */}
          <div className="space-y-3">
            {universities.map((uni, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getCountryFlag(uni.country)}</span>
                    <div>
                      <h3 className="font-semibold">{uni.name}</h3>
                      <p className="text-sm text-gray-500">
                        QS排名: #{uni.ranking} · {uni.course}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getStatusBadge(uni.status)}
                    {getApplicationStatusBadge(uni.applicationStatus)}
                  </div>
                </div>

                {/* 录取要求 */}
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">录取要求</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      A-Level: {uni.requirements.aLevel}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      语言: {uni.requirements.language}
                    </Badge>
                    {uni.requirements.subjectRequirements?.map((req, ridx) => (
                      <Badge key={ridx} variant="outline" className="text-xs">
                        {req}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 截止日期和备注 */}
                <div className="mt-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-gray-500">
                      截止: <span className="font-medium text-gray-700">{uni.deadline}</span>
                    </span>
                  </div>
                  {uni.notes && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="text-xs cursor-help">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            备注
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>{uni.notes}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
