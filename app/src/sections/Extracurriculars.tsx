import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ExtracurricularActivity } from '@/types/student';
import {
  Trophy,
  Users,
  Heart,
  Palette,
  Dumbbell,
  MoreHorizontal,
  Clock,
  Calendar,
  Award,
} from 'lucide-react';

interface ExtracurricularsProps {
  activities: ExtracurricularActivity[];
}

export function Extracurriculars({ activities }: ExtracurricularsProps) {
  const getTypeIcon = (type: ExtracurricularActivity['type']) => {
    switch (type) {
      case 'academic':
        return <Trophy className="h-4 w-4" />;
      case 'leadership':
        return <Users className="h-4 w-4" />;
      case 'community':
        return <Heart className="h-4 w-4" />;
      case 'arts':
        return <Palette className="h-4 w-4" />;
      case 'sports':
        return <Dumbbell className="h-4 w-4" />;
      case 'other':
        return <MoreHorizontal className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: ExtracurricularActivity['type']) => {
    switch (type) {
      case 'academic':
        return 'bg-primary/15 text-primary border-primary/25';
      case 'leadership':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'community':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'arts':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'sports':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'other':
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getTypeLabel = (type: ExtracurricularActivity['type']) => {
    switch (type) {
      case 'academic':
        return '学术';
      case 'leadership':
        return '领导力';
      case 'community':
        return '社区服务';
      case 'arts':
        return '艺术';
      case 'sports':
        return '体育';
      case 'other':
        return '其他';
    }
  };

  return (
    <Card className="border-l-4 border-l-pink-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-pink-500" />
            课外活动
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-pink-600">
              {activities.length} 项
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 统计概览 */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(['academic', 'leadership', 'community', 'sports'] as const).map((type) => {
            const count = activities.filter((a) => a.type === type).length;
            return (
              <div key={type} className="text-center p-2 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-700">{count}</p>
                <p className="text-xs text-gray-500">{getTypeLabel(type)}</p>
              </div>
            );
          })}
        </div>

        {/* 活动列表 */}
        <div className="space-y-3">
          {activities.map((activity, idx) => (
            <div
              key={idx}
              className="border rounded-lg p-3 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${getTypeColor(
                      activity.type
                    )}`}
                  >
                    {getTypeIcon(activity.type)}
                  </div>
                  <div>
                    <h4 className="font-semibold">{activity.name}</h4>
                    <p className="text-sm text-gray-500">
                      {activity.organization} · {activity.role}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {getTypeLabel(activity.type)}
                </Badge>
              </div>

              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {activity.startDate}
                  {activity.endDate && ` - ${activity.endDate}`}
                  {activity.ongoing && ' (进行中)'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {activity.hoursPerWeek}小时/周
                </span>
              </div>

              <p className="text-sm text-gray-600 mt-2">{activity.description}</p>

              {activity.achievements.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {activity.achievements.map((achievement, aidx) => (
                    <Badge
                      key={aidx}
                      variant="outline"
                      className="text-xs flex items-center gap-1"
                    >
                      <Award className="h-3 w-3" />
                      {achievement}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
