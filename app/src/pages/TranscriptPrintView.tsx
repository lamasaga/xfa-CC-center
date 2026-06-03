import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { studentApi, type LanguageScore, type StudentDashboard, type StudentCourse } from '@/services/api';
import { ArrowLeft, Printer } from 'lucide-react';

function groupLanguageScores(scores: LanguageScore[]) {
  const map = new Map<string, LanguageScore[]>();
  for (const s of scores) {
    const key = String(s.test_type || '其他');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => String(b.test_date || '').localeCompare(String(a.test_date || '')));
  }
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function computeUnitSummary(course: StudentCourse) {
  const units = Array.isArray(course.unitGrades) ? course.unitGrades : [];
  const finals = units.filter((u) => (u.exam_type === 'final' || u.exam_type === 'retake') && ((u.score || 0) > 0 || !!u.grade));
  if (finals.length === 0) return null;
  const denom = finals.reduce((s, u) => s + (u.max_score || 100), 0);
  const numer = finals.reduce((s, u) => s + (u.score || 0), 0);
  if (!denom) return null;
  const pct = Math.round((numer / denom) * 100);
  return { numer, denom, pct, count: finals.length };
}

function normalizeExamType(t: any): 'internal' | 'final' {
  if (t === 'final' || t === 'retake') return 'final';
  return 'internal';
}

function hasPublishedScore(u: any) {
  return (u?.score || 0) > 0 || !!u?.grade;
}

export default function TranscriptPrintView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<StudentDashboard | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) return;
    setIsLoading(true);
    setError('');
    studentApi
      .getDashboard(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const langGroups = useMemo(() => groupLanguageScores(data?.languageScores || []), [data]);

  if (isLoading) {
    return <div className="py-12 text-center text-slate-400">加载中...</div>;
  }
  if (!data || error) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600 mb-4">{error || '加载失败'}</p>
        <Button variant="outline" onClick={() => navigate('/students')}>返回学生管理</Button>
      </div>
    );
  }

  const s = data.student;
  const title = `${s.name} 成绩单`;
  const durationLabel = `${s.study_duration || 2}年制`;

  return (
    <div className="transcript-root">
      <div className="transcript-toolbar print:hidden sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border/70">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />返回
            </Button>
            <div className="min-w-0">
              <div className="font-semibold truncate">{title}</div>
              <div className="text-xs text-muted-foreground truncate">
                {s.grade}{s.school ? ` · 班级 ${s.school}` : ''} · {durationLabel}{s.expected_graduation_month ? ` · 预毕业 ${s.expected_graduation_month}` : ''}
              </div>
            </div>
          </div>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />打印/下载 PDF
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5 transcript-page">
        <div className="hidden print:block">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {s.english_name ? `${s.english_name} · ` : ''}{s.grade}{s.school ? ` · 班级 ${s.school}` : ''}
              </p>
            </div>
            <div className="text-xs text-muted-foreground text-right">
              <div>生成时间：{new Date().toLocaleString('zh-Hans-CN')}</div>
              <div>学制：{durationLabel}</div>
              {s.expected_graduation_month ? <div>预毕业：{s.expected_graduation_month}</div> : null}
            </div>
          </div>
        </div>

        <Card className="print:shadow-none print:border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">学生基本信息</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">姓名</div>
              <div className="font-medium">{s.name}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">年级</div>
              <div className="font-medium">{s.grade}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">班级</div>
              <div className="font-medium">{s.school || '--'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">学制 / 预毕业</div>
              <div className="font-medium">
                {durationLabel}{s.expected_graduation_month ? ` · ${s.expected_graduation_month}` : ''}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="print:shadow-none print:border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">课程与成绩</CardTitle>
          </CardHeader>
          <CardContent>
            {data.courses.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">暂无课程记录</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>课程</TableHead>
                    <TableHead>考试局</TableHead>
                    <TableHead>代码</TableHead>
                    <TableHead>校内</TableHead>
                    <TableHead>模考</TableHead>
                    <TableHead>实考</TableHead>
                    <TableHead className="text-right">单元汇总</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.courses.map((c) => {
                    const unitSummary = computeUnitSummary(c);
                    return (
                      <TableRow key={c.id} className="align-top">
                        <TableCell className="font-medium">
                          <div>{c.course_name || '未知课程'}</div>
                        </TableCell>
                        <TableCell>{c.board || '--'}</TableCell>
                        <TableCell>{c.subject_code || '--'}</TableCell>
                        <TableCell>
                          {c.internal_score ? (
                            <span>{c.internal_score}{c.internal_grade ? ` (${c.internal_grade})` : ''}</span>
                          ) : <span className="text-slate-400">--</span>}
                        </TableCell>
                        <TableCell>
                          {c.mock_score ? (
                            <span>{c.mock_score}{c.mock_grade ? ` (${c.mock_grade})` : ''}</span>
                          ) : <span className="text-slate-400">--</span>}
                        </TableCell>
                        <TableCell>
                          {c.final_score ? (
                            <span>{c.final_score}{c.final_grade ? ` (${c.final_grade})` : ''}</span>
                          ) : <span className="text-slate-400">--</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {unitSummary ? (
                            <div className="inline-flex items-center gap-2 justify-end">
                              <Badge variant="secondary">{unitSummary.pct}%</Badge>
                              <span className="text-xs text-muted-foreground">
                                {unitSummary.numer}/{unitSummary.denom} · {unitSummary.count}项
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">--</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* 单元明细（打印友好：按课程分块） */}
            {data.courses.some((c) => (c.unitGrades || []).length > 0) && (
              <div className="mt-6 space-y-4">
                <div className="text-sm font-medium">单元成绩明细</div>
                {data.courses.map((c) => {
                  const units = (c.unitGrades || []).filter((u) => !!u.unit_code || !!u.unit_name);
                  if (units.length === 0) return null;
                  const finalsAll = units
                    .filter((u) => normalizeExamType(u.exam_type) === 'final' && hasPublishedScore(u))
                    .sort((a, b) => String(a.exam_date || '').localeCompare(String(b.exam_date || '')));
                  const internalsRecent2 = units
                    .filter((u) => normalizeExamType(u.exam_type) === 'internal')
                    .sort((a, b) => String(b.exam_date || '').localeCompare(String(a.exam_date || '')))
                    .slice(0, 2)
                    .sort((a, b) => String(a.exam_date || '').localeCompare(String(b.exam_date || '')));
                  const sorted = [...internalsRecent2, ...finalsAll].sort((a, b) =>
                    String(a.exam_date || '').localeCompare(String(b.exam_date || ''))
                  );
                  return (
                    <div key={`${c.id}-units`} className="rounded-lg border p-3 print:break-inside-avoid">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="font-medium">{c.course_name || '未知课程'}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.board || '--'}{c.subject_code ? ` · ${c.subject_code}` : ''}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>单元</TableHead>
                              <TableHead>类型</TableHead>
                              <TableHead>日期</TableHead>
                              <TableHead className="text-right">得分</TableHead>
                              <TableHead className="text-right">等级</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sorted.map((u) => (
                              <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.unit_code || u.unit_name}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {normalizeExamType(u.exam_type) === 'final'
                                    ? (u.exam_type === 'retake' ? '实考（补考）' : '实考')
                                    : (u.exam_type === 'mock' ? '校内（模考）' : '校内')}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{u.exam_date || '--'}</TableCell>
                                <TableCell className="text-right">{u.score}/{u.max_score || 100}</TableCell>
                                <TableCell className="text-right">{u.grade || '--'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="print:shadow-none print:border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">语言成绩</CardTitle>
          </CardHeader>
          <CardContent>
            {data.languageScores.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm">暂无语言成绩记录</div>
            ) : (
              <div className="space-y-4">
                {langGroups.map(([type, list]) => (
                  <div key={type} className="rounded-lg border p-3 print:break-inside-avoid">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-medium">{type}</div>
                      <div className="text-xs text-muted-foreground">共 {list.length} 条</div>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>总分</TableHead>
                          <TableHead>听力</TableHead>
                          <TableHead>阅读</TableHead>
                          <TableHead>写作</TableHead>
                          <TableHead>口语</TableHead>
                          <TableHead>日期</TableHead>
                          <TableHead className="text-right">标记</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.overall_score}</TableCell>
                            <TableCell>{s.listening_score || '--'}</TableCell>
                            <TableCell>{s.reading_score || '--'}</TableCell>
                            <TableCell>{s.writing_score || '--'}</TableCell>
                            <TableCell>{s.speaking_score || '--'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.test_date || '--'}</TableCell>
                            <TableCell className="text-right">
                              {s.is_best_score ? <Badge className="bg-green-100 text-green-700 border-0">最佳</Badge> : <span className="text-slate-400 text-sm">--</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="hidden print:block text-xs text-muted-foreground">
          注：本成绩单为系统导出汇总，具体以官方成绩单/考试局结果为准。
        </div>
      </div>
    </div>
  );
}

