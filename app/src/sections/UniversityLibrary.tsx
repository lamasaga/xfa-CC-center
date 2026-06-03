import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { universityApi, type University, type UniversityProgram } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { School, Plus, Search, Edit2, Trash2, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

const COUNTRIES = ['英国', '美国', '加拿大', '澳大利亚', '中国香港', '新加坡', '其他'];
const DEGREE_LEVELS = [
  { value: 'undergrad', label: '本科' },
  { value: 'postgrad', label: '研究生' },
] as const;

function inferEduSystem(country: string) {
  if (country === '美国') return 'us';
  if (['英国', '加拿大', '澳大利亚', '中国香港', '新加坡'].includes(country)) return 'commonwealth';
  return 'other';
}

function toggleInList<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function UniversityLibrary() {
  const { canEditUniversityCatalog: canEdit } = useAuth();
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountry, setFilterCountry] = useState('');

  // 展开的院校（查看专业）
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<UniversityProgram[]>([]);

  // 添加/编辑院校
  const [showUniDialog, setShowUniDialog] = useState(false);
  const [editingUniId, setEditingUniId] = useState<string | null>(null);
  const [uniForm, setUniForm] = useState({
    name: '', country: '英国', ranking: 0, course_name: '',
    a_level_requirement: '', language_requirement: '',
    application_deadline: '', notes: '',
    degree_level: 'undergrad' as 'undergrad' | 'postgrad',
    edu_system: 'commonwealth' as 'commonwealth' | 'us' | 'other',
    // US lite / school-level
    school_type: '' as string,
    admit_rate: '' as unknown as string,
    application_systems: [] as string[],
    rounds_supported: [] as string[],
    application_fee: '' as unknown as string,
    tuition_range: '' as string,
    location_text: '' as string,
    campus_size_text: '' as string,
    // requirements_struct (US lite)
    us_gpa_range: '' as string,
    us_sat_range: '' as string,
    us_act_range: '' as string,
    us_test_policy: 'Test-Optional' as 'Test-Optional' | 'Required' | 'Blind',
    us_toefl_min: '' as unknown as string,
    us_rec_letters_count: '' as unknown as string,
    us_interview_policy: '可选' as string,
    us_essay_count: '' as unknown as string,
  });

  // 添加/编辑专业
  const [showProgramDialog, setShowProgramDialog] = useState(false);
  const [editingProgId, setEditingProgId] = useState<string | null>(null);
  const [progForm, setProgForm] = useState({
    program_name: '', department: '', a_level_requirement: '',
    language_requirement: '', subject_requirements: '',
    application_deadline: '', tuition_fee: '', duration: '', notes: '',
    // us lite (program-level)
    us_major_selectivity: '' as string,
    us_prerequisites_text: '' as string,
    portfolio_required: false as boolean,
    portfolio_notes: '' as string,
    // structured (optional)
    alevel_required_grades: [] as string[],
    subject_requirements_struct: { include: [] as string[], minGrades: {} as Record<string, string> },
    extra_exams: [] as string[],
    language_type: 'IELTS' as 'IELTS' | 'TOEFL' | 'PTE' | 'Duolingo',
    language_overall_min: '' as unknown as string,
    language_component_mins: { listening: '', reading: '', writing: '', speaking: '' } as any,
  });

  const fetchUniversities = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string | undefined> = {};
      if (filterCountry) params.country = filterCountry;
      if (searchTerm) params.search = searchTerm;
      setUniversities(await universityApi.getAll(params));
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchUniversities(); }, [filterCountry]);

  const handleSearch = () => fetchUniversities();

  // === 院校 CRUD ===
  const handleOpenAddUni = () => {
    setEditingUniId(null);
    setUniForm({
      name: '',
      country: '英国',
      ranking: 0,
      course_name: '',
      a_level_requirement: '',
      language_requirement: '',
      application_deadline: '',
      notes: '',
      degree_level: 'undergrad',
      edu_system: 'commonwealth',
      school_type: '',
      admit_rate: '' as any,
      application_systems: [],
      rounds_supported: [],
      application_fee: '' as any,
      tuition_range: '',
      location_text: '',
      campus_size_text: '',
      us_gpa_range: '',
      us_sat_range: '',
      us_act_range: '',
      us_test_policy: 'Test-Optional',
      us_toefl_min: '' as any,
      us_rec_letters_count: '' as any,
      us_interview_policy: '可选',
      us_essay_count: '' as any,
    });
    setShowUniDialog(true);
  };

  const handleOpenEditUni = (uni: University) => {
    setEditingUniId(uni.id);
    const edu = (uni.edu_system as any) || inferEduSystem(uni.country);
    const degree = (uni.degree_level as any) || 'undergrad';
    const usReq = (edu === 'us' && uni.requirements_struct && (uni.requirements_struct as any).us) ? (uni.requirements_struct as any).us : {};
    const costs = uni.costs || {};
    setUniForm({
      name: uni.name, country: uni.country, ranking: uni.ranking || 0,
      course_name: uni.course_name || '', a_level_requirement: uni.a_level_requirement || '',
      language_requirement: uni.language_requirement || '', application_deadline: uni.application_deadline || '',
      notes: uni.notes || '',
      degree_level: degree,
      edu_system: edu,
      school_type: (uni.school_type as any) || '',
      admit_rate: (uni.admit_rate ?? '') as any,
      application_systems: Array.isArray(uni.application_systems) ? uni.application_systems : [],
      rounds_supported: Array.isArray(uni.rounds_supported) ? uni.rounds_supported : [],
      application_fee: ((costs as any).application_fee ?? '') as any,
      tuition_range: String((costs as any).tuition_range ?? ''),
      location_text: (uni.location_text as any) || '',
      campus_size_text: (uni.campus_size_text as any) || '',
      us_gpa_range: String((usReq as any).gpa_range ?? ''),
      us_sat_range: String((usReq as any).sat_range ?? ''),
      us_act_range: String((usReq as any).act_range ?? ''),
      us_test_policy: ((usReq as any).test_policy || 'Test-Optional') as any,
      us_toefl_min: ((usReq as any).toefl_min ?? '') as any,
      us_rec_letters_count: ((usReq as any).rec_letters_count ?? '') as any,
      us_interview_policy: String((usReq as any).interview_policy ?? '可选'),
      us_essay_count: ((usReq as any).essay_count ?? '') as any,
    });
    setShowUniDialog(true);
  };

  const handleSaveUni = async () => {
    if (!uniForm.name.trim() || !uniForm.country) { alert('请填写院校名称和国家'); return; }
    try {
      const edu_system = uniForm.edu_system || inferEduSystem(uniForm.country);
      const admit_rate = uniForm.admit_rate ? parseFloat(String(uniForm.admit_rate)) : null;
      const costs =
        uniForm.application_fee || uniForm.tuition_range
          ? {
              application_fee: uniForm.application_fee ? parseFloat(String(uniForm.application_fee)) : null,
              tuition_range: uniForm.tuition_range || null,
            }
          : null;
      const requirements_struct =
        edu_system === 'us'
          ? {
              us: {
                gpa_range: uniForm.us_gpa_range || null,
                sat_range: uniForm.us_sat_range || null,
                act_range: uniForm.us_act_range || null,
                test_policy: uniForm.us_test_policy || null,
                toefl_min: uniForm.us_toefl_min ? parseFloat(String(uniForm.us_toefl_min)) : null,
                rec_letters_count: uniForm.us_rec_letters_count ? parseInt(String(uniForm.us_rec_letters_count), 10) : null,
                interview_policy: uniForm.us_interview_policy || null,
                essay_count: uniForm.us_essay_count ? parseInt(String(uniForm.us_essay_count), 10) : null,
              },
            }
          : null;
      const payload: any = {
        name: uniForm.name,
        country: uniForm.country,
        ranking: uniForm.ranking || 0,
        course_name: uniForm.course_name || '',
        a_level_requirement: uniForm.a_level_requirement || '',
        language_requirement: uniForm.language_requirement || '',
        application_deadline: uniForm.application_deadline || '',
        notes: uniForm.notes || '',
        degree_level: uniForm.degree_level,
        edu_system,
        school_type: uniForm.school_type || null,
        admit_rate,
        application_systems: uniForm.application_systems,
        rounds_supported: uniForm.rounds_supported,
        costs,
        location_text: uniForm.location_text || null,
        campus_size_text: uniForm.campus_size_text || null,
        requirements_struct,
      };
      if (editingUniId) {
        await universityApi.update(editingUniId, payload);
      } else {
        await universityApi.create(payload);
      }
      setShowUniDialog(false);
      fetchUniversities();
    } catch (err) { alert(err instanceof Error ? err.message : '操作失败'); }
  };

  const handleDeleteUni = async (id: string, name: string) => {
    if (!confirm(`确定删除院校 "${name}"？其下所有专业和学生申请关联都将被删除。`)) return;
    try { await universityApi.delete(id); fetchUniversities(); }
    catch (err) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  // === 展开院校查看专业 ===
  const handleToggleExpand = async (uniId: string) => {
    if (expandedId === uniId) { setExpandedId(null); return; }
    try {
      setPrograms(await universityApi.getPrograms(uniId));
      setExpandedId(uniId);
    } catch { setPrograms([]); setExpandedId(uniId); }
  };

  // === 专业 CRUD ===
  const handleOpenAddProg = () => {
    setEditingProgId(null);
    setProgForm({
      program_name: '', department: '',
      a_level_requirement: '', language_requirement: '', subject_requirements: '',
      application_deadline: '', tuition_fee: '', duration: '', notes: '',
      us_major_selectivity: '',
      us_prerequisites_text: '',
      portfolio_required: false,
      portfolio_notes: '',
      alevel_required_grades: [],
      subject_requirements_struct: { include: [], minGrades: {} },
      extra_exams: [],
      language_type: 'IELTS',
      language_overall_min: '' as any,
      language_component_mins: { listening: '', reading: '', writing: '', speaking: '' } as any,
    });
    setShowProgramDialog(true);
  };

  const handleOpenEditProg = (p: UniversityProgram) => {
    setEditingProgId(p.id);
    setProgForm({
      program_name: p.program_name, department: p.department || '',
      a_level_requirement: p.a_level_requirement || '', language_requirement: p.language_requirement || '',
      subject_requirements: p.subject_requirements || '', application_deadline: p.application_deadline || '',
      tuition_fee: p.tuition_fee || '', duration: p.duration || '', notes: p.notes || '',
      us_major_selectivity: (p.us_major_selectivity as any) || '',
      us_prerequisites_text: (p.us_prerequisites_text as any) || '',
      portfolio_required: !!(p.portfolio_required as any),
      portfolio_notes: (p.portfolio_notes as any) || '',
      alevel_required_grades: Array.isArray(p.alevel_required_grades) ? p.alevel_required_grades : [],
      subject_requirements_struct: {
        include: p.subject_requirements_struct?.include ?? [],
        minGrades: p.subject_requirements_struct?.minGrades ?? {},
      },
      extra_exams: Array.isArray(p.extra_exams) ? p.extra_exams : [],
      language_type: (p.language_type as any) || 'IELTS',
      language_overall_min: (p.language_overall_min ?? '') as any,
      language_component_mins: (p.language_component_mins as any) || { listening: '', reading: '', writing: '', speaking: '' },
    });
    setShowProgramDialog(true);
  };

  const handleSaveProg = async () => {
    if (!progForm.program_name.trim() || !expandedId) { alert('请填写专业名称'); return; }
    try {
      const structured = {
        alevel_required_grades: progForm.alevel_required_grades.length > 0 ? progForm.alevel_required_grades : null,
        subject_requirements_struct:
          (progForm.subject_requirements_struct?.include?.length || 0) > 0 ||
          (progForm.subject_requirements_struct && Object.keys(progForm.subject_requirements_struct.minGrades || {}).length > 0)
            ? progForm.subject_requirements_struct
            : null,
        extra_exams: progForm.extra_exams.length > 0 ? progForm.extra_exams : null,
        language_type: progForm.language_overall_min ? progForm.language_type : null,
        language_overall_min: progForm.language_overall_min ? parseFloat(String(progForm.language_overall_min)) : null,
        language_component_mins: (() => {
          const c = progForm.language_component_mins || {};
          const obj: any = {};
          const keys = ['listening', 'reading', 'writing', 'speaking'] as const;
          for (const k of keys) {
            const v = parseFloat(String((c as any)[k]));
            if (Number.isFinite(v) && v > 0) obj[k] = v;
          }
          return Object.keys(obj).length > 0 ? obj : null;
        })(),
      };

      if (editingProgId) {
        await universityApi.updateProgram(expandedId, editingProgId, { ...progForm, ...structured } as any);
      } else {
        await universityApi.addProgram(expandedId, { ...progForm, ...structured } as any);
      }
      setShowProgramDialog(false);
      setPrograms(await universityApi.getPrograms(expandedId));
    } catch (err) { alert(err instanceof Error ? err.message : '操作失败'); }
  };

  const handleDeleteProg = async (programId: string) => {
    if (!expandedId || !confirm('确定删除该专业？')) return;
    try {
      await universityApi.deleteProgram(expandedId, programId);
      setPrograms(await universityApi.getPrograms(expandedId));
    } catch (err) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><School className="h-6 w-6" />院校库管理</h1>
        {canEdit && <Button onClick={handleOpenAddUni}><Plus className="h-4 w-4 mr-2" />添加院校</Button>}
      </div>

      {/* 搜索筛选 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input className="pl-10" placeholder="搜索院校名称..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} />
            </div>
            <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="国家/地区" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部国家</SelectItem>
                {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSearch}>搜索</Button>
          </div>
        </CardContent>
      </Card>

      {/* 院校列表 */}
      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : universities.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-slate-400">
          <p className="mb-4">暂无院校数据</p>
          {canEdit && <Button variant="outline" onClick={handleOpenAddUni}><Plus className="h-4 w-4 mr-2" />添加第一所院校</Button>}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {universities.map(uni => (
            <Card key={uni.id} className="border border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => handleToggleExpand(uni.id)}>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{uni.name}</h3>
                      {uni.ranking > 0 && <Badge variant="secondary">#{uni.ranking}</Badge>}
                      <Badge>{uni.country}</Badge>
                      {expandedId === uni.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                      <p><span className="text-slate-500">A-Level要求:</span> {uni.a_level_requirement || '--'}</p>
                      <p><span className="text-slate-500">语言要求:</span> {uni.language_requirement || '--'}</p>
                      <p><span className="text-slate-500">申请截止:</span> {uni.application_deadline || '--'}</p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 ml-4" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEditUni(uni)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteUni(uni.id, uni.name)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>

                {/* 展开的专业列表 */}
                {expandedId === uni.id && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2"><BookOpen className="h-4 w-4" />专业列表 ({programs.length})</h4>
                      {canEdit && <Button size="sm" variant="outline" onClick={handleOpenAddProg}><Plus className="h-3.5 w-3.5 mr-1" />添加专业</Button>}
                    </div>
                    {programs.length > 0 ? (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>专业名称</TableHead><TableHead>院系</TableHead>
                          <TableHead>A-Level要求</TableHead><TableHead>语言要求</TableHead>
                          <TableHead>学费</TableHead><TableHead>学制</TableHead>
                          {canEdit && <TableHead>操作</TableHead>}
                        </TableRow></TableHeader>
                        <TableBody>
                          {programs.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <span>{p.program_name}</span>
                                  {(Array.isArray(p.alevel_required_grades) && p.alevel_required_grades.length > 0) ||
                                   (p.language_overall_min != null && p.language_overall_min > 0) ||
                                   (Array.isArray(p.extra_exams) && p.extra_exams.length > 0) ||
                                   (p.subject_requirements_struct && ((p.subject_requirements_struct.include?.length || 0) > 0 || Object.keys(p.subject_requirements_struct.minGrades || {}).length > 0))
                                    ? <Badge variant="secondary" className="text-[10px]">结构化</Badge>
                                    : <Badge variant="outline" className="text-[10px] text-slate-500">文本</Badge>}
                                </div>
                              </TableCell>
                              <TableCell>{p.department || '--'}</TableCell>
                              <TableCell>
                                {Array.isArray(p.alevel_required_grades) && p.alevel_required_grades.length > 0
                                  ? p.alevel_required_grades.join('')
                                  : (p.a_level_requirement || '--')}
                              </TableCell>
                              <TableCell>
                                {p.language_overall_min != null && p.language_overall_min > 0
                                  ? `${p.language_type || 'IELTS'} ${p.language_overall_min}${p.language_component_mins ? `（分项）` : ''}`
                                  : (p.language_requirement || '--')}
                              </TableCell>
                              <TableCell>{p.tuition_fee || '--'}</TableCell>
                              <TableCell>{p.duration || '--'}</TableCell>
                              {canEdit && (
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => handleOpenEditProg(p)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteProg(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-center text-slate-400 py-4">暂无专业信息，点击"添加专业"开始配置</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 院校弹窗 */}
      <Dialog open={showUniDialog} onOpenChange={setShowUniDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingUniId ? '编辑院校' : '添加院校'}</DialogTitle>
            <DialogDescription>按体系分层配置，减少表单冗长</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="pt-2">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="basic">基础信息</TabsTrigger>
              <TabsTrigger value="requirements">申请与要求</TabsTrigger>
              <TabsTrigger value="costs">概览数据</TabsTrigger>
              <TabsTrigger value="notes">备注</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>院校名称 *</Label>
                  <Input value={uniForm.name} onChange={(e) => setUniForm({ ...uniForm, name: e.target.value })} placeholder="如 MIT / University of Cambridge" />
                </div>
                <div className="space-y-2">
                  <Label>国家/地区 *</Label>
                  <Select
                    value={uniForm.country}
                    onValueChange={(v) => {
                      const nextEdu = inferEduSystem(v);
                      setUniForm({ ...uniForm, country: v, edu_system: nextEdu as any });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>项目层级</Label>
                  <Select value={uniForm.degree_level} onValueChange={(v) => setUniForm({ ...uniForm, degree_level: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEGREE_LEVELS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>体系</Label>
                  <Select value={uniForm.edu_system} onValueChange={(v) => setUniForm({ ...uniForm, edu_system: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commonwealth">英联邦</SelectItem>
                      <SelectItem value="us">美国</SelectItem>
                      <SelectItem value="other">其他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>世界排名</Label>
                  <Input type="number" value={uniForm.ranking || ''} onChange={(e) => setUniForm({ ...uniForm, ranking: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>申请截止日期</Label>
                  <Input type="date" value={uniForm.application_deadline} onChange={(e) => setUniForm({ ...uniForm, application_deadline: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>地理位置</Label>
                  <Input value={uniForm.location_text} onChange={(e) => setUniForm({ ...uniForm, location_text: e.target.value })} placeholder="如 Massachusetts, Cambridge" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="requirements" className="space-y-4 pt-4">
              {uniForm.edu_system === 'us' ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>GPA 范围</Label>
                      <Input value={uniForm.us_gpa_range} onChange={(e) => setUniForm({ ...uniForm, us_gpa_range: e.target.value })} placeholder="如 3.9+ (unweighted)" />
                    </div>
                    <div className="space-y-2">
                      <Label>Test Policy</Label>
                      <Select value={uniForm.us_test_policy} onValueChange={(v) => setUniForm({ ...uniForm, us_test_policy: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Test-Optional">Test-Optional</SelectItem>
                          <SelectItem value="Required">Required</SelectItem>
                          <SelectItem value="Blind">Blind</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SAT 分数段</Label>
                      <Input value={uniForm.us_sat_range} onChange={(e) => setUniForm({ ...uniForm, us_sat_range: e.target.value })} placeholder="如 1520-1570" />
                    </div>
                    <div className="space-y-2">
                      <Label>ACT 分数段</Label>
                      <Input value={uniForm.us_act_range} onChange={(e) => setUniForm({ ...uniForm, us_act_range: e.target.value })} placeholder="如 34-36" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>TOEFL 最低</Label>
                      <Input value={uniForm.us_toefl_min as any} onChange={(e) => setUniForm({ ...uniForm, us_toefl_min: e.target.value as any })} placeholder="如 100" />
                    </div>
                    <div className="space-y-2">
                      <Label>推荐信数量</Label>
                      <Input value={uniForm.us_rec_letters_count as any} onChange={(e) => setUniForm({ ...uniForm, us_rec_letters_count: e.target.value as any })} placeholder="如 2" />
                    </div>
                    <div className="space-y-2">
                      <Label>补充文书数量</Label>
                      <Input value={uniForm.us_essay_count as any} onChange={(e) => setUniForm({ ...uniForm, us_essay_count: e.target.value as any })} placeholder="如 3" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>面试</Label>
                    <Input value={uniForm.us_interview_policy} onChange={(e) => setUniForm({ ...uniForm, us_interview_policy: e.target.value })} placeholder="如 校友面试/可选/无" />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>A-Level 总体要求</Label>
                      <Input value={uniForm.a_level_requirement} onChange={(e) => setUniForm({ ...uniForm, a_level_requirement: e.target.value })} placeholder="如 A*A*A" />
                    </div>
                    <div className="space-y-2">
                      <Label>语言总体要求</Label>
                      <Input value={uniForm.language_requirement} onChange={(e) => setUniForm({ ...uniForm, language_requirement: e.target.value })} placeholder="如 IELTS 7.0(6.5)" />
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="costs" className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>录取率(%)</Label>
                  <Input value={uniForm.admit_rate as any} onChange={(e) => setUniForm({ ...uniForm, admit_rate: e.target.value as any })} placeholder="如 4.1" />
                </div>
                <div className="space-y-2">
                  <Label>学校类型</Label>
                  <Input value={uniForm.school_type} onChange={(e) => setUniForm({ ...uniForm, school_type: e.target.value })} placeholder="如 综合大学/文理学院" />
                </div>
                <div className="space-y-2">
                  <Label>校园规模</Label>
                  <Input value={uniForm.campus_size_text} onChange={(e) => setUniForm({ ...uniForm, campus_size_text: e.target.value })} placeholder="如 本科 4500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>申请费($)</Label>
                  <Input value={uniForm.application_fee as any} onChange={(e) => setUniForm({ ...uniForm, application_fee: e.target.value as any })} placeholder="如 75" />
                </div>
                <div className="space-y-2">
                  <Label>学费区间</Label>
                  <Input value={uniForm.tuition_range} onChange={(e) => setUniForm({ ...uniForm, tuition_range: e.target.value })} placeholder="如 60000-65000/年" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>申请系统（多选）</Label>
                <div className="flex flex-wrap gap-2">
                  {['Common App', 'Coalition', 'UC系统', '独立系统'].map((x) => {
                    const active = uniForm.application_systems.includes(x);
                    return (
                      <Button
                        key={x}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => setUniForm((p) => ({ ...p, application_systems: toggleInList(p.application_systems, x) }))}
                      >
                        {x}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>申请轮次（多选）</Label>
                <div className="flex flex-wrap gap-2">
                  {['ED', 'EA', 'RD', 'RA'].map((x) => {
                    const active = uniForm.rounds_supported.includes(x);
                    return (
                      <Button
                        key={x}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => setUniForm((p) => ({ ...p, rounds_supported: toggleInList(p.rounds_supported, x) }))}
                      >
                        {x}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>备注</Label>
                <Input value={uniForm.notes} onChange={(e) => setUniForm({ ...uniForm, notes: e.target.value })} placeholder="其他备注信息" />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUniDialog(false)}>取消</Button>
            <Button onClick={handleSaveUni}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 专业弹窗 */}
      <Dialog open={showProgramDialog} onOpenChange={setShowProgramDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingProgId ? '编辑专业' : '添加专业'}</DialogTitle>
            <DialogDescription>按体系分层，避免专业字段过长</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="pt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="basic">基础信息</TabsTrigger>
              <TabsTrigger value="commonwealth">英联邦要求</TabsTrigger>
              <TabsTrigger value="us">美本要点</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>专业名称 *</Label>
                  <Input value={progForm.program_name} onChange={(e) => setProgForm({ ...progForm, program_name: e.target.value })} placeholder="如 Computer Science" />
                </div>
                <div className="space-y-2">
                  <Label>院系</Label>
                  <Input value={progForm.department} onChange={(e) => setProgForm({ ...progForm, department: e.target.value })} placeholder="如 Engineering" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>学费</Label>
                  <Input value={progForm.tuition_fee} onChange={(e) => setProgForm({ ...progForm, tuition_fee: e.target.value })} placeholder="如 £39,162/年" />
                </div>
                <div className="space-y-2">
                  <Label>学制</Label>
                  <Input value={progForm.duration} onChange={(e) => setProgForm({ ...progForm, duration: e.target.value })} placeholder="如 3年" />
                </div>
                <div className="space-y-2">
                  <Label>申请截止</Label>
                  <Input type="date" value={progForm.application_deadline} onChange={(e) => setProgForm({ ...progForm, application_deadline: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>备注</Label>
                <Input value={progForm.notes} onChange={(e) => setProgForm({ ...progForm, notes: e.target.value })} />
              </div>
            </TabsContent>

            <TabsContent value="commonwealth" className="space-y-4 pt-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">结构化要求（推荐）</p>
                  <Badge variant="secondary" className="text-[10px]">用于更准确匹配</Badge>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">A‑Level 等级组合</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['A*', 'A', 'B', 'C', 'D'].map((g) => (
                      <Button
                        key={g}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setProgForm((prev) => ({
                            ...prev,
                            alevel_required_grades: [...prev.alevel_required_grades, g],
                          }));
                        }}
                      >
                        + {g}
                      </Button>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setProgForm((p) => ({ ...p, alevel_required_grades: [] }))}>
                      清空
                    </Button>
                  </div>
                  <p className="text-xs text-slate-600">
                    当前组合：{progForm.alevel_required_grades.length > 0 ? progForm.alevel_required_grades.join(' · ') : '未设置'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">语言类型</Label>
                    <Select value={progForm.language_type} onValueChange={(v) => setProgForm({ ...progForm, language_type: v as any })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IELTS">IELTS</SelectItem>
                        <SelectItem value="TOEFL">TOEFL</SelectItem>
                        <SelectItem value="PTE">PTE</SelectItem>
                        <SelectItem value="Duolingo">Duolingo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-slate-600">总分最低</Label>
                    <Input
                      className="h-8"
                      value={(progForm.language_overall_min as any) ?? ''}
                      onChange={(e) => setProgForm({ ...progForm, language_overall_min: e.target.value as any })}
                      placeholder="如 7.0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">附加考试（多选）</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {['STEP', 'MAT', 'TMUA', 'PAT', 'TSA', 'LNAT', 'UCAT', 'HAT'].map(exam => {
                      const active = progForm.extra_exams.includes(exam);
                      return (
                        <Button
                          key={exam}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setProgForm((prev) => {
                            const next = prev.extra_exams.includes(exam)
                              ? prev.extra_exams.filter(x => x !== exam)
                              : [...prev.extra_exams, exam];
                            return { ...prev, extra_exams: next };
                          })}
                        >
                          {exam}
                        </Button>
                      );
                    })}
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setProgForm((p) => ({ ...p, extra_exams: [] }))}>
                      清空
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <p className="text-sm font-semibold text-slate-800">自然语言注释（展示/兜底）</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>A‑Level要求（文本）</Label><Input value={progForm.a_level_requirement} onChange={(e) => setProgForm({ ...progForm, a_level_requirement: e.target.value })} placeholder="如 A*A*A (含数学A*)" /></div>
                  <div className="space-y-2"><Label>语言要求（文本）</Label><Input value={progForm.language_requirement} onChange={(e) => setProgForm({ ...progForm, language_requirement: e.target.value })} placeholder="如 IELTS 7.5(7.0)" /></div>
                </div>
                <div className="space-y-2"><Label>必修科目要求（文本）</Label><Input value={progForm.subject_requirements} onChange={(e) => setProgForm({ ...progForm, subject_requirements: e.target.value })} placeholder="如 Mathematics, Further Mathematics" /></div>
              </div>
            </TabsContent>

            <TabsContent value="us" className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>申请难度</Label>
                  <Select value={progForm.us_major_selectivity || '中'} onValueChange={(v) => setProgForm({ ...progForm, us_major_selectivity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="低">低</SelectItem>
                      <SelectItem value="中">中</SelectItem>
                      <SelectItem value="高">高</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>作品集</Label>
                  <Select
                    value={progForm.portfolio_required ? 'yes' : 'no'}
                    onValueChange={(v) => setProgForm({ ...progForm, portfolio_required: v === 'yes' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">不需要</SelectItem>
                      <SelectItem value="yes">需要</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>作品集说明</Label>
                  <Input value={progForm.portfolio_notes} onChange={(e) => setProgForm({ ...progForm, portfolio_notes: e.target.value })} placeholder="可选" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>先修课建议</Label>
                <Input value={progForm.us_prerequisites_text} onChange={(e) => setProgForm({ ...progForm, us_prerequisites_text: e.target.value })} placeholder="如 建议修过 AP Calculus BC" />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProgramDialog(false)}>取消</Button>
            <Button onClick={handleSaveProg}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
