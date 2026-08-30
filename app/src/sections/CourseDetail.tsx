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

function getFinalScore(student: EnrolledStudent): number | null {
  const derived = student.score_summary?.final?.score;
  if (typeof derived === 'number') return derived;
  const legacy = student.final_score;
  return typeof legacy === 'number' && legacy >= 0 ? legacy : null;
}

function formatScore(score: number | null) {
  return score === null ? '--' : Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function computeStats(students: EnrolledStudent[]) {
  const finalScores = students.map(getFinalScore).filter((score): score is number => score !== null);
  return {
    total_students: students.length,
    avg_final: finalScores.length ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length : 0,
    max_final: finalScores.length ? Math.max(...finalScores) : 0,
    min_final: finalScores.length ? Math.min(...finalScores) : 0,
    students_with_final: finalScores.length,
  };
}

function FinalUnitScoreList({ student }: { student: EnrolledStudent }) {
  const units = student.score_summary?.final?.units || [];
  if (units.length > 0) {
    return (
      <div className="flex min-w-[18rem] flex-wrap gap-1.5">
        {units.map((unit) => (
          <span
            key={`${unit.unit_code}-${unit.exam_date || ''}`}
            className="inline-flex items-baseline gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
            title={`${unit.unit_name || unit.unit_code}：${unit.score}/${unit.max_score}${unit.exam_type === 'retake' ? '（补考最佳）' : ''}`}
          >
            <span className="font-medium">{unit.unit_code || unit.unit_name}</span>
            <span className="tabular-nums font-semibold text-slate-900">{formatScore(unit.score)}</span>
            <span className="text-slate-400">/{formatScore(unit.max_score)}</span>
            {unit.exam_type === 'retake' && <span className="text-emerald-700">补考最佳</span>}
          </span>
        ))}
      </div>
    );
  }

  const legacyFinalScore = getFinalScore(student);
  return legacyFinalScore === null ? (
    <span className="text-slate-400">暂无实考单元成绩</span>
  ) : (
    <span className="text-xs text-slate-500">已登记实考均分 {formatScore(legacyFinalScore)}（暂无单元明细）</span>
  );
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

  const { filteredStudents, gradeOptions, stats, groupedForTable, gradeKeysOrdered } =
    useMemo(() => {
      if (!data) {
        return {
          filteredStudents: [] as EnrolledStudent[],
          gradeOptions: [] as string[],
          stats: null as ReturnType<typeof computeStats> | null,
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
          仅展示实际考试单元成绩；同一单元有补考时自动保留较高的一次。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">实考均分</p>
                <p className="text-2xl font-bold text-slate-900">
                  {stats.students_with_final ? stats.avg_final.toFixed(1) : '--'}
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
                <p className="text-sm text-slate-500">最高实考均分</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.students_with_final ? stats.max_final.toFixed(1) : '--'}
                </p>
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
                <p className="text-sm text-slate-500">最低实考均分</p>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.students_with_final ? stats.min_final.toFixed(1) : '--'}
                </p>
              </div>
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Award className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">已录入实考</p>
                <p className="text-2xl font-bold text-slate-900">{stats.students_with_final}</p>
              </div>
              <div className="w-10 h-10 bg-primary/15 rounded-lg flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <TableHead className="min-w-[22rem]">实考单元成绩（取最好一次）</TableHead>
                  <TableHead>实考均分</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                      {totalEnrolled === 0 ? '暂无学生选课' : '该年级下暂无学生'}
                    </TableCell>
                  </TableRow>
                ) : filterGrade === ALL_GRADES ? (
                  gradeKeysOrdered.map((g) => (
                    <Fragment key={g}>
                      <TableRow>
                        <TableCell colSpan={5} className="bg-slate-50 text-slate-700 font-medium">
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
                          <TableCell><FinalUnitScoreList student={student} /></TableCell>
                          <TableCell className="font-medium tabular-nums">
                            {getFinalScore(student) === null ? '--' : `${formatScore(getFinalScore(student))} 分`}
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
                      <TableCell><FinalUnitScoreList student={student} /></TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {getFinalScore(student) === null ? '--' : `${formatScore(getFinalScore(student))} 分`}
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
