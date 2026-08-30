import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { academicApi, type CurriculumSpec, type OfficialSource } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, ExternalLink, FileCheck2, Library, Plus, Search } from 'lucide-react';

const qualificationLabels: Record<string, string> = {
  IG: 'IG', INTERNATIONAL_GCSE: 'International GCSE', IAS: 'IAS', AS: 'AS', IAL: 'IAL', A_LEVEL: 'A Level',
};

export default function CurriculumLibraryPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sources, setSources] = useState<OfficialSource[]>([]);
  const [specs, setSpecs] = useState<CurriculumSpec[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const tab = searchParams.get('tab') === 'sources' ? 'sources' : 'specs';

  useEffect(() => {
    let cancelled = false;
    Promise.all([academicApi.getSources(), academicApi.getSpecs()])
      .then(([sourceRows, specRows]) => { if (!cancelled) { setSources(sourceRows); setSpecs(specRows); } })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : '加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);
  const canManage = user?.role === 'admin' || user?.role === 'staff';

  const filteredSources = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return sources;
    return sources.filter((item) => `${item.publisher} ${item.title} ${item.source_type}`.toLowerCase().includes(keyword));
  }, [query, sources]);
  const filteredSpecs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return specs;
    return specs.filter((item) => `${item.board} ${item.subject_code} ${item.subject_name} ${item.version_label}`.toLowerCase().includes(keyword));
  }, [query, specs]);

  if (error) return <Alert variant="destructive"><AlertTriangle /><AlertTitle>课程资讯库加载失败</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-col gap-1"><p className="text-sm font-medium text-primary">课程与制度依据</p><h1 className="text-2xl font-semibold tracking-tight">课程与官方资讯库</h1><p className="text-sm text-muted-foreground">课程规范、评分制和考试规则都保留来源与版本；未知信息保持为空，不作推测。</p></div>{canManage && <div className="flex gap-2"><CreateSourceDialog onCreated={() => setRefresh((value) => value + 1)} /><CreateSpecDialog sources={sources} onCreated={() => setRefresh((value) => value + 1)} /></div>}</div>
      <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索考试局、课程代码、规范版本或来源" className="pl-9" /></div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileCheck2 className="size-4" /><span>{sources.filter((item) => item.status === 'verified').length} 条已核验来源</span></div>
      </div>
      {loading ? <Skeleton className="h-96 w-full" /> : (
        <Tabs value={tab} onValueChange={(value) => setSearchParams(value === 'sources' ? { tab: 'sources' } : {})}>
          <TabsList><TabsTrigger value="specs">课程规范（{filteredSpecs.length}）</TabsTrigger><TabsTrigger value="sources">官方来源（{filteredSources.length}）</TabsTrigger></TabsList>
          <TabsContent value="specs" className="overflow-hidden rounded-lg border bg-card">
            <Table><TableHeader><TableRow><TableHead>资格阶段</TableHead><TableHead>考试局 / 代码</TableHead><TableHead>课程</TableHead><TableHead>规范版本</TableHead><TableHead>评估与评分</TableHead><TableHead>来源状态</TableHead></TableRow></TableHeader>
              <TableBody>{filteredSpecs.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center text-muted-foreground">尚未录入具体课程规范。请先按学校实际开课清单录入，不批量生成假数据。</TableCell></TableRow> : filteredSpecs.map((spec) => <TableRow key={spec.id}><TableCell><Badge variant="outline">{qualificationLabels[spec.qualification_level] || spec.qualification_level}</Badge></TableCell><TableCell><div className="flex flex-col gap-0.5"><span className="font-medium">{spec.board}</span><span className="font-mono text-xs text-muted-foreground">{spec.subject_code}</span></div></TableCell><TableCell>{spec.school_display_name || spec.subject_name}</TableCell><TableCell>{spec.version_label}</TableCell><TableCell><div className="flex flex-col gap-0.5"><span>{spec.assessment_model}</span><span className="text-xs text-muted-foreground">{spec.grading_scale || '待核对评分制'}</span></div></TableCell><TableCell><Badge variant={spec.source_status === 'verified' ? 'secondary' : 'outline'}>{spec.source_status === 'verified' ? '来源已核验' : '待核验'}</Badge></TableCell></TableRow>)}</TableBody>
            </Table>
          </TabsContent>
          <TabsContent value="sources" className="overflow-hidden rounded-lg border bg-card">
            <Table><TableHeader><TableRow><TableHead>发布者</TableHead><TableHead>官方资料</TableHead><TableHead>类型</TableHead><TableHead>核对时间</TableHead><TableHead>状态</TableHead><TableHead className="text-right">链接</TableHead></TableRow></TableHeader>
              <TableBody>{filteredSources.map((source) => <TableRow key={source.id}><TableCell className="font-medium">{source.publisher}</TableCell><TableCell className="max-w-lg"><div className="flex flex-col gap-0.5"><span>{source.title}</span>{source.notes && <span className="truncate text-xs text-muted-foreground">{source.notes}</span>}</div></TableCell><TableCell>{source.source_type}</TableCell><TableCell>{new Date(source.checked_at).toLocaleDateString('zh-CN')}</TableCell><TableCell><Badge variant={source.status === 'verified' ? 'secondary' : 'outline'}>{source.status === 'verified' ? '已核验' : source.status}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" asChild><a href={source.url} target="_blank" rel="noreferrer">打开<ExternalLink data-icon="inline-end" /></a></Button></TableCell></TableRow>)}</TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      )}
      <Alert><Library /><AlertTitle>使用边界</AlertTitle><AlertDescription>本库提供真实来源与版本追踪，但不代替考试局当年 syllabus、Information Manual、报名系统或学校考试官的最终确认。</AlertDescription></Alert>
    </div>
  );
}

function CreateSourceDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [form, setForm] = useState({ publisher: 'Cambridge International', sourceType: 'syllabus', title: '', url: '', status: 'draft' as 'draft' | 'verified' });
  const submit = async () => { setSaving(true); setError(''); try { await academicApi.createSource({ publisher: form.publisher, source_type: form.sourceType, title: form.title, url: form.url, checked_at: new Date().toISOString(), access_level: 'public', status: form.status }); setOpen(false); setForm({ publisher: 'Cambridge International', sourceType: 'syllabus', title: '', url: '', status: 'draft' }); onCreated(); } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline"><Plus data-icon="inline-start" />官方来源</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>录入官方来源</DialogTitle><DialogDescription>只接受已配置白名单中的官方 HTTPS 域名；核验状态表示已完成业务复核。</DialogDescription></DialogHeader><FieldGroup><Field><FieldLabel>发布者</FieldLabel><Select value={form.publisher} onValueChange={(value) => setForm({ ...form, publisher: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="Cambridge International">Cambridge International</SelectItem><SelectItem value="Pearson Edexcel">Pearson Edexcel</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="source-title">官方标题</FieldLabel><Input id="source-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field><FieldLabel htmlFor="source-url">官方链接</FieldLabel><Input id="source-url" type="url" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} placeholder="https://..." /></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>资料类型</FieldLabel><Select value={form.sourceType} onValueChange={(value) => setForm({ ...form, sourceType: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="syllabus">syllabus</SelectItem><SelectItem value="qualification_page">qualification page</SelectItem><SelectItem value="handbook">handbook</SelectItem><SelectItem value="timetable">timetable</SelectItem><SelectItem value="policy">policy</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel>复核状态</FieldLabel><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as 'draft' | 'verified' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="draft">草稿</SelectItem><SelectItem value="verified">已核验</SelectItem></SelectGroup></SelectContent></Select></Field></div>{error && <Alert variant="destructive"><AlertTriangle /><AlertDescription>{error}</AlertDescription></Alert>}</FieldGroup><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={saving || !form.title.trim() || !form.url.trim()} onClick={submit}>{saving ? '保存中…' : '保存来源'}</Button></DialogFooter></DialogContent></Dialog>;
}

function CreateSpecDialog({ sources, onCreated }: { sources: OfficialSource[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [form, setForm] = useState({ board: 'Cambridge International', level: 'IG' as CurriculumSpec['qualification_level'], code: '', name: '', version: '', grading: '', model: 'subject_specific' as CurriculumSpec['assessment_model'], sourceId: 'none', status: 'draft' as CurriculumSpec['status'] });
  const submit = async () => { setSaving(true); setError(''); try { await academicApi.createSpec({ board: form.board, qualification_level: form.level, subject_code: form.code, subject_name: form.name, version_label: form.version, grading_scale: form.grading || null, assessment_model: form.model, source_id: form.sourceId === 'none' ? null : form.sourceId, status: form.status }); setOpen(false); setForm({ board: 'Cambridge International', level: 'IG', code: '', name: '', version: '', grading: '', model: 'subject_specific', sourceId: 'none', status: 'draft' }); onCreated(); } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus data-icon="inline-start" />课程规范</Button></DialogTrigger><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>录入课程规范版本</DialogTitle><DialogDescription>课程代码、版本和评分制必须来自所选官方来源；没有依据时保持草稿。</DialogDescription></DialogHeader><FieldGroup><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>考试局</FieldLabel><Select value={form.board} onValueChange={(value) => setForm({ ...form, board: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="Cambridge International">Cambridge International</SelectItem><SelectItem value="Pearson Edexcel">Pearson Edexcel</SelectItem></SelectGroup></SelectContent></Select></Field><Field><FieldLabel>资格阶段</FieldLabel><Select value={form.level} onValueChange={(value) => setForm({ ...form, level: value as CurriculumSpec['qualification_level'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup>{Object.entries(qualificationLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectGroup></SelectContent></Select></Field><Field><FieldLabel htmlFor="spec-code">课程代码</FieldLabel><Input id="spec-code" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></Field><Field><FieldLabel htmlFor="spec-name">官方课程名</FieldLabel><Input id="spec-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field><FieldLabel htmlFor="spec-version">规范版本</FieldLabel><Input id="spec-version" value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} placeholder="例如 2027–2029 syllabus" /></Field><Field><FieldLabel htmlFor="spec-grading">评分制</FieldLabel><Input id="spec-grading" value={form.grading} onChange={(event) => setForm({ ...form, grading: event.target.value })} placeholder="例如 A*–G" /></Field></div><Field><FieldLabel>官方来源</FieldLabel><Select value={form.sourceId} onValueChange={(value) => setForm({ ...form, sourceId: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="none">尚未关联</SelectItem>{sources.filter((source) => source.status === 'verified').map((source) => <SelectItem key={source.id} value={source.id}>{source.publisher} · {source.title}</SelectItem>)}</SelectGroup></SelectContent></Select></Field>{error && <Alert variant="destructive"><AlertTriangle /><AlertDescription>{error}</AlertDescription></Alert>}</FieldGroup><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button disabled={saving || !form.code.trim() || !form.name.trim() || !form.version.trim()} onClick={submit}>{saving ? '保存中…' : '保存规范'}</Button></DialogFooter></DialogContent></Dialog>;
}
