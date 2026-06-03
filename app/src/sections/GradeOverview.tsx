import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { studentApi, type GradeOverview as GradeOverviewType } from '@/services/api';
import { 
  Users, 
  BookOpen, 
  Target, 
  Languages,
  Award,
  School
} from 'lucide-react';

interface GradeOverviewProps {
  grade: string;
}

export function GradeOverview({ grade }: GradeOverviewProps) {
  const [data, setData] = useState<GradeOverviewType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await studentApi.getGradeOverview(grade);
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [grade]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-red-600">
        {error || '加载失败'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">学生总数</p>
                <p className="text-3xl font-bold text-slate-900">{data.totalStudents}</p>
              </div>
              <div className="w-10 h-10 bg-primary/15 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">已获Offer</p>
                <p className="text-3xl font-bold text-green-600">{data.universityStats?.offer_count || 0}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Award className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">平均雅思</p>
                <p className="text-3xl font-bold text-slate-900">
                  {data.languageStats?.avg_ielts ? data.languageStats.avg_ielts.toFixed(1) : '--'}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Languages className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">申请中</p>
                <p className="text-3xl font-bold text-orange-600">
                  {data.universityStats?.applying_count || 0}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 课程统计 */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              课程成绩概览
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.courseStats?.map((course, idx) => (
                <div key={idx} className="border border-slate-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{course.name}</span>
                      <Badge variant="secondary" className="text-xs">{course.board}</Badge>
                    </div>
                    <span className="text-sm text-slate-500">{course.student_count} 人</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">校内均分:</span>
                      <span className="ml-2 font-medium">
                        {course.avg_internal ? course.avg_internal.toFixed(1) : '--'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">模考均分:</span>
                      <span className="ml-2 font-medium">
                        {course.avg_mock ? course.avg_mock.toFixed(1) : '--'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {(!data.courseStats || data.courseStats.length === 0) && (
                <p className="text-center text-slate-400 py-4">暂无课程数据</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 申请进度 */}
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <School className="h-4 w-4 text-purple-600" />
              大学申请进度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-2xl font-bold text-primary">
                    {data.universityStats?.applying_count || 0}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">申请中</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {data.universityStats?.offer_count || 0}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">已获Offer</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">
                    {data.universityStats?.submitted_count || 0}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">已提交</p>
                </div>
              </div>

              {/* 语言成绩分布 */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-3">语言成绩情况</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">有雅思成绩</span>
                    <span className="font-medium">{data.languageStats?.has_ielts || 0} 人</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">平均分</span>
                    <span className="font-medium">
                      {data.languageStats?.avg_ielts ? data.languageStats.avg_ielts.toFixed(1) : '--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">最高分</span>
                    <span className="font-medium">
                      {data.languageStats?.max_ielts || '--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
