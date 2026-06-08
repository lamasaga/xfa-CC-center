import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { courseApi, type Course, type CourseUnit } from '@/services/api';
import {
  formatExamMonthLabel,
  normalizeAllowedMonthsForForm,
  STANDARD_EXAM_MONTHS,
  STANDARD_EXAM_MONTHS_LABEL,
} from '@/lib/examMonths';
import { useAuth } from '@/contexts/AuthContext';
import { useGrade } from '@/contexts/GradeContext';
import { CourseDetail } from '@/sections/CourseDetail';
import { Plus, ArrowLeft, Settings, Trash2, Edit2 } from 'lucide-react';

const BOARDS = ['Edexcel', 'CIE', 'AQA', 'OCR', 'WJEC', 'LRN', 'Internal'] as const;

const boardLabel = (b: string) => (b === 'Internal' ? '校内' : b);

export function CourseManagement() {
  const { courseId: courseIdParam } = useParams<{ courseId?: string }>();
  const navigate = useNavigate();
  const { canEditSchoolData: canEdit } = useAuth();
  useGrade();
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const selectedCourseId = courseIdParam ?? '';

  // 添加课程
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [courseForm, setCourseForm] = useState({
    name: '', subject_code: '', board: 'Edexcel',
    max_students: 20, description: '',
    semester: 'Fall',
  });
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    name: '', subject_code: '', board: 'Edexcel',
    max_students: 20, description: '',
    semester: 'Fall',
  });

  // 单元配置
  const [showUnitsDialog, setShowUnitsDialog] = useState(false);
  const [unitsCourseId, setUnitsCourseId] = useState('');
  const [unitsCourseNm, setUnitsCourseNm] = useState('');
  const [units, setUnits] = useState<CourseUnit[]>([]);
  const [unitForm, setUnitForm] = useState({
    unit_code: '',
    unit_name: '',
    is_advanced: false,
    max_score: 100,
    weight: 1.0,
    description: '',
    allowed_months: [] as number[],
  });
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);

  const fetchCourses = async () => {
    try { setIsLoading(true); setCourses(await courseApi.getAll()); }
    catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchCourses(); }, []);

  const handleCreateCourse = async () => {
    if (!courseForm.name.trim() || !courseForm.board) { alert('请填写课程名称和考试局'); return; }
    try {
      await courseApi.create({
        ...courseForm,
        grade_level: 'ALL',
        academic_year: '',
        semester: courseForm.semester || 'Fall',
      });
      setShowAddDialog(false);
      fetchCourses();
    } catch (err) { alert(err instanceof Error ? err.message : '创建失败'); }
  };

  const handleOpenEditCourse = (c: Course) => {
    setEditForm({
      id: c.id,
      name: c.name,
      subject_code: c.subject_code || '',
      board: c.board,
      max_students: c.max_students ?? 20,
      description: c.description || '',
      semester: c.semester || 'Fall',
    });
    setShowEditDialog(true);
  };

  const handleSaveEditCourse = async () => {
    if (!editForm.name.trim()) { alert('请填写课程名称'); return; }
    try {
      await courseApi.update(editForm.id, {
        name: editForm.name,
        subject_code: editForm.subject_code,
        board: editForm.board,
        max_students: editForm.max_students,
        description: editForm.description,
        academic_year: '',
        semester: editForm.semester,
        grade_level: 'ALL',
      });
      setShowEditDialog(false);
      fetchCourses();
    } catch (err) { alert(err instanceof Error ? err.message : '保存失败'); }
  };

  const handleDeleteCourse = async (id: string, name: string) => {
    if (!confirm(`确定删除课程 "${name}"？相关选课记录也会被删除。`)) return;
    try {
      await courseApi.delete(id);
      if (selectedCourseId === id) {
        navigate('/courses', { replace: true });
      }
      fetchCourses();
    } catch (err) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  // === 单元管理 ===
  const handleOpenUnits = async (courseId: string, courseName: string) => {
    setUnitsCourseId(courseId);
    setUnitsCourseNm(courseName);
    setEditingUnitId(null);
    setUnitForm({ unit_code: '', unit_name: '', is_advanced: false, max_score: 100, weight: 1.0, description: '', allowed_months: [] });
    try { setUnits(await courseApi.getUnits(courseId)); } catch { setUnits([]); }
    setShowUnitsDialog(true);
  };

  const handleAddUnit = async () => {
    if (!unitForm.unit_code.trim() || !unitForm.unit_name.trim()) { alert('请填写单元代码和名称'); return; }
    try {
      if (editingUnitId) {
        await courseApi.updateUnit(unitsCourseId, editingUnitId, unitForm);
      } else {
        await courseApi.addUnit(unitsCourseId, { ...unitForm, sort_order: units.length });
      }
      setUnits(await courseApi.getUnits(unitsCourseId));
      setUnitForm({ unit_code: '', unit_name: '', is_advanced: false, max_score: 100, weight: 1.0, description: '', allowed_months: [] });
      setEditingUnitId(null);
    } catch (err) { alert(err instanceof Error ? err.message : '操作失败'); }
  };

  const handleEditUnit = (u: CourseUnit) => {
    setEditingUnitId(u.id);
    setUnitForm({
      unit_code: u.unit_code,
      unit_name: u.unit_name,
      is_advanced: !!u.is_advanced,
      max_score: u.max_score,
      weight: u.weight,
      description: u.description || '',
      allowed_months: normalizeAllowedMonthsForForm(u.allowed_months as number[] | undefined),
    });
  };

  const handleDeleteUnit = async (unitId: string) => {
    try {
      await courseApi.deleteUnit(unitsCourseId, unitId);
      setUnits(await courseApi.getUnits(unitsCourseId));
    } catch (err) { alert(err instanceof Error ? err.message : '删除失败'); }
  };

  // 详情与列表用路由区分，浏览器「返回」会回到 /courses 列表，而不会跳到其它顶层页
  if (selectedCourseId) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => navigate('/courses')}>
          <ArrowLeft className="h-4 w-4 mr-2" />返回课程列表
        </Button>
        <CourseDetail courseId={selectedCourseId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">课程管理</h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button onClick={() => { setCourseForm({ name: '', subject_code: '', board: 'Edexcel', max_students: 20, description: '', semester: 'Fall' }); setShowAddDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />添加课程
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
      ) : courses.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-slate-400">
          <p className="mb-4">暂无课程</p>
          {canEdit && <Button variant="outline" onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-2" />创建第一门课程</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/courses/${course.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{course.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{course.board}</p>
                    {course.subject_code && <p className="text-xs text-slate-400 mt-0.5">代码: {course.subject_code}</p>}
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="sm" title="编辑课程" onClick={(e) => { e.stopPropagation(); handleOpenEditCourse(course); }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="单元配置" onClick={(e) => { e.stopPropagation(); handleOpenUnits(course.id, course.name); }}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500" title="删除" onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id, course.name); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <Badge variant="secondary">{course.student_count || 0} 人在读</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 添加课程弹窗 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent key={showAddDialog ? 'add-open' : 'add-closed'}>
          <DialogHeader><DialogTitle>添加新课程</DialogTitle><DialogDescription>一门课对应一个科目；不同届学生选课后在课程详情中按年级查看</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>课程名称 *</Label>
                <Input value={courseForm.name} onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} placeholder="如 Mathematics" /></div>
              <div className="space-y-2"><Label>科目代码</Label>
                <Input value={courseForm.subject_code} onChange={(e) => setCourseForm({ ...courseForm, subject_code: e.target.value })} placeholder="如 9MA0" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>考试局 *</Label>
                <Select value={courseForm.board} onValueChange={(v) => setCourseForm({ ...courseForm, board: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOARDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {boardLabel(b)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>学期</Label>
                <Select value={courseForm.semester} onValueChange={(v) => setCourseForm({ ...courseForm, semester: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fall">Fall</SelectItem>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="FullYear">全年</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>最大人数</Label>
                <Input type="number" value={courseForm.max_students} onChange={(e) => setCourseForm({ ...courseForm, max_students: parseInt(e.target.value) || 20 })} /></div>
            </div>
            <div className="space-y-2"><Label>描述</Label>
              <Input value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} placeholder="课程描述..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>取消</Button>
            <Button onClick={handleCreateCourse}>创建课程</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent key={editForm.id || 'edit'} className="max-w-lg">
          <DialogHeader><DialogTitle>编辑课程</DialogTitle><DialogDescription>修改课程名称、考试局等；学生按所属年级在课程详情中筛选查看</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>课程名称 *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>科目代码</Label>
                <Input value={editForm.subject_code} onChange={(e) => setEditForm({ ...editForm, subject_code: e.target.value })} /></div>
              <div className="space-y-2"><Label>考试局</Label>
                <Select value={editForm.board} onValueChange={(v) => setEditForm({ ...editForm, board: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BOARDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {boardLabel(b)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>学期</Label>
                <Select value={editForm.semester} onValueChange={(v) => setEditForm({ ...editForm, semester: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Fall">Fall</SelectItem>
                    <SelectItem value="Spring">Spring</SelectItem>
                    <SelectItem value="FullYear">全年</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>最大人数</Label>
                <Input type="number" value={editForm.max_students} onChange={(e) => setEditForm({ ...editForm, max_students: parseInt(e.target.value) || 20 })} /></div>
            </div>
            <div className="space-y-2"><Label>描述</Label>
              <Input value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>取消</Button>
            <Button onClick={handleSaveEditCourse}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* 单元配置弹窗 */}
      <Dialog open={showUnitsDialog} onOpenChange={setShowUnitsDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" key={unitsCourseId || 'units'}>
          <DialogHeader>
            <DialogTitle>单元配置 - {unitsCourseNm}</DialogTitle>
            <DialogDescription>A-Level 考试按单元进行，每个单元独立计分。在此配置课程的考试单元结构。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {units.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>单元代码</TableHead>
                    <TableHead>单元名称</TableHead>
                    <TableHead>属性</TableHead>
                    <TableHead>可考季</TableHead>
                    <TableHead>满分</TableHead>
                    <TableHead>权重</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-mono">{u.unit_code}</TableCell>
                      <TableCell>{u.unit_name}</TableCell>
                      <TableCell>
                        {u.is_advanced ? <Badge variant="secondary">高阶</Badge> : <span className="text-xs text-slate-400">—</span>}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {Array.isArray(u.allowed_months) && u.allowed_months.length > 0
                          ? [...u.allowed_months]
                              .sort((a, b) => a - b)
                              .map((m) => formatExamMonthLabel(m))
                              .join(' / ')
                          : STANDARD_EXAM_MONTHS_LABEL}
                      </TableCell>
                      <TableCell>{u.max_score}</TableCell>
                      <TableCell>{u.weight}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEditUnit(u)}><Edit2 className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteUnit(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">{editingUnitId ? '编辑单元' : '添加新单元'}</h4>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1"><Label className="text-xs">单元代码 *</Label>
                  <Input value={unitForm.unit_code} onChange={(e) => setUnitForm({ ...unitForm, unit_code: e.target.value })} placeholder="P1" /></div>
                <div className="space-y-1"><Label className="text-xs">单元名称 *</Label>
                  <Input value={unitForm.unit_name} onChange={(e) => setUnitForm({ ...unitForm, unit_name: e.target.value })} placeholder="Pure Mathematics 1" /></div>
                <div className="space-y-1"><Label className="text-xs">属性</Label>
                  <Select
                    value={unitForm.is_advanced ? 'advanced' : 'normal'}
                    onValueChange={(v) => setUnitForm({ ...unitForm, is_advanced: v === 'advanced' })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">普通单元</SelectItem>
                      <SelectItem value="advanced">高阶单元（用于 A*）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label className="text-xs">满分</Label>
                  <Input type="number" value={unitForm.max_score} onChange={(e) => setUnitForm({ ...unitForm, max_score: parseInt(e.target.value) || 100 })} /></div>
                <div className="space-y-1"><Label className="text-xs">权重</Label>
                  <Input type="number" step="0.1" value={unitForm.weight} onChange={(e) => setUnitForm({ ...unitForm, weight: parseFloat(e.target.value) || 1 })} /></div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">可考季（不选则默认 {STANDARD_EXAM_MONTHS_LABEL} 皆可）</Label>
                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    {[...STANDARD_EXAM_MONTHS].map((m) => {
                      const checked = unitForm.allowed_months.includes(m);
                      const label = formatExamMonthLabel(m);
                      return (
                        <label key={m} className="flex items-center gap-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            className="h-3 w-3"
                            checked={checked}
                            onChange={() => {
                              setUnitForm((prev) => {
                                const exists = prev.allowed_months.includes(m);
                                return {
                                  ...prev,
                                  allowed_months: exists
                                    ? prev.allowed_months.filter(v => v !== m)
                                    : [...prev.allowed_months, m],
                                };
                              });
                            }}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={handleAddUnit}>{editingUnitId ? '更新' : '添加'}</Button>
                {editingUnitId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingUnitId(null);
                      setUnitForm({ unit_code: '', unit_name: '', is_advanced: false, max_score: 100, weight: 1.0, description: '', allowed_months: [] });
                    }}
                  >
                    取消编辑
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
