import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { academicApi, schedulingApi, type AcademicYear, type Room, type ScheduleConflictReport, type ScheduledLesson, type ScheduleVersion, type TeacherAvailability, type TimeSlot } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, CalendarClock, Check, CircleAlert, Lock, LockOpen, Play, Plus, RefreshCw, Send, Warehouse } from 'lucide-react';

const weekdays = [1, 2, 3, 4, 5];
const weekdayLabels: Record<number, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五' };

export default function SchedulingPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'staff';
  if (!canManage) return user?.role === 'teacher' ? <TeacherScheduleWorkspace /> : <PublishedSchedulePage />;
  return <ScheduleCommandCenter />;
}

function TeacherScheduleWorkspace() {
  return <div className="flex flex-col gap-6"><TeacherAvailabilityCard /><PublishedSchedulePage /></div>;
}

function TeacherAvailabilityCard() {
  const [year, setYear] = useState<AcademicYear | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [values, setValues] = useState<Map<string, TeacherAvailability['availability']>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false;
    academicApi.getYears().then(async (years) => {
      const active = years.find((item) => item.status === 'active') || years[0] || null;
      if (!active) return;
      const [slotRows, availability] = await Promise.all([schedulingApi.getTimeSlots(active.id), schedulingApi.getAvailability()]);
      if (!cancelled) {
        setYear(active); setSlots(slotRows);
        setValues(new Map(availability.map((item) => [item.time_slot_id, item.availability])));
      }
    }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const periodRows = useMemo(() => [...new Map(slots.map((slot) => [slot.period_no, slot])).values()].sort((a, b) => a.period_no - b.period_no), [slots]);
  const slotByCell = useMemo(() => new Map(slots.map((slot) => [`${slot.weekday}-${slot.period_no}`, slot])), [slots]);
  const cycle = (slotId: string) => setValues((current) => {
    const next = new Map(current); const value = current.get(slotId) || 'available';
    next.set(slotId, value === 'available' ? 'preferred' : value === 'preferred' ? 'unavailable' : 'available');
    return next;
  });
  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      await schedulingApi.saveAvailability(slots.map((slot) => ({ time_slot_id: slot.id, availability: values.get(slot.id) || 'available' })));
      setNotice('可用时间已保存；学校排课会把“不可用”作为硬约束，把“优先”作为偏好。');
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); } finally { setSaving(false); }
  };
  const label = (value: TeacherAvailability['availability']) => value === 'preferred' ? '优先' : value === 'unavailable' ? '不可用' : '可用';
  const tone = (value: TeacherAvailability['availability']) => value === 'unavailable' ? 'border-destructive/40 bg-destructive/10 text-destructive' : value === 'preferred' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground';
  return <Card><CardHeader><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>我的可用时间</CardTitle><CardDescription>{year?.name || '当前学年'} · 点击格子在可用、优先和不可用之间切换。</CardDescription></div><Button disabled={saving || slots.length === 0} onClick={save}>{saving ? '保存中…' : '保存可用时间'}</Button></div></CardHeader><CardContent className="flex flex-col gap-4">{(error || notice) && <Alert variant={error ? 'destructive' : 'default'}>{error ? <AlertTriangle /> : <Check />}<AlertDescription>{error || notice}</AlertDescription></Alert>}{loading ? <Skeleton className="h-64 w-full" /> : slots.length === 0 ? <Alert><CalendarClock /><AlertTitle>学校尚未建立时间表</AlertTitle><AlertDescription>请联系教务先初始化当前学年的上课节次。</AlertDescription></Alert> : <div className="min-w-0 overflow-auto rounded-lg border"><div className="min-w-[760px]"><div className="grid grid-cols-[90px_repeat(5,1fr)] border-b bg-muted/50"><div className="p-3 text-xs text-muted-foreground">节次</div>{weekdays.map((day) => <div key={day} className="border-l p-3 text-center text-sm font-medium">{weekdayLabels[day]}</div>)}</div>{periodRows.map((period) => <div key={period.period_no} className="grid grid-cols-[90px_repeat(5,1fr)] border-b last:border-b-0"><div className="p-3 text-sm"><p className="font-medium">第{period.period_no}节</p><p className="text-xs text-muted-foreground">{period.starts_at}–{period.ends_at}</p></div>{weekdays.map((day) => { const slot = slotByCell.get(`${day}-${period.period_no}`); if (!slot) return <div key={day} className="border-l p-2" />; const value = values.get(slot.id) || 'available'; return <div key={day} className="border-l p-2"><button type="button" className={`w-full rounded-md border px-2 py-3 text-xs font-medium transition-colors ${tone(value)}`} aria-label={`${weekdayLabels[day]}第${period.period_no}节：${label(value)}`} onClick={() => cycle(slot.id)}>{label(value)}</button></div>; })}</div>)}</div></div>}</CardContent></Card>;
}

function ScheduleCommandCenter() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [versions, setVersions] = useState<ScheduleVersion[]>([]);
  const [versionId, setVersionId] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  const [report, setReport] = useState<ScheduleConflictReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([academicApi.getYears(), schedulingApi.getRooms()])
      .then(([yearRows, roomRows]) => { if (!cancelled) { setYears(yearRows); setRooms(roomRows); setYearId((current) => current || yearRows.find((year) => year.status === 'active')?.id || yearRows[0]?.id || ''); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    if (!yearId) return;
    let cancelled = false;
    Promise.all([schedulingApi.getVersions(yearId), schedulingApi.getTimeSlots(yearId)])
      .then(([versionRows, slotRows]) => { if (!cancelled) { setVersions(versionRows); setSlots(slotRows); setVersionId((current) => versionRows.some((item) => item.id === current) ? current : versionRows[0]?.id || ''); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); });
    return () => { cancelled = true; };
  }, [yearId, refresh]);

  const loadGrid = useCallback(async () => {
    if (!versionId) { setLessons([]); setReport(null); return; }
    const grid = await schedulingApi.getGrid(versionId);
    setLessons(grid.lessons); setReport(grid.report);
  }, [versionId]);
  useEffect(() => { let cancelled = false; loadGrid().catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '课表加载失败'); }); return () => { cancelled = true; }; }, [loadGrid, refresh]);

  const periodRows = useMemo(() => [...new Map(slots.map((slot) => [slot.period_no, slot])).values()].sort((a, b) => a.period_no - b.period_no), [slots]);
  const slotByCell = useMemo(() => new Map(slots.map((slot) => [`${slot.weekday}-${slot.period_no}`, slot])), [slots]);
  const lessonsByCell = useMemo(() => {
    const map = new Map<string, ScheduledLesson[]>();
    for (const lesson of lessons) { const key = `${lesson.weekday}-${lesson.period_no}`; if (!map.has(key)) map.set(key, []); map.get(key)?.push(lesson); }
    return map;
  }, [lessons]);
  const currentVersion = versions.find((version) => version.id === versionId);

  const runAction = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key); setError(''); setNotice('');
    try { await action(); setNotice(success); setRefresh((value) => value + 1); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '操作失败'); } finally { setBusy(''); }
  };
  const moveLesson = async (lessonId: string, target: TimeSlot) => {
    const lesson = lessons.find((item) => item.id === lessonId);
    if (!lesson || lesson.time_slot_id === target.id || !currentVersion || currentVersion.status !== 'draft') return;
    await runAction(`move-${lesson.id}`, () => schedulingApi.updateLesson(versionId, lesson.id, { teaching_group_id: lesson.teaching_group_id, time_slot_id: target.id, room_id: lesson.room_id, teacher_user_id: lesson.teacher_user_id, is_locked: !!lesson.is_locked }), '课节已移动并重新检查冲突');
  };
  const toggleLock = async (lesson: ScheduledLesson) => runAction(`lock-${lesson.id}`, () => schedulingApi.updateLesson(versionId, lesson.id, { teaching_group_id: lesson.teaching_group_id, time_slot_id: lesson.time_slot_id, room_id: lesson.room_id, teacher_user_id: lesson.teacher_user_id, is_locked: !lesson.is_locked }), lesson.is_locked ? '课节已解锁' : '课节已锁定，重新排课时将保留');

  if (loading) return <div className="flex flex-col gap-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-[620px] w-full" /></div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex flex-col gap-1"><p className="text-sm font-medium text-primary">学校排课指挥台</p><h1 className="text-2xl font-semibold tracking-tight">排课、冲突与发布</h1><p className="text-sm text-muted-foreground">自动排课只生成草案；锁定、调整、冲突检查和最终发布始终由学校控制。</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={yearId} onValueChange={setYearId}><SelectTrigger className="w-40"><SelectValue placeholder="选择学年" /></SelectTrigger><SelectContent><SelectGroup>{years.map((year) => <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>)}</SelectGroup></SelectContent></Select>
          <Select value={versionId} onValueChange={setVersionId}><SelectTrigger className="w-48"><SelectValue placeholder="选择排课版本" /></SelectTrigger><SelectContent><SelectGroup>{versions.map((version) => <SelectItem key={version.id} value={version.id}>{version.name} · {version.status === 'published' ? '已发布' : version.status}</SelectItem>)}</SelectGroup></SelectContent></Select>
          <CreateVersionDialog yearId={yearId} versions={versions} onCreated={() => setRefresh((value) => value + 1)} />
          <RoomDialog onCreated={() => setRefresh((value) => value + 1)} />
        </div>
      </div>

      {(error || notice) && <Alert variant={error ? 'destructive' : 'default'}>{error ? <AlertTriangle /> : <Check />}<AlertTitle>{error ? '操作未完成' : '操作成功'}</AlertTitle><AlertDescription>{error || notice}</AlertDescription></Alert>}

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant={currentVersion?.status === 'published' ? 'secondary' : 'outline'}>{currentVersion?.status === 'published' ? '已发布' : currentVersion ? `草案 · ${currentVersion.name}` : '尚无版本'}</Badge>
          <span className="text-muted-foreground">{lessons.length} 个课节</span>
          <span className="text-muted-foreground">{lessons.filter((lesson) => lesson.is_locked).length} 个已锁定</span>
          <span className="text-muted-foreground">{rooms.length} 间可用教室</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {slots.length === 0 && <Button variant="outline" disabled={!yearId || busy === 'slots'} onClick={() => runAction('slots', () => schedulingApi.bootstrapTimeSlots(yearId), '已建立周一至周五的八节课时间模板')}><CalendarClock data-icon="inline-start" />初始化时间表</Button>}
          <Button variant="outline" disabled={!versionId || busy !== '' || currentVersion?.status !== 'draft'} onClick={() => runAction('generate', () => schedulingApi.generate(versionId), '排课草案已重新生成')}><Play data-icon="inline-start" />运行排课</Button>
          <Button variant="outline" disabled={!versionId || busy !== ''} onClick={() => runAction('check', () => schedulingApi.getConflicts(versionId).then(setReport), '冲突检查已完成')}><RefreshCw data-icon="inline-start" />检查冲突</Button>
          <Button disabled={!versionId || busy !== '' || !report?.can_publish || currentVersion?.status === 'published'} onClick={() => runAction('publish', () => schedulingApi.publish(versionId), '课表已发布，学生和教师现在可以查看')}><Send data-icon="inline-start" />发布课表</Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 overflow-auto rounded-lg border bg-card">
          {periodRows.length === 0 ? <div className="flex min-h-[520px] flex-col items-center justify-center gap-3 p-8 text-center"><CalendarClock className="size-10 text-muted-foreground" /><div><p className="font-medium">尚未建立时间槽</p><p className="text-sm text-muted-foreground">先初始化学校时间表，再创建排课版本并运行排课。</p></div></div> : (
            <div className="min-w-[920px]">
              <div className="grid grid-cols-[100px_repeat(5,minmax(160px,1fr))] border-b bg-muted/50"><div className="p-3 text-xs font-medium text-muted-foreground">节次 / 时间</div>{weekdays.map((day) => <div key={day} className="border-l p-3 text-center text-sm font-medium">{weekdayLabels[day]}</div>)}</div>
              {periodRows.map((period) => <div key={period.period_no} className="grid min-h-[112px] grid-cols-[100px_repeat(5,minmax(160px,1fr))] border-b last:border-b-0"><div className="flex flex-col gap-1 p-3"><span className="text-sm font-medium">第{period.period_no}节</span><span className="text-xs text-muted-foreground">{period.starts_at}–{period.ends_at}</span></div>{weekdays.map((day) => { const slot = slotByCell.get(`${day}-${period.period_no}`); const cellLessons = lessonsByCell.get(`${day}-${period.period_no}`) || []; return <div key={day} className="flex flex-col gap-2 border-l p-2" onDragOver={(event) => { if (slot && currentVersion?.status === 'draft') event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); const lessonId = event.dataTransfer.getData('text/x-xfa-lesson'); if (slot && lessonId) void moveLesson(lessonId, slot); }}>{cellLessons.map((lesson) => <div key={lesson.id} draggable={currentVersion?.status === 'draft' && !lesson.is_locked} onDragStart={(event) => event.dataTransfer.setData('text/x-xfa-lesson', lesson.id)} className="group flex flex-col gap-1 rounded-md border border-primary/20 bg-primary/5 p-2 text-xs"><div className="flex items-start justify-between gap-2"><span className="font-semibold text-foreground">{lesson.group_code}</span><button type="button" aria-label={lesson.is_locked ? '解锁课节' : '锁定课节'} disabled={currentVersion?.status !== 'draft' || busy !== ''} className="text-muted-foreground hover:text-foreground disabled:opacity-50" onClick={() => void toggleLock(lesson)}>{lesson.is_locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}</button></div><span>{lesson.offering_name}</span><span className="text-muted-foreground">{lesson.teacher_name} · {lesson.room_code || '待定'}</span><span className="text-muted-foreground">{lesson.school_grade}年级 · {lesson.student_count || 0} 人</span></div>)}</div>; })}</div>)}
            </div>
          )}
        </div>

        <Card className="h-fit 2xl:sticky 2xl:top-4"><CardHeader><CardTitle className="flex items-center gap-2"><CircleAlert className="size-5 text-primary" />冲突与未安排</CardTitle><CardDescription>只有硬冲突为零且课时全部满足时才允许发布。</CardDescription></CardHeader><CardContent className="flex flex-col gap-4">{!report ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">选择版本后检查冲突</div> : <><div className="grid grid-cols-2 gap-2"><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">硬冲突</p><p className="mt-1 text-2xl font-semibold tabular-nums">{report.hard_conflict_count}</p></div><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">缺少课时</p><p className="mt-1 text-2xl font-semibold tabular-nums">{report.missing_period_count}</p></div></div><ConflictBlock title="学生冲突" count={report.student_conflicts.length} /><ConflictBlock title="教师不可用" count={report.unavailable_teachers.length} /><ConflictBlock title="未指定教师" count={report.groups_without_teachers.length} /><ConflictBlock title="教室超容量" count={report.rooms_over_capacity.length} />{report.missing_periods.length > 0 && <div className="flex flex-col gap-2"><p className="text-sm font-medium">未满足课时</p>{report.missing_periods.slice(0, 8).map((item) => <div key={item.teaching_group_id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs"><span className="truncate">{item.code} · {item.name}</span><Badge variant="outline">缺 {item.missing_periods} 节</Badge></div>)}</div>}<Alert variant={report.can_publish ? 'default' : 'destructive'}>{report.can_publish ? <Check /> : <AlertTriangle />}<AlertTitle>{report.can_publish ? '可以发布' : '尚不可发布'}</AlertTitle><AlertDescription>{report.can_publish ? '所有硬约束与周课时检查已通过。' : '请先修复右侧问题，系统不会绕过发布闸门。'}</AlertDescription></Alert></>}</CardContent></Card>
      </div>
    </div>
  );
}

function ConflictBlock({ title, count }: { title: string; count: number }) {
  return <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"><span>{title}</span><Badge variant={count > 0 ? 'destructive' : 'secondary'}>{count}</Badge></div>;
}

function CreateVersionDialog({ yearId, versions, onCreated }: { yearId: string; versions: ScheduleVersion[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false); const [name, setName] = useState(''); const [base, setBase] = useState('none'); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const submit = async () => { setSaving(true); setError(''); try { await schedulingApi.createVersion({ academic_year_id: yearId, name, based_on_id: base === 'none' ? undefined : base }); setOpen(false); setName(''); setBase('none'); onCreated(); } catch (reason) { setError(reason instanceof Error ? reason.message : '创建失败'); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><Plus data-icon="inline-start" />新建版本</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>新建排课版本</DialogTitle><DialogDescription>可从现有版本复制后调整；发布新版本会归档之前已发布的版本。</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="version-name">版本名称</FieldLabel><Input id="version-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：第一轮排课草案" /></Field><Field><FieldLabel>基于版本</FieldLabel><Select value={base} onValueChange={setBase}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="none">空白版本</SelectItem>{versions.map((version) => <SelectItem key={version.id} value={version.id}>{version.name} · {version.status}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>{error && <Alert variant="destructive"><AlertTriangle /><AlertDescription>{error}</AlertDescription></Alert>}</FieldGroup><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={saving || !yearId || !name.trim()} onClick={submit}>{saving ? '创建中…' : '创建版本'}</Button></DialogFooter></DialogContent></Dialog>;
}

function RoomDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [form, setForm] = useState({ code: '', name: '', capacity: '30', type: 'classroom', campus: '' });
  const submit = async () => { setSaving(true); setError(''); try { await schedulingApi.createRoom({ code: form.code, name: form.name, capacity: Number(form.capacity), room_type: form.type, campus: form.campus || null }); setOpen(false); setForm({ code: '', name: '', capacity: '30', type: 'classroom', campus: '' }); onCreated(); } catch (reason) { setError(reason instanceof Error ? reason.message : '创建失败'); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><Warehouse data-icon="inline-start" />新增教室</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>新增教室资源</DialogTitle><DialogDescription>排课只使用状态正常且容量满足教学班人数的教室。</DialogDescription></DialogHeader><FieldGroup><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="room-code">教室代码</FieldLabel><Input id="room-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="A201" /></Field><Field><FieldLabel htmlFor="room-name">教室名称</FieldLabel><Input id="room-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="二层标准教室" /></Field><Field><FieldLabel htmlFor="room-capacity">容量</FieldLabel><Input id="room-capacity" type="number" min={1} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></Field><Field><FieldLabel htmlFor="room-campus">校区</FieldLabel><Input id="room-campus" value={form.campus} onChange={(event) => setForm({ ...form, campus: event.target.value })} placeholder="主校区" /></Field></div>{error && <Alert variant="destructive"><AlertTriangle /><AlertDescription>{error}</AlertDescription></Alert>}</FieldGroup><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={saving || !form.code.trim() || !form.name.trim()} onClick={submit}>{saving ? '保存中…' : '保存教室'}</Button></DialogFooter></DialogContent></Dialog>;
}

function PublishedSchedulePage() {
  const [year, setYear] = useState<AcademicYear | null>(null); const [lessons, setLessons] = useState<ScheduledLesson[]>([]); const [version, setVersion] = useState<ScheduleVersion | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => { let cancelled = false; academicApi.getYears().then((years) => { const active = years.find((item) => item.status === 'active') || years[0] || null; setYear(active); return active ? schedulingApi.getPublishedMine(active.id) : { version: null, lessons: [] }; }).then((result) => { if (!cancelled) { setVersion(result.version); setLessons(result.lessons); } }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); }).finally(() => { if (!cancelled) setLoading(false); }); return () => { cancelled = true; }; }, []);
  if (loading) return <Skeleton className="h-[560px] w-full" />;
  return <div className="flex flex-col gap-6"><div className="flex flex-col gap-1"><p className="text-sm font-medium text-primary">{year?.name || '当前学年'}</p><h1 className="text-2xl font-semibold tracking-tight">我的课表</h1><p className="text-sm text-muted-foreground">只显示学校正式发布的课表版本。</p></div>{error && <Alert variant="destructive"><AlertTriangle /><AlertDescription>{error}</AlertDescription></Alert>}{!version ? <Alert><CalendarClock /><AlertTitle>学校尚未发布课表</AlertTitle><AlertDescription>草案不会展示给学生和普通教师。</AlertDescription></Alert> : <Card><CardHeader><CardTitle>{version.name}</CardTitle><CardDescription>发布时间：{version.published_at ? new Date(version.published_at).toLocaleString('zh-CN') : '—'}</CardDescription></CardHeader><CardContent><div className="min-w-0 overflow-auto rounded-lg border"><div className="min-w-[760px]"><div className="grid grid-cols-[90px_repeat(5,1fr)] border-b bg-muted/50"><div className="p-3 text-xs text-muted-foreground">节次</div>{weekdays.map((day) => <div key={day} className="border-l p-3 text-center text-sm font-medium">{weekdayLabels[day]}</div>)}</div>{[...new Set(lessons.map((lesson) => lesson.period_no))].sort((a, b) => a - b).map((period) => <div key={period} className="grid min-h-24 grid-cols-[90px_repeat(5,1fr)] border-b last:border-b-0"><div className="p-3 text-sm font-medium">第{period}节</div>{weekdays.map((day) => <div key={day} className="flex flex-col gap-2 border-l p-2">{lessons.filter((lesson) => lesson.weekday === day && lesson.period_no === period).map((lesson) => <div key={lesson.id} className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs"><p className="font-semibold">{lesson.offering_name}</p><p className="mt-1 text-muted-foreground">{lesson.teacher_name} · {lesson.room_code || '待定'}</p></div>)}</div>)}</div>)}</div></div></CardContent></Card>}</div>;
}
