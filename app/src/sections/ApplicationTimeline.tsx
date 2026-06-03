import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { ApplicationTimeline as TimelineType } from '@/types/student';
import {
  Calendar,
  GraduationCap,
  FileText,
  MessageSquare,
  Award,
  MoreHorizontal,
  CheckCircle2,
} from 'lucide-react';

interface ApplicationTimelineProps {
  timeline: TimelineType[];
}

export function ApplicationTimeline({ timeline }: ApplicationTimelineProps) {
  // 按日期排序
  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const getTypeIcon = (type: TimelineType['type']) => {
    switch (type) {
      case 'exam':
        return <GraduationCap className="h-4 w-4" />;
      case 'application':
        return <FileText className="h-4 w-4" />;
      case 'interview':
        return <MessageSquare className="h-4 w-4" />;
      case 'decision':
        return <Award className="h-4 w-4" />;
      case 'other':
        return <MoreHorizontal className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: TimelineType['type']) => {
    switch (type) {
      case 'exam':
        return 'bg-primary/15 text-primary border-primary/25';
      case 'application':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'interview':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'decision':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'other':
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityBadge = (priority: TimelineType['priority']) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-700 border-0 text-xs">高优先级</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">中优先级</Badge>;
      case 'low':
        return <Badge className="bg-gray-100 text-gray-700 border-0 text-xs">低优先级</Badge>;
    }
  };

  // 计算距离事件的天数
  const getDaysUntil = (dateStr: string) => {
    const eventDate = new Date(dateStr);
    const today = new Date();
    const diffTime = eventDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card className="border-l-4 border-l-green-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-500" />
            申请时间线
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600">
              {sortedTimeline.filter((t) => !t.completed).length} 待办
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {/* 时间线轴线 */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

          {sortedTimeline.map((event, idx) => {
            const daysUntil = getDaysUntil(event.date);
            const isPast = daysUntil < 0;
            const isToday = daysUntil === 0;

            return (
              <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                {/* 时间线节点 */}
                <div
                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    event.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : isToday
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : isPast
                      ? 'bg-gray-300 border-gray-300 text-white'
                      : 'bg-white border-primary text-primary'
                  }`}
                >
                  {event.completed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    getTypeIcon(event.type)
                  )}
                </div>

                {/* 事件内容 */}
                <div
                  className={`flex-1 p-3 rounded-lg border ${
                    event.completed
                      ? 'bg-gray-50 border-gray-200 opacity-60'
                      : isToday
                      ? 'bg-orange-50 border-orange-200'
                      : isPast
                      ? 'bg-red-50 border-red-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4
                          className={`font-semibold ${
                            event.completed ? 'line-through text-gray-500' : ''
                          }`}
                        >
                          {event.title}
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getTypeColor(event.type)}`}
                        >
                          {event.type === 'exam'
                            ? '考试'
                            : event.type === 'application'
                            ? '申请'
                            : event.type === 'interview'
                            ? '面试'
                            : event.type === 'decision'
                            ? '结果'
                            : '其他'}
                        </Badge>
                        {getPriorityBadge(event.priority)}
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                        <span>{event.date}</span>
                        {!isPast && !event.completed && (
                          <span
                            className={`font-medium ${
                              daysUntil <= 7 ? 'text-red-600' : 'text-primary'
                            }`}
                          >
                            {isToday
                              ? '今天'
                              : daysUntil > 0
                              ? `还有 ${daysUntil} 天`
                              : `${Math.abs(daysUntil)} 天前`}
                          </span>
                        )}
                        {event.university && (
                          <span className="text-gray-400">· {event.university}</span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mt-2">{event.description}</p>
                    </div>

                    <Checkbox
                      checked={event.completed}
                      className="ml-2"
                      onCheckedChange={() => {}}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
