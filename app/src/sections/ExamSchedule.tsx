import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ExamSchedule as ExamScheduleType, RetakePlan } from '@/types/student';
import { Calendar, Clock, MapPin, AlertCircle, CheckCircle, BookOpen, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ExamScheduleProps {
  exams: ExamScheduleType[];
  retakePlans: RetakePlan[];
}

export function ExamScheduleSection({ exams, retakePlans }: ExamScheduleProps) {
  // 按日期排序
  const sortedExams = [...exams].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const upcomingExams = sortedExams.filter((e) => e.status === 'upcoming');

  const getStatusBadge = (status: ExamScheduleType['status']) => {
    switch (status) {
      case 'upcoming':
        return (
          <Badge className="bg-primary/15 text-primary border-0">
            <Clock className="h-3 w-3 mr-1" />
            即将开始
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-700 border-0">
            <CheckCircle className="h-3 w-3 mr-1" />
            已完成
          </Badge>
        );
      case 'missed':
        return (
          <Badge className="bg-red-100 text-red-700 border-0">
            <AlertCircle className="h-3 w-3 mr-1" />
            缺考
          </Badge>
        );
    }
  };

  const getPreparationStatusBadge = (status: RetakePlan['preparationStatus']) => {
    switch (status) {
      case 'not_started':
        return <Badge variant="outline">未开始</Badge>;
      case 'planning':
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-0">规划中</Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-primary/15 text-primary border-0">进行中</Badge>
        );
      case 'ready':
        return (
          <Badge className="bg-green-100 text-green-700 border-0">已就绪</Badge>
        );
    }
  };

  // 计算距离考试的天数
  const getDaysUntil = (dateStr: string) => {
    const examDate = new Date(dateStr);
    const today = new Date();
    const diffTime = examDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-500" />
            考试安排
          </CardTitle>
          <Badge variant="outline" className="text-orange-600">
            待考: {upcomingExams.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="schedule">考试日程</TabsTrigger>
            <TabsTrigger value="retake">补考计划</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-3">
            {upcomingExams.length > 0 ? (
              upcomingExams.map((exam, idx) => {
                const daysUntil = getDaysUntil(exam.date);
                return (
                  <div
                    key={idx}
                    className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                      daysUntil <= 7 ? 'border-red-300 bg-red-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            daysUntil <= 7
                              ? 'bg-red-100 text-red-600'
                              : 'bg-primary/15 text-primary'
                          }`}
                        >
                          <span className="text-lg font-bold">{daysUntil}</span>
                        </div>
                        <div>
                          <h4 className="font-semibold">
                            {exam.subject} - {exam.unit}
                          </h4>
                          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {exam.date}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {exam.time} ({exam.duration}分钟)
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <MapPin className="h-4 w-4" />
                            {exam.venue}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(exam.status)}
                        <p className="text-xs text-gray-500 mt-1">{exam.examBoard}</p>
                      </div>
                    </div>
                    {daysUntil <= 7 && (
                      <div className="mt-3 p-2 bg-red-100 rounded text-sm text-red-700 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        考试临近，请做好最后冲刺准备！
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>暂无 upcoming 考试</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="retake" className="space-y-3">
            {retakePlans.length > 0 ? (
              retakePlans.map((plan, idx) => (
                <div
                  key={idx}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-orange-500" />
                      <h4 className="font-semibold">
                        {plan.subject} - {plan.unit}
                      </h4>
                    </div>
                    {getPreparationStatusBadge(plan.preparationStatus)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="p-2 bg-red-50 rounded">
                      <p className="text-xs text-gray-500">原始成绩</p>
                      <p className="text-lg font-semibold text-red-600">
                        {plan.originalGrade} ({plan.originalScore})
                      </p>
                    </div>
                    <div className="p-2 bg-green-50 rounded">
                      <p className="text-xs text-gray-500">目标成绩</p>
                      <p className="text-lg font-semibold text-green-600">
                        {plan.targetGrade} ({plan.targetScore})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm">
                        需提升: <span className="font-semibold">+{plan.targetScore - plan.originalScore}</span> 分
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      计划日期: {plan.plannedDate}
                    </span>
                  </div>

                  {plan.notes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                      {plan.notes}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                <p>暂无补考计划</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
