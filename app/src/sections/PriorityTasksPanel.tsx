import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import type { StudentDashboardData } from '@/types/student';
import {
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingUp,
  Calendar,
  BookOpen,
  Languages,
  Award,
  Users,
  FileText,
  Flame,
} from 'lucide-react';

interface PriorityTasksPanelProps {
  data: StudentDashboardData;
}

export function PriorityTasksPanel({ data }: PriorityTasksPanelProps) {
  // 合并所有待办事项
  const allTasks = [
    // 推荐任务
    ...data.recommendations.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      priority: r.priority,
      deadline: r.deadline,
      completed: r.completed,
      category: r.category,
      type: 'recommendation' as const,
    })),
    // 时间线任务
    ...data.timeline
      .filter((t) => !t.completed)
      .map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        deadline: t.date,
        completed: t.completed,
        category: 'timeline' as const,
        type: 'timeline' as const,
      })),
  ];

  // 按优先级排序
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedTasks = allTasks.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // 计算紧急程度（距离截止日期的天数）
  const getUrgency = (deadline?: string) => {
    if (!deadline) return null;
    const days = Math.ceil(
      (new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'academic':
        return <BookOpen className="h-4 w-4" />;
      case 'language':
        return <Languages className="h-4 w-4" />;
      case 'standardized':
        return <Award className="h-4 w-4" />;
      case 'extracurricular':
        return <Users className="h-4 w-4" />;
      case 'application':
        return <FileText className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            <Flame className="h-3 w-3 mr-1" />
            紧急
          </Badge>
        );
      case 'high':
        return (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
            <TrendingUp className="h-3 w-3 mr-1" />
            高
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            中
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-gray-500">
            低
          </Badge>
        );
    }
  };

  // 统计
  const completedCount = allTasks.filter((t) => t.completed).length;
  const totalCount = allTasks.length;
  const urgentCount = allTasks.filter((t) => t.priority === 'urgent' && !t.completed).length;
  const highCount = allTasks.filter((t) => t.priority === 'high' && !t.completed).length;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            待办事项与优先级
          </CardTitle>
          <div className="flex items-center gap-2">
            {urgentCount > 0 && (
              <Badge className="bg-red-100 text-red-700">
                <Flame className="h-3 w-3 mr-1" />
                {urgentCount} 紧急
              </Badge>
            )}
            {highCount > 0 && (
              <Badge className="bg-orange-100 text-orange-700">
                <TrendingUp className="h-3 w-3 mr-1" />
                {highCount} 高优
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 进度概览 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">整体完成度</span>
            <span className="text-sm font-medium">
              {completedCount}/{totalCount}
            </span>
          </div>
          <Progress value={(completedCount / totalCount) * 100} className="h-2" />
        </div>

        {/* 任务列表 */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {sortedTasks
            .filter((t) => !t.completed)
            .map((task, idx) => {
              const urgency = getUrgency(task.deadline);
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border hover:shadow-md transition-shadow ${
                    task.priority === 'urgent'
                      ? 'bg-red-50 border-red-200'
                      : task.priority === 'high'
                      ? 'bg-orange-50 border-orange-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{task.title}</span>
                        {getPriorityBadge(task.priority)}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          {getCategoryIcon(task.category)}
                          {task.category === 'academic'
                            ? '学术'
                            : task.category === 'language'
                            ? '语言'
                            : task.category === 'standardized'
                            ? '标化'
                            : task.category === 'extracurricular'
                            ? '活动'
                            : task.category === 'application'
                            ? '申请'
                            : '日程'}
                        </span>
                        {task.deadline && (
                          <span
                            className={`flex items-center gap-1 ${
                              urgency !== null && urgency <= 7
                                ? 'text-red-600 font-medium'
                                : ''
                            }`}
                          >
                            <Calendar className="h-3 w-3" />
                            {task.deadline}
                            {urgency !== null && (
                              <span>
                                ({urgency <= 0 ? '已过期' : `还有 ${urgency} 天`})
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {sortedTasks.filter((t) => !t.completed).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p>所有任务已完成！</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
