import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { academicApi, type AcademicYear, type CourseOffering, type CurriculumSpec, type TeachingGroup, type User } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, BookOpenCheck, Plus } from 'lucide-react';

const stageByGrade: Record<number, 'IGCSE' | 'AS' | 'A_LEVEL'> = { 9: 'IGCSE', 10: 'IGCSE', 11: 'AS', 12: 'A_LEVEL' };

export default function CoursePlanningPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [yearId, setYearId] = useState('');
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);
  const [groups, setGroups] = useState<TeachingGroup[]>([]);
  const [specs, setSpecs] = useState<CurriculumSpec[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const tab = searchParams.get('tab') === 'groups' ? 'groups' : 'offerings';
  const canManage = user?.role === 'admin' || user?.role === 'staff';

  useEffect(() => {
    let cancelled = false;
    Promise.all([academicApi.getYears(), academicApi.getSpecs(), academicApi.getTeachers()])
      .then(([yearRows, specRows, teacherRows]) => {
        if (cancelled) return;
        setYears(yearRows); setSpecs(specRows); setTeachers(teacherRows);
        setYearId((current) => current || yearRows.find((year) => year.status === 'active')?.id || yearRows[0]?.id || '');
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!yearId) return;
    let cancelled = false;
    Promise.all([academicApi.getOfferings({ academic_year_id: yearId }), academicApi.getGroups(yearId)])
      .then(([offeringRows, groupRows]) => { if (!cancelled) { setOfferings(offeringRows); setGroups(groupRows); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); });
    return () => { cancelled = true; };
  }, [yearId, refresh]);

  const currentYear = years.find((year) => year.id === yearId);
  const groupedOfferings = useMemo(() => [9, 10, 11, 12].map((grade) => ({ grade, rows: offerings.filter((item) => item.school_grade === grade) })), [offerings]);

  if (error) return <Alert variant="destructive"><AlertTriangle /><AlertTitle>开课计划加载失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1"><p className="text-sm font-medium text-primary">{currentYear?.name || '选择学年'}</p><h1 className="text-2xl font-semibold tracking-tight">开课与教学班</h1><p className="text-sm text-muted-foreground">课程规范、学校开课和实际教学班分开管理，保留考试局版本与教师配置。</p></div>
        <Select value={yearId} onValueChange={setYearId}><SelectTrigger className="w-44"><SelectValue placeholder="选择学年" /></SelectTrigger><SelectContent><SelectGroup>{years.map((year) => <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>)}</SelectGroup></SelectContent></Select>
      </div>
      {loading ? <Skeleton className="h-96 w-full" /> : (
        <Tabs value={tab} onValueChange={(value) => setSearchParams(value === 'groups' ? { tab: 'groups' } : {})}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList><TabsTrigger value="offerings">学校开课（{offerings.length}）</TabsTrigger><TabsTrigger value="groups">教学班（{groups.length}）</TabsTrigger></TabsList>
            {canManage && tab === 'offerings' && <CreateOfferingDialog yearId={yearId} specs={specs} onCreated={() => setRefresh((value) => value + 1)} />}
            {canManage && tab === 'groups' && <CreateGroupDialog offerings={offerings} teachers={teachers} onCreated={() => setRefresh((value) => value + 1)} />}
          </div>
          <TabsContent value="offerings" className="flex flex-col gap-4">
            {groupedOfferings.map(({ grade, rows }) => (
              <section key={grade} className="overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center justify-between border-b px-4 py-3"><div className="flex items-center gap-2"><BookOpenCheck className="size-4 text-primary" /><h2 className="font-medium">{grade}年级 · {stageByGrade[grade] === 'A_LEVEL' ? 'A Level' : stageByGrade[grade]}</h2></div><Badge variant="outline">{rows.length} 门</Badge></div>
                <Table><TableHeader><TableRow><TableHead>课程</TableHead><TableHead>考试局 / 代码</TableHead><TableHead>课程性质</TableHead><TableHead>每周课时</TableHead><TableHead>班额上限</TableHead><TableHead>教学班</TableHead><TableHead>选课申请</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
                  <TableBody>{rows.length === 0 ? <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">该年级尚未配置开课</TableCell></TableRow> : rows.map((offering) => <TableRow key={offering.id}><TableCell><div className="flex flex-col gap-0.5"><span className="font-medium">{offering.name}</span>{offering.version_label && <span className="text-xs text-muted-foreground">{offering.version_label}</span>}</div></TableCell><TableCell>{offering.board ? `${offering.board} · ${offering.subject_code || '待录入'}` : '校内课程 / 待关联'}</TableCell><TableCell>{offering.course_kind === 'required' ? '必修' : '选修'}</TableCell><TableCell>{offering.weekly_periods}</TableCell><TableCell>{offering.max_students}</TableCell><TableCell>{offering.teaching_group_count || 0}</TableCell><TableCell>{offering.request_count || 0}</TableCell><TableCell><Badge variant={offering.status === 'open' ? 'secondary' : 'outline'}>{offering.status === 'open' ? '开放选课' : offering.status}</Badge></TableCell></TableRow>)}</TableBody>
                </Table>
              </section>
            ))}
          </TabsContent>
          <TabsContent value="groups" className="overflow-hidden rounded-lg border bg-card">
            <Table><TableHeader><TableRow><TableHead>教学班</TableHead><TableHead>课程</TableHead><TableHead>学段</TableHead><TableHead>任课教师</TableHead><TableHead>周课时</TableHead><TableHead>人数 / 容量</TableHead><TableHead>状态</TableHead></TableRow></TableHeader>
              <TableBody>{groups.length === 0 ? <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">尚未组建教学班。教学班是排课的最小单位。</TableCell></TableRow> : groups.map((group) => <TableRow key={group.id}><TableCell><div className="flex flex-col gap-0.5"><span className="font-medium">{group.code}</span><span className="text-xs text-muted-foreground">{group.name}</span></div></TableCell><TableCell>{group.offering_name}</TableCell><TableCell>{group.school_grade}年级 · {group.qualification_stage === 'A_LEVEL' ? 'A Level' : group.qualification_stage}</TableCell><TableCell>{group.teacher_names || '未指定'}</TableCell><TableCell>{group.weekly_periods}</TableCell><TableCell>{group.student_count} / {group.capacity}</TableCell><TableCell><Badge variant="secondary">规划中</Badge></TableCell></TableRow>)}</TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function CreateOfferingDialog({ yearId, specs, onCreated }: { yearId: string; specs: CurriculumSpec[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', grade: '9', specId: 'none', kind: 'elective', periods: '4', capacity: '30', status: 'draft' });
  const submit = async () => {
    setSaving(true); setError('');
    try {
      const grade = Number(form.grade);
      await academicApi.createOffering({ academic_year_id: yearId, curriculum_spec_id: form.specId === 'none' ? null : form.specId, name: form.name, school_grade: grade, qualification_stage: stageByGrade[grade], term: 'full_year', course_kind: form.kind as 'required' | 'elective', weekly_periods: Number(form.periods), max_students: Number(form.capacity), status: form.status as 'draft' | 'open' });
      setOpen(false); setForm({ name: '', grade: '9', specId: 'none', kind: 'elective', periods: '4', capacity: '30', status: 'draft' }); onCreated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus data-icon="inline-start" />新增开课</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>新增学校开课</DialogTitle><DialogDescription>先选择真实课程规范；尚未核对时可以暂不关联，但开放选课前应补齐。</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel htmlFor="offering-name">课程名称</FieldLabel><Input id="offering-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：IGCSE Mathematics" /></Field><Field><FieldLabel>年级与阶段</FieldLabel><Select value={form.grade} onValueChange={(value) => setForm({ ...form, grade: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{[9, 10, 11, 12].map((grade) => <SelectItem key={grade} value={String(grade)}>{grade}年级 · {stageByGrade[grade] === 'A_LEVEL' ? 'A Level' : stageByGrade[grade]}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel>课程规范</FieldLabel><Select value={form.specId} onValueChange={(value) => setForm({ ...form, specId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="none">暂不关联</SelectItem>{specs.filter((spec) => spec.status !== 'expired').map((spec) => <SelectItem key={spec.id} value={spec.id}>{spec.board} · {spec.subject_code} · {spec.subject_name}</SelectItem>)}</SelectGroup></SelectContent></Select><FieldDescription>只显示未过期规范。</FieldDescription></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>课程性质</FieldLabel><Select value={form.kind} onValueChange={(value) => setForm({ ...form, kind: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="required">必修</SelectItem><SelectItem value="elective">选修</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel>状态</FieldLabel><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="draft">草案</SelectItem><SelectItem value="open">开放选课</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="periods">每周课时</FieldLabel><Input id="periods" type="number" min={1} max={20} value={form.periods} onChange={(event) => setForm({ ...form, periods: event.target.value })} /></Field><Field><FieldLabel htmlFor="capacity">选课人数上限</FieldLabel><Input id="capacity" type="number" min={1} max={500} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></Field></div>{error && <Alert variant="destructive"><AlertTriangle /><AlertDescription>{error}</AlertDescription></Alert>}</FieldGroup><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={saving || !form.name.trim()} onClick={submit}>{saving ? '保存中…' : '保存开课'}</Button></DialogFooter></DialogContent></Dialog>;
}

function CreateGroupDialog({ offerings, teachers, onCreated }: { offerings: CourseOffering[]; teachers: User[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ offeringId: '', code: '', name: '', capacity: '24', periods: '4', teacherId: '' });
  const selectedOffering = offerings.find((item) => item.id === form.offeringId);
  const submit = async () => {
    setSaving(true); setError('');
    try {
      await academicApi.createGroup({ offering_id: form.offeringId, code: form.code, name: form.name || form.code, capacity: Number(form.capacity), weekly_periods: Number(form.periods), consecutive_periods: 1, teacher_user_ids: [form.teacherId] });
      setOpen(false); setForm({ offeringId: '', code: '', name: '', capacity: '24', periods: '4', teacherId: '' }); onCreated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus data-icon="inline-start" />新增教学班</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>组建教学班</DialogTitle><DialogDescription>教学班绑定一门学校开课和至少一名教师，是学生分班与排课的共同单位。</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel>学校开课</FieldLabel><Select value={form.offeringId} onValueChange={(value) => { const offering = offerings.find((item) => item.id === value); setForm({ ...form, offeringId: value, periods: String(offering?.weekly_periods || 4), capacity: String(offering?.max_students || 24) }); }}><SelectTrigger><SelectValue placeholder="选择开课" /></SelectTrigger><SelectContent><SelectGroup>{offerings.filter((item) => item.status !== 'archived').map((offering) => <SelectItem key={offering.id} value={offering.id}>{offering.school_grade}年级 · {offering.name}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="group-code">教学班代码</FieldLabel><Input id="group-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="例如 G9-MATH-1" /></Field><Field><FieldLabel htmlFor="group-name">显示名称</FieldLabel><Input id="group-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={selectedOffering?.name || '教学班名称'} /></Field><Field><FieldLabel htmlFor="group-periods">每周课时</FieldLabel><Input id="group-periods" type="number" min={1} max={20} value={form.periods} onChange={(event) => setForm({ ...form, periods: event.target.value })} /></Field><Field><FieldLabel htmlFor="group-capacity">班额</FieldLabel><Input id="group-capacity" type="number" min={1} max={500} value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></Field></div><Field><FieldLabel>主讲教师</FieldLabel><Select value={form.teacherId} onValueChange={(value) => setForm({ ...form, teacherId: value })}><SelectTrigger><SelectValue placeholder="选择教师" /></SelectTrigger><SelectContent><SelectGroup>{teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.name} · {teacher.role === 'teacher' ? '任课教师' : teacher.role}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>{error && <Alert variant="destructive"><AlertTriangle /><AlertDescription>{error}</AlertDescription></Alert>}</FieldGroup><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={saving || !form.offeringId || !form.code.trim() || !form.teacherId} onClick={submit}>{saving ? '保存中…' : '创建教学班'}</Button></DialogFooter></DialogContent></Dialog>;
}
