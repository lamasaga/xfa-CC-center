import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { StudentDashboardData } from '@/types/student';
import {
  Zap,
  BookOpen,
  Target,
  Calendar,
  TrendingUp,
  ArrowRight,
  Lightbulb,
  CheckCircle,
} from 'lucide-react';

interface QuickActionsPanelProps {
  data: StudentDashboardData;
}

export function QuickActionsPanel({ data }: QuickActionsPanelProps) {
  // 生成智能建议
  const generateSuggestions = () => {
    const suggestions = [];

    // 1. 检查补考需求
    const retakeSubjects = data.aLevelSubjects.filter((s) => s.needsRetake);
    if (retakeSubjects.length > 0) {
      const upcomingRetake = data.retakePlans[0];
      if (upcomingRetake) {
        suggestions.push({
          type: 'urgent',
          title: `补考冲刺: ${upcomingRetake.subject} ${upcomingRetake.unit}`,
          description: `距离补考还有时间，建议每天投入2小时专项练习，重点突破薄弱环节`,
          action: '查看补考计划',
          icon: BookOpen,
          color: 'red',
        });
      }
    }

    // 2. 检查语言成绩
    const bestIelts = data.languageScores.find((s) => s.type === 'IELTS' && s.bestScore);
    if (!bestIelts || bestIelts.overall < 7) {
      suggestions.push({
        type: 'high',
        title: '雅思成绩待提升',
        description: '目标院校普遍要求雅思7.0+，建议报名 upcoming 考试并加强写作训练',
        action: '查看语言规划',
        icon: Target,
        color: 'orange',
      });
    }

    // 3. 检查申请进度
    const unsubmitted = data.targetUniversities.filter(
      (u) => u.applicationStatus === 'not_started'
    );
    if (unsubmitted.length > 0) {
      const urgentUni = unsubmitted.find((u) => {
        const days = Math.ceil(
          (new Date(u.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return days <= 30;
      });
      if (urgentUni) {
        suggestions.push({
          type: 'urgent',
          title: `申请截止临近: ${urgentUni.name}`,
          description: `截止日期: ${urgentUni.deadline}，请尽快准备申请材料`,
          action: '查看申请清单',
          icon: Calendar,
          color: 'red',
        });
      }
    }

    // 4. 检查课外活动
    if (data.extracurriculars.length < 3) {
      suggestions.push({
        type: 'medium',
        title: '丰富课外经历',
        description: '建议增加1-2个高质量的课外活动，提升综合竞争力',
        action: '查看活动建议',
        icon: TrendingUp,
        color: 'yellow',
      });
    }

    // 5. 检查入学考试
    const hasCambridge = data.targetUniversities.some(
      (u) => u.name.includes('Cambridge') && u.applicationStatus !== 'offer'
    );
    if (hasCambridge) {
      suggestions.push({
        type: 'high',
        title: 'STEP考试准备',
        description: '剑桥大学数学专业需要STEP II/III Grade 1，建议开始真题练习',
        action: '查看备考计划',
        icon: BookOpen,
        color: 'orange',
      });
    }

    return suggestions.slice(0, 4); // 最多显示4条
  };

  const suggestions = generateSuggestions();

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; text: string; badge: string }> = {
      red: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800',
        badge: 'bg-red-100 text-red-700',
      },
      orange: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800',
        badge: 'bg-orange-100 text-orange-700',
      },
      yellow: {
        bg: 'bg-yellow-50',
        border: 'border-yellow-200',
        text: 'text-yellow-800',
        badge: 'bg-yellow-100 text-yellow-700',
      },
    };
    return colors[color] || colors.yellow;
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'urgent':
        return '紧急';
      case 'high':
        return '高优先级';
      case 'medium':
        return '建议';
      default:
        return '提示';
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            智能行动建议
          </CardTitle>
          <Badge variant="outline" className="text-yellow-600">
            <Lightbulb className="h-3 w-3 mr-1" />
            AI生成
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {suggestions.map((suggestion, idx) => {
            const colors = getColorClasses(suggestion.color);
            return (
              <div
                key={idx}
                className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 ${colors.text}`}>
                    <suggestion.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold ${colors.text}`}>
                        {suggestion.title}
                      </span>
                      <Badge className={`text-xs ${colors.badge}`}>
                        {getTypeLabel(suggestion.type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{suggestion.description}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`${colors.text} hover:${colors.bg} p-0 h-auto`}
                    >
                      {suggestion.action}
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {suggestions.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
            <p className="text-gray-600">当前状态良好，暂无紧急事项</p>
            <p className="text-sm text-gray-400 mt-1">继续保持，定期查看更新</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
