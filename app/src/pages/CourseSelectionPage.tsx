import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { academicApi, schedulingApi, type AcademicYear, type CourseOffering, type CourseRequest, type ScheduledLesson, type StudentAcademicRecord, type TeachingGroup } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, CalendarDays, Check, ClipboardCheck, RotateCcw, Send, Users } from 'lucide-react';

const requestStatusLabels: Record<string, string> = {
  draft: '草稿', submitted: '已提交', teacher_review: '教师审核', school_review: '学校审核', approved: '已批准', returned: '已退回', withdrawn: '已撤回',
};

export default function CourseSelectionPage() {
  const { user } = useAuth();
  if (user?.role === 'student') return <StudentSelection studentId={user.student_id || ''} />;
  return <SelectionReview canReview={user?.role === 'admin' || user?.role === 'staff' || user?.role === 'supervisor'} />;
}

function StudentSelection({ studentId }: { studentId: string }) {
  const [year, setYear] = useState<AcademicYear | null>(null);
  const [record, setRecord] = useState<StudentAcademicRecord | null>(null);
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [request, setRequest] = useState<CourseRequest | null>(null);
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const years = await academicApi.getYears();
    const active = years.find((item) => item.status === 'active') || years[0] || null;
    setYear(active);
    if (!active) return;
    const records = await academicApi.getStudentRecords(studentId);
    const activeRecord = records.find((item) => item.academic_year_id === active.id) || null;
    setRecord(activeRecord);
    if (!activeRecord) return;
    const [offeringRows, requests, schedule] = await Promise.all([
      academicApi.getOfferings({ academic_year_id: active.id, school_grade: String(activeRecord.school_grade) }),
      academicApi.getRequests({ academic_year_id: active.id, student_id: studentId }),
      schedulingApi.getPublishedMine(active.id),
    ]);
    const available = offeringRows.filter((item) => item.status === 'open');
    const existing = requests[0] || null;
    setOfferings(available); setRequest(existing); setLessons(schedule.lessons);
    setSelected(new Set([...(existing?.choices.map((choice) => choice.offering_id) || []), ...available.filter((item) => item.course_kind === 'required').map((item) => item.id)]));
  }, [studentId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  const canEdit = !request || ['draft', 'returned'].includes(request.status);
  const grouped = useMemo(() => {
    const groups = new Map<string, CourseOffering[]>();
    for (const offering of offerings) {
      const key = offering.board || '校内课程';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(offering);
    }
    return [...groups.entries()];
  }, [offerings]);

  const save = async () => {
    if (!year) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const choices = offerings.filter((item) => selected.has(item.id)).map((item, index) => ({ offering_id: item.id, preference: index + 1, choice_group: item.course_kind === 'required' ? `required-${item.id}` : 'electives' }));
      await academicApi.saveRequest(studentId, { academic_year_id: year.id, choices });
      setNotice('选课草稿已保存');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); } finally { setSaving(false); }
  };
  const submit = async () => {
    if (!request) return;
    setSaving(true); setError(''); setNotice('');
    try { await academicApi.submitRequest(request.id); setNotice('选课已提交，等待教师和学校审核'); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '提交失败'); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-[520px] w-full" /></div>;
  if (!record) return <Alert><AlertTriangle /><AlertTitle>当前学年学段档案尚未建立</AlertTitle><AlertDescription>请联系教务录入当前年级和 IGCSE/AS/A Level 阶段后再选课。系统不会根据入学届自动猜测。</AlertDescription></Alert>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1"><p className="text-sm font-medium text-primary">{year?.name} · {record.school_grade}年级 · {record.qualification_stage === 'A_LEVEL' ? 'A Level' : record.qualification_stage}</p><h1 className="text-2xl font-semibold tracking-tight">我的选课</h1><p className="text-sm text-muted-foreground">必修课已固定纳入；选修课提交后由教师和学校审核，最终以批准结果及发布课表为准。</p></div>
      {(error || notice) && <Alert variant={error ? 'destructive' : 'default'}>{error ? <AlertTriangle /> : <Check />}<AlertTitle>{error ? '操作未完成' : '操作成功'}</AlertTitle><AlertDescription>{error || notice}</AlertDescription></Alert>}
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>可选课程</CardTitle><CardDescription>当前共有 {offerings.length} 门课程开放；未开放或与学段不匹配的课程不会出现在这里。</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-5">
            {grouped.length === 0 ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">当前年级尚无开放选课的课程</div> : grouped.map(([board, rows]) => <section key={board} className="overflow-hidden rounded-lg border"><div className="border-b bg-muted/40 px-4 py-2 text-sm font-medium">{board}</div><Table><TableHeader><TableRow><TableHead>课程</TableHead><TableHead>代码</TableHead><TableHead>性质</TableHead><TableHead>周课时</TableHead><TableHead>容量</TableHead><TableHead className="text-right">选择</TableHead></TableRow></TableHeader><TableBody>{rows.map((offering) => { const checked = selected.has(offering.id); const required = offering.course_kind === 'required'; return <TableRow key={offering.id}><TableCell><div className="flex flex-col gap-0.5"><span className="font-medium">{offering.name}</span>{offering.prerequisites && <span className="text-xs text-muted-foreground">前置：{offering.prerequisites}</span>}</div></TableCell><TableCell className="font-mono text-xs">{offering.subject_code || '—'}</TableCell><TableCell><Badge variant={required ? 'secondary' : 'outline'}>{required ? '必修' : '选修'}</Badge></TableCell><TableCell>{offering.weekly_periods}</TableCell><TableCell>{offering.request_count || 0} / {offering.max_students}</TableCell><TableCell className="text-right"><Button size="sm" variant={checked ? 'default' : 'outline'} disabled={!canEdit || required} onClick={() => setSelected((current) => { const next = new Set(current); if (next.has(offering.id)) next.delete(offering.id); else next.add(offering.id); return next; })}>{checked && <Check data-icon="inline-start" />}{required ? '已纳入' : checked ? '已选择' : '选择'}</Button></TableCell></TableRow>; })}</TableBody></Table></section>)}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary" />提交与审批</CardTitle><CardDescription>当前状态：{request ? requestStatusLabels[request.status] || request.status : '尚未保存'}</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><div className="flex flex-col gap-2 rounded-lg border p-4 text-sm"><div className="flex justify-between gap-4"><span className="text-muted-foreground">已选择课程</span><span className="font-medium">{selected.size} 门</span></div><div className="flex justify-between gap-4"><span className="text-muted-foreground">总周课时</span><span className="font-medium">{offerings.filter((item) => selected.has(item.id)).reduce((sum, item) => sum + item.weekly_periods, 0)} 节</span></div></div>{request?.review_notes && <Alert><RotateCcw /><AlertTitle>审核意见</AlertTitle><AlertDescription>{request.review_notes}</AlertDescription></Alert>}<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><Button variant="outline" disabled={!canEdit || saving} onClick={save}>{saving ? '保存中…' : '保存草稿'}</Button><Button disabled={!request || !canEdit || saving} onClick={submit}><Send data-icon="inline-start" />提交选课</Button></div></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" />个人课表</CardTitle><CardDescription>{lessons.length > 0 ? '显示学校已发布课表中的本人教学班。' : '学校尚未发布本人课表。'}</CardDescription></CardHeader><CardContent>{lessons.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">选课批准并完成分班后，已发布课表会显示在这里。</div> : <div className="flex flex-col gap-2">{lessons.slice(0, 8).map((lesson) => <div key={lesson.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"><div className="flex flex-col gap-0.5"><span className="font-medium">周{['', '一', '二', '三', '四', '五', '六', '日'][lesson.weekday]} · 第{lesson.period_no}节</span><span className="text-xs text-muted-foreground">{lesson.offering_name} · {lesson.teacher_name}</span></div><Badge variant="outline">{lesson.room_code || '待定'}</Badge></div>)}</div>}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}

function SelectionReview({ canReview }: { canReview: boolean }) {
  const [requests, setRequests] = useState<CourseRequest[]>([]);
  const [groups, setGroups] = useState<TeachingGroup[]>([]);
  const [allocationTargets, setAllocationTargets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const load = () => Promise.all([academicApi.getRequests(), academicApi.getGroups()]).then(([requestRows, groupRows]) => { setRequests(requestRows); setGroups(groupRows); });
  useEffect(() => { let cancelled = false; load().catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  const review = async (request: CourseRequest, status: 'approved' | 'returned') => {
    setBusyId(request.id); setError('');
    try { await academicApi.reviewRequest(request.id, { status, review_notes: status === 'returned' ? '请根据学校课程方案调整后重新提交。' : '学校审核通过。', choices: request.choices.map((choice) => ({ id: choice.id, status: status === 'approved' ? 'approved' : 'requested' })) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '审核失败'); } finally { setBusyId(''); }
  };
  const allocate = async (request: CourseRequest, choiceId: string) => {
    const groupId = allocationTargets[choiceId]; if (!groupId) return;
    setBusyId(choiceId); setError('');
    try { await academicApi.allocateStudent(groupId, { student_id: request.student_id, source_request_id: request.id }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '分班失败'); } finally { setBusyId(''); }
  };
  return <div className="flex flex-col gap-6"><div className="flex flex-col gap-1"><p className="text-sm font-medium text-primary">学校选课工作台</p><h1 className="text-2xl font-semibold tracking-tight">选课申请与审核</h1><p className="text-sm text-muted-foreground">教师可查看学生选择；教务和学校审核保留最终控制权。批准后按班额和教师安排分配教学班。</p></div>{error && <Alert variant="destructive"><AlertTriangle /><AlertTitle>操作失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{loading ? <Skeleton className="h-96 w-full" /> : requests.length === 0 ? <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">尚无选课申请</div> : <div className="flex flex-col gap-4">{requests.map((request) => <Card key={request.id}><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{request.student_name || request.student_id}</CardTitle><CardDescription>{request.academic_year_name} · {request.choices.length} 门课程 · {request.submitted_at ? new Date(request.submitted_at).toLocaleString('zh-CN') : '未提交'}</CardDescription></div><Badge variant={request.status === 'approved' ? 'secondary' : 'outline'}>{requestStatusLabels[request.status] || request.status}</Badge></div></CardHeader><CardContent className="flex flex-col gap-4"><div className="flex flex-col gap-2">{request.choices.map((choice) => { const eligibleGroups = groups.filter((group) => group.offering_id === choice.offering_id && group.student_count < group.capacity); return <div key={choice.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><span className="text-sm font-medium">{choice.offering_name}</span><Badge variant="outline">{choice.status === 'approved' ? '已批准' : choice.status}</Badge>{choice.assigned_group_code && <Badge variant="secondary">已分班 · {choice.assigned_group_code}</Badge>}</div>{canReview && request.status === 'approved' && choice.status === 'approved' && !choice.assigned_group_id && <div className="flex min-w-0 gap-2"><Select value={allocationTargets[choice.id] || ''} onValueChange={(value) => setAllocationTargets((current) => ({ ...current, [choice.id]: value }))}><SelectTrigger className="w-52"><SelectValue placeholder={eligibleGroups.length ? '选择教学班' : '尚无可用教学班'} /></SelectTrigger><SelectContent><SelectGroup>{eligibleGroups.map((group) => <SelectItem key={group.id} value={group.id}>{group.code} · {group.student_count}/{group.capacity}</SelectItem>)}</SelectGroup></SelectContent></Select><Button size="sm" disabled={!allocationTargets[choice.id] || busyId === choice.id} onClick={() => allocate(request, choice.id)}>确认分班</Button></div>}</div>; })}</div>{canReview && ['submitted', 'teacher_review', 'school_review'].includes(request.status) && <div className="flex justify-end gap-2"><Button variant="outline" disabled={busyId === request.id} onClick={() => review(request, 'returned')}><RotateCcw data-icon="inline-start" />退回调整</Button><Button disabled={busyId === request.id} onClick={() => review(request, 'approved')}><Check data-icon="inline-start" />批准选课</Button></div>}</CardContent></Card>)}</div>}<Alert><Users /><AlertTitle>批准后仍需确认教学班</AlertTitle><AlertDescription>系统只允许匹配该课程且尚有名额的教学班；排课发布前还会再次检查学生、教师、教室和周课时冲突。</AlertDescription></Alert></div>;
}
