import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { RecommendationPlan } from '@/types/student';
import {
  Lightbulb,
  BookOpen,
  Languages,
  Award,
  Users,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  User,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface RecommendationsProps {
  recommendations: RecommendationPlan[];
}

export function Recommendations({ recommendations }: RecommendationsProps) {
  const getCategoryIcon = (category: RecommendationPlan['category']) => {
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
    }
  };

  const getCategoryColor = (category: RecommendationPlan['category']) => {
    switch (category) {
      case 'academic':
        return 'bg-primary/15 text-primary border-primary/25';
      case 'language':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'standardized':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'extracurricular':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      case 'application':
        return 'bg-orange-100 text-orange-700 border-orange-200';
    }
  };

  const getCategoryLabel = (category: RecommendationPlan['category']) => {
    switch (category) {
      case 'academic':
        return '学术';
      case 'language':
        return '语言';
      case 'standardized':
        return '标化';
      case 'extracurricular':
        return '活动';
      case 'application':
        return '申请';
    }
  };

  const getPriorityBadge = (priority: RecommendationPlan['priority']) => {
    switch (priority) {
      case 'urgent':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            紧急
          </Badge>
        );
      case 'high':
        return (
          <Badge className="bg-orange-100 text-orange-700 border-orange-200 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            高
          </Badge>
        );
      case 'medium':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            中
          </Badge>
        );
      case 'low':
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-200 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            低
          </Badge>
        );
    }
  };

  // 按优先级排序
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedRecommendations = [...recommendations].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // 计算完成进度
  const completedCount = recommendations.filter((r) => r.completed).length;
  const progressPercentage = Math.round((completedCount / recommendations.length) * 100);

  // 按类别分组统计
  const categoryStats = recommendations.reduce((acc, rec) => {
    acc[rec.category] = (acc[rec.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="border-l-4 border-l-yellow-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            升学策略建议
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-yellow-600">
              {completedCount}/{recommendations.length} 完成
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 进度概览 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">整体进度</span>
            <span className="text-sm font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* 类别统计 */}
        <div className="grid grid-cols-5 gap-1 mb-4">
          {(['academic', 'language', 'standardized', 'extracurricular', 'application'] as const).map(
            (cat) => (
              <div key={cat} className="text-center p-2 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-700">{categoryStats[cat] || 0}</p>
                <p className="text-[10px] text-gray-500">{getCategoryLabel(cat)}</p>
              </div>
            )
          )}
        </div>

        {/* 建议列表 */}
        <div className="space-y-2">
          {sortedRecommendations.map((rec, idx) => (
            <div
              key={idx}
              className={`border rounded-lg p-3 hover:shadow-md transition-shadow ${
                rec.completed ? 'bg-gray-50 opacity-60' : ''
              } ${rec.priority === 'urgent' ? 'border-red-300 bg-red-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <Checkbox checked={rec.completed} className="mt-1" onCheckedChange={() => {}} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4
                      className={`font-semibold ${rec.completed ? 'line-through text-gray-500' : ''}`}
                    >
                      {rec.title}
                    </h4>
                    <Badge
                      variant="outline"
                      className={`text-xs ${getCategoryColor(rec.category)}`}
                    >
                      {getCategoryIcon(rec.category)}
                      <span className="ml-1">{getCategoryLabel(rec.category)}</span>
                    </Badge>
                    {getPriorityBadge(rec.priority)}
                  </div>
                  <p
                    className={`text-sm mt-1 ${rec.completed ? 'text-gray-400' : 'text-gray-600'}`}
                  >
                    {rec.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    {rec.deadline && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        截止: {rec.deadline}
                      </span>
                    )}
                    {rec.assignedTo && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        负责: {rec.assignedTo}
                      </span>
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
