import { Fragment, useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { courseApi, type CourseDetail as CourseDetailType } from '@/services/api';
import {
  BookOpen,
  Users,
  TrendingUp,
  Award,
  Target,
} from 'lucide-react';

interface CourseDetailProps {
  courseId: string;
}

type EnrolledStudent = CourseDetailType['students'][number];

const ALL_GRADES = '__all__';

function studentGradeLabel(s: EnrolledStudent) {
  return s.grade?.trim() || '未设置年级';
}

function computeStats(students: EnrolledStudent[]) {
  const internalScores = students.map((s) => s.internal_score).filter(Boolean) as number[];
  const mockScores = students.map((s) => s.mock_score).filter(Boolean) as number[];
  const finalScores = students.map((s) => s.final_score).filter(Boolean) as number[];
  return {
    total_students: students.length,
    avg_internal: internalScores.length ? internalScores.reduce((a, b) => a + b, 0) / internalScores.length : 0,
    avg_mock: mockScores.length ? mockScores.reduce((a, b) => a + b, 0) / mockScores.length : 0,
    avg_final: finalScores.length ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length : 0,
    max_internal: internalScores.length ? Math.max(...internalScores) : 0,
    min_internal: internalScores.length ? Math.min(...internalScores) : 0,
  };
}

function computeGradeDistribution(students: EnrolledStudent[]) {
  const gradeCounts: Record<string, number> = {};
  students.forEach((s) => {
    if (s.internal_grade) {
      gradeCounts[s.internal_grade] = (gradeCounts[s.internal_grade] || 0) + 1;
    }
  });
  return Object.entries(gradeCounts).map(([grade, count]) => ({ grade, count }));
}

export function CourseDetail({ courseId }: CourseDetailProps) {
  const [data, setData] = useState<CourseDetailType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>(ALL_GRADES);

  useEffect(() => {
    setFilterGrade(ALL_GRADES);
  }, [courseId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await courseApi.getDetail(courseId);
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    if (courseId) {
      void fetchData();
    }
  }, [courseId]);

  const { filteredStudents, gradeOptions, stats, gradeDistribution, groupedForTable, gradeKeysOrdered } =
    useMemo(() => {
      if (!data) {
        return {
          filteredStudents: [] as EnrolledStudent[],
          gradeOptions: [] as string[],
          stats: null as ReturnType<typeof computeStats> | null,
          gradeDistribution: [] as { grade: string; count: number }[],
          groupedForTable: {} as Record<string, EnrolledStudent[]>,
          gradeKeysOrdered: [] as string[],
        };
      }
      const students = data.students;
      const gradeSet = new Set<string>();
      students.forEach((s) => gradeSet.add(studentGradeLabel(s)));
      const gradeOptions = Array.from(gradeSet).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

      const filtered =
        filterGrade === ALL_GRADES
          ? students
          : students.filter((s) => studentGradeLabel(s) === filterGrade);

      const groupedForTable: Record<string, EnrolledStudent[]> = {};
      filtered.forEach((s) => {
        const g = studentGradeLabel(s);
        if (!groupedForTable[g]) groupedForTable[g] = [];
        groupedForTable[g].push(s);
      });
      const gradeKeysOrdered = Object.keys(groupedForTable).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

      return {
        filteredStudents: filtered,
        gradeOptions,
        stats: computeStats(filtered),
        gradeDistribution: computeGradeDistribution(filtered),
        groupedForTable,
        gradeKeysOrdered,
      };
    }, [data, filterGrade]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !data || !stats) {
    return (
      <div className="text-center py-8 text-red-600">
        {error || '加载失败'}
      </div>
    );
  }

  const { course } = data;
  const totalEnrolled = data.students.length;

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A*':
        return 'bg-purple-100 text-purple-700';
      case 'A':
        return 'bg-green-100 text-green-700';
      case 'B':
        return 'bg-primary/15 text-primary';
      case 'C':
        return 'bg-yellow-100 text-yellow-700';
      case 'D':
        return 'bg-orange-100 text-orange-700';
      case 'E':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">{course.name}</h2>
            <Badge variant="secondary">{course.board}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            授课教师: {course.teacher_name || '待定'} | 最大人数: {course.max_students} 人
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">
            {filterGrade === ALL_GRADES ? '在读学生' : '当前筛选'}
          </p>
          <p className="text-2xl font-bold text-slate-900">{stats.total_students}</p>
          {filterGrade !== ALL_GRADES && totalEnrolled !== stats.total_students && (
            <p className="text-xs text-muted-foreground mt-0.5">全课共 {totalEnrolled} 人</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-4 py-3">
        <div className="space-y-1.5 flex-1 min-w-[12rem]">
          <Label className="text-xs text-muted-foreground">按学生年级查看</Label>
          <Select value={filterGrade} onValueChange={setFilterGrade}>
            <SelectTrigger className="w-full sm:max-w-xs bg-background">
              <SelectValue placeholder="选择年级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_GRADES}>
                全部年级（{totalEnrolled} 人）
              </SelectItem>
              {gradeOptions.map((g) => {
                const n = data.students.filter((s) => studentGradeLabel(s) === g).length;
                return (
                  <SelectItem key={g} value={g}>
                    {g}（{n} 人）
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground sm:pb-2">
          统计卡片与等级分布随筛选更新；课程本身不按届别拆分。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">校内均分</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.avg_internal ? stats.avg_internal.toFixed(1) : '--'}
                </p>
              </div>
              <div className="w-10 h-10 bg-primary/15 rounded-lg flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">模考均分</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.avg_mock ? stats.avg_mock.toFixed(1) : '--'}
                </p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">最高分</p>
                <p className="text-2xl font-bold text-green-600">{stats.max_internal || '--'}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">最低分</p>
                <p className="text-2xl font-bold text-orange-600">{stats.min_internal || '--'}</p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Award className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {gradeDistribution.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">成绩等级分布（当前筛选）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 h-32">
              {gradeDistribution.map((item, idx) => {
                const maxCount = Math.max(...gradeDistribution.map((g) => g.count));
                const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <div className="text-sm font-medium">{item.count}</div>
                    <div className="w-full bg-primary rounded-t" style={{ height: `${height}%` }} />
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getGradeColor(item.grade)}`}>
                      {item.grade}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            学生成绩详情
            {filterGrade === ALL_GRADES ? '（按年级分组）' : `（${filterGrade}）`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生姓名</TableHead>
                  <TableHead>年级</TableHead>
                  <TableHead>校内成绩</TableHead>
                  <TableHead>校内分数</TableHead>
                  <TableHead>模考成绩</TableHead>
                  <TableHead>实考成绩</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                      {totalEnrolled === 0 ? '暂无学生选课' : '该年级下暂无学生'}
                    </TableCell>
                  </TableRow>
                ) : filterGrade === ALL_GRADES ? (
                  gradeKeysOrdered.map((g) => (
                    <Fragment key={g}>
                      <TableRow>
                        <TableCell colSpan={7} className="bg-slate-50 text-slate-700 font-medium">
                          {g}（{groupedForTable[g].length}）
                        </TableCell>
                      </TableRow>
                      {groupedForTable[g].map((student) => (
                        <TableRow key={student.student_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{student.student_name}</p>
                              <p className="text-xs text-slate-500">{student.english_name}</p>
                            </div>
                          </TableCell>
                          <TableCell>{student.grade || '—'}</TableCell>
                          <TableCell>
                            {student.internal_grade ? (
                              <Badge className={getGradeColor(student.internal_grade)}>{student.internal_grade}</Badge>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </TableCell>
                          <TableCell>{student.internal_score || '--'}</TableCell>
                          <TableCell>
                            {student.mock_grade ? (
                              <Badge className={getGradeColor(student.mock_grade)}>{student.mock_grade}</Badge>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {student.final_grade ? (
                              <Badge className={getGradeColor(student.final_grade)}>{student.final_grade}</Badge>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {student.status === 'enrolled'
                                ? '在读'
                                : student.status === 'completed'
                                  ? '已完成'
                                  : '已退课'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))
                ) : (
                  filteredStudents.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{student.student_name}</p>
                          <p className="text-xs text-slate-500">{student.english_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{student.grade || '—'}</TableCell>
                      <TableCell>
                        {student.internal_grade ? (
                          <Badge className={getGradeColor(student.internal_grade)}>{student.internal_grade}</Badge>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </TableCell>
                      <TableCell>{student.internal_score || '--'}</TableCell>
                      <TableCell>
                        {student.mock_grade ? (
                          <Badge className={getGradeColor(student.mock_grade)}>{student.mock_grade}</Badge>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.final_grade ? (
                          <Badge className={getGradeColor(student.final_grade)}>{student.final_grade}</Badge>
                        ) : (
                          <span className="text-slate-400">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {student.status === 'enrolled'
                            ? '在读'
                            : student.status === 'completed'
                              ? '已完成'
                              : '已退课'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
