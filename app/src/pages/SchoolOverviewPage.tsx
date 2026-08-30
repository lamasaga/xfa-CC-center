import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { academicApi, type AcademicOverview } from '@/services/api';
import { AlertTriangle, ArrowRight, BookOpenCheck, CalendarDays, ClipboardCheck, DatabaseBackup, School, Users } from 'lucide-react';

const expectedStages = [
  { grade: 9, stage: 'IGCSE', label: '9年级 IGCSE' },
  { grade: 10, stage: 'IGCSE', label: '10年级 IGCSE' },
  { grade: 11, stage: 'AS', label: '11年级 AS' },
  { grade: 12, stage: 'A_LEVEL', label: '12年级 A Level' },
] as const;

export default function SchoolOverviewPage() {
  const [data, setData] = useState<AcademicOverview | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    academicApi.getOverview()
      .then((result) => { if (!cancelled) setData(result); })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); });
    return () => { cancelled = true; };
  }, []);

  const stageRows = useMemo(() => expectedStages.map((item) => ({
    ...item,
    studentCount: data?.grade_stages.find((row) => row.school_grade === item.grade && row.qualification_stage === item.stage)?.student_count || 0,
  })), [data]);

  if (error) {
    return <Alert variant="destructive"><AlertTriangle /><AlertTitle>学校总览加载失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;
  }

  if (!data) {
    return <div className="flex flex-col gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /><Skeleton className="h-72 w-full" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-primary">{data.academic_year?.name || '未设置当前学年'}</p>
          <h1 className="text-2xl font-semibold tracking-tight">学校总览</h1>
          <p className="text-sm text-muted-foreground">从九年级 IGCSE 到十二年级 A Level 的课程、选课与课表状态。</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/curriculum"><BookOpenCheck data-icon="inline-start" />查看课程与官方资讯</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><School className="size-5 text-primary" />年级与学段覆盖</CardTitle>
          <CardDescription>人数只统计已建立当前学年记录的在读学生；未录入不会被推测。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-4">
            {stageRows.map((row) => (
              <div key={row.label} className="flex flex-col gap-3 bg-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{row.label}</span>
                  <Badge variant={row.studentCount > 0 ? 'secondary' : 'outline'}>{row.studentCount > 0 ? '已覆盖' : '待录入'}</Badge>
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-semibold tabular-nums">{row.studentCount}</span>
                  <span className="pb-1 text-sm text-muted-foreground">名学生</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={ClipboardCheck} title="待处理选课" value={data.pending_requests} unit="份" href="/selection" action="进入审核" attention={data.pending_requests > 0} />
        <SummaryCard icon={BookOpenCheck} title="本学年开课" value={data.offering_count} unit="门" href="/course-planning" action="管理开课" />
        <SummaryCard icon={Users} title="教学班" value={data.teaching_group_count} unit="个" href="/course-planning?tab=groups" action="查看教学班" />
        <SummaryCard icon={CalendarDays} title="已发布课表" value={data.published_schedule ? 1 : 0} unit="版" href="/scheduling" action={data.published_schedule ? '查看课表' : '开始排课'} attention={!data.published_schedule} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>一体化实施状态</CardTitle>
            <CardDescription>这里显示真实配置情况，不用示例统计填充空白。</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>环节</TableHead><TableHead>当前状态</TableHead><TableHead className="text-right">下一步</TableHead></TableRow></TableHeader>
              <TableBody>
                <StatusRow label="学段档案" ready={stageRows.every((row) => row.studentCount > 0)} readyText="9–12 年级已覆盖" pendingText="仍有学段未录入" href="/students" />
                <StatusRow label="学校开课" ready={data.offering_count > 0} readyText={`${data.offering_count} 门已配置`} pendingText="尚未配置本学年开课" href="/course-planning" />
                <StatusRow label="教学班" ready={data.teaching_group_count > 0} readyText={`${data.teaching_group_count} 个教学班`} pendingText="尚未组建教学班" href="/course-planning?tab=groups" />
                <StatusRow label="课表发布" ready={!!data.published_schedule} readyText={data.published_schedule?.name || '已发布'} pendingText="尚无已发布课表" href="/scheduling" />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DatabaseBackup className="size-5 text-primary" />资料与数据保护</CardTitle>
            <CardDescription>课程规则只引用已核验的官方来源，业务升级采用独立迁移版本。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4 rounded-lg border p-4">
              <div className="flex flex-col gap-1"><span className="text-sm text-muted-foreground">已核验官方来源</span><span className="text-3xl font-semibold tabular-nums">{data.verified_source_count}</span></div>
              <Button variant="outline" size="sm" asChild><Link to="/curriculum?tab=sources">查看来源<ArrowRight data-icon="inline-end" /></Link></Button>
            </div>
            <Alert><DatabaseBackup /><AlertTitle>上线保护已启用</AlertTitle><AlertDescription>数据库迁移具备版本记录，发布前必须完成备份、完整性校验与恢复演练。</AlertDescription></Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, title, value, unit, href, action, attention = false }: { icon: typeof Users; title: string; value: number; unit: string; href: string; action: string; attention?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Icon className="size-5 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-end gap-2"><span className="text-3xl font-semibold tabular-nums">{value}</span><span className="pb-1 text-sm text-muted-foreground">{unit}</span>{attention && <Badge variant="outline" className="mb-1">待处理</Badge>}</div>
        <Button variant="outline" size="sm" asChild><Link to={href}>{action}<ArrowRight data-icon="inline-end" /></Link></Button>
      </CardContent>
    </Card>
  );
}

function StatusRow({ label, ready, readyText, pendingText, href }: { label: string; ready: boolean; readyText: string; pendingText: string; href: string }) {
  return <TableRow><TableCell className="font-medium">{label}</TableCell><TableCell><Badge variant={ready ? 'secondary' : 'outline'}>{ready ? readyText : pendingText}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" asChild><Link to={href}>处理<ArrowRight data-icon="inline-end" /></Link></Button></TableCell></TableRow>;
}
