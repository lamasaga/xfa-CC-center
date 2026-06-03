import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { studentApi, type StudentWithStats } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useGrade } from '@/contexts/GradeContext';
import {
  buildCohortSelectOptions,
  formatCohortDisplay,
  mergeCanonicalCohortList,
  parseEnrollmentYearFromGrade,
  yearToCanonicalGrade,
  MIN_ENROLLMENT_YEAR,
  DEFAULT_CLASS_SECTIONS,
  CLASS_TRACK_OPTIONS,
  type ClassTrack,
} from '@/lib/cohortLabels';
import { 
  Search, UserPlus, Eye, Target, BookOpen,
  AlertCircle, RefreshCw, Trash2
} from 'lucide-react';

export function StudentList() {
  const navigate = useNavigate();
  const { canManageStudentRoster } = useAuth();
  const { activeGrade, availableGrades, setAvailableGrades } = useGrade();
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => ({ grade: activeGrade, search: '' }));
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const requestSeqRef = useRef(0);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    english_name: '',
    grade: yearToCanonicalGrade(MIN_ENROLLMENT_YEAR),
    school: DEFAULT_CLASS_SECTIONS[0] as string,
    class_track: 'international' as ClassTrack,
    email: '',
    phone: '',
    wechat: '',
    parent_name: '',
    parent_phone: '',
    study_duration: 2 as 2 | 3,
  });

  const [deleteTarget, setDeleteTarget] = useState<StudentWithStats | null>(null);

  const fetchStudents = async () => {
    const seq = ++requestSeqRef.current;
    try {
      setIsLoading(true);
      setError('');
      const response = await studentApi.getAll({
        grade: filters.grade || undefined,
        search: filters.search || undefined,
      });
      if (seq !== requestSeqRef.current) return;
      setStudents(response);
      const gradesFromData = response.map((s) => s.grade).filter(Boolean) as string[];
      setAvailableGrades(mergeCanonicalCohortList(gradesFromData));
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      if (seq !== requestSeqRef.current) return;
      setIsLoading(false);
    }
  };

  // 若初次挂载时 filters.grade 为空或变化，确保与顶栏「入学届」保持一致
  useEffect(() => {
    // 从顶部「当前届别」联动学生管理筛选
    setFilters((f) => (f.grade === activeGrade ? f : { ...f, grade: activeGrade }));
  }, [activeGrade]);
  useEffect(() => { fetchStudents(); }, [filters.grade, filters.search, refreshTrigger]);

  const handleSearch = () => setRefreshTrigger(prev => prev + 1);
  const viewStudent = (id: string) => navigate(`/students/${id}`);

  const handleAddStudent = () => {
    const opts = buildCohortSelectOptions();
    setFormData({
      name: '',
      english_name: '',
      grade: opts[0]?.value || yearToCanonicalGrade(MIN_ENROLLMENT_YEAR),
      school: DEFAULT_CLASS_SECTIONS[0],
      class_track: 'international',
      email: '',
      phone: '',
      wechat: '',
      parent_name: '',
      parent_phone: '',
      study_duration: 2,
    });
    setIsAddDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) { alert('请输入学生姓名'); return; }
    if (!String(formData.english_name || '').trim()) {
      alert('请输入英文姓名（用于生成登录用户名：xfa + 英文小写无空格 + 届别后两位）');
      return;
    }
    const enrollmentYear = parseEnrollmentYearFromGrade(formData.grade);
    if (enrollmentYear == null) { alert('请选择入学届'); return; }

    try {
      setIsSubmitting(true);
      const res = await studentApi.create({
        name: formData.name.trim(),
        english_name: formData.english_name,
        grade: formData.grade,
        enrollment_year: enrollmentYear,
        study_duration: formData.study_duration,
        school: formData.school,
        class_track: formData.class_track,
        email: formData.email,
        phone: formData.phone,
        wechat: formData.wechat,
        parent_name: formData.parent_name,
        parent_phone: formData.parent_phone,
      });
      const acc = res.student_account;
      if (acc) {
        alert(
          `学生已创建。\n登录用户名：${acc.username}\n初始密码：${acc.initial_password}\n请妥善告知学生并在首次登录后督促修改密码。`
        );
      }
      setIsAddDialogOpen(false);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await studentApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* 筛选栏 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索学生姓名..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="pl-10"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            <Select 
              value={filters.grade || 'all'} 
              onValueChange={(value) => setFilters({ ...filters, grade: value === 'all' ? '' : value })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="选择入学届" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部届别</SelectItem>
                {availableGrades.map((grade) => (
                  <SelectItem key={grade} value={grade}>{formatCohortDisplay(grade)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleSearch}>搜索</Button>
            <Button variant="outline" onClick={() => setRefreshTrigger(prev => prev + 1)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            {canManageStudentRoster && (
              <Button className="ml-auto" onClick={handleAddStudent}>
                <UserPlus className="h-4 w-4 mr-2" />
                添加学生
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 学生列表 */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">学生列表 ({students.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600 mb-4">{error}</p>
              <Button variant="outline" onClick={fetchStudents}><RefreshCw className="h-4 w-4 mr-2" />重试</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>学生信息</TableHead>
                    <TableHead>入学届</TableHead>
                    <TableHead>课程数</TableHead>
                    <TableHead>雅思成绩</TableHead>
                    <TableHead>申请进度</TableHead>
                    <TableHead>待办任务</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id} className="cursor-pointer hover:bg-slate-50" onClick={() => viewStudent(student.id)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">{student.name}</p>
                          <p className="text-xs text-slate-500">{student.english_name || student.school || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{formatCohortDisplay(student.grade)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                          <span>{student.stats.courseCount} 科</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.stats.hasLanguageScore ? (
                          <span className="text-green-600 font-medium">{student.stats.bestIelts}</span>
                        ) : (
                          <span className="text-slate-400">暂无</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Target className="h-3.5 w-3.5 text-slate-400" />
                          <span>{student.stats.offerCount} / {student.stats.universityCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.stats.pendingTasks > 0 ? (
                          <div className="flex items-center gap-1 text-orange-600">
                            <AlertCircle className="h-3.5 w-3.5" /><span>{student.stats.pendingTasks} 项</span>
                          </div>
                        ) : <span className="text-slate-400">--</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" onClick={() => viewStudent(student.id)}>
                            <Eye className="h-4 w-4 mr-1" />查看
                          </Button>
                          {canManageStudentRoster && (
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(student)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {students.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <p className="text-slate-400 mb-4">暂无学生数据</p>
                        {canManageStudentRoster && (
                          <Button variant="outline" onClick={handleAddStudent}>
                            <UserPlus className="h-4 w-4 mr-2" />添加第一个学生
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 添加学生弹窗 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加新学生</DialogTitle>
            <DialogDescription>
              入学届、班级类型、学制与班级为区分学生的基本维度；带 * 为必填
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>中文姓名 *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="请输入中文姓名" />
              </div>
              <div className="space-y-2">
                <Label>英文姓名 *</Label>
                <Input
                  value={formData.english_name}
                  onChange={(e) => setFormData({ ...formData, english_name: e.target.value })}
                  placeholder="登录用户名为 xfa + 此处英文（小写无空格）+ 届别后两位"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>入学届 *</Label>
                <Select value={formData.grade} onValueChange={(v) => setFormData({ ...formData, grade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {buildCohortSelectOptions().map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>班级类型 *</Label>
                <Select
                  value={formData.class_track}
                  onValueChange={(v) => setFormData({ ...formData, class_track: v as ClassTrack })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLASS_TRACK_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>学制 *</Label>
                <Select
                  value={String(formData.study_duration)}
                  onValueChange={(v) => setFormData({ ...formData, study_duration: parseInt(v, 10) as 2 | 3 })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 年制</SelectItem>
                    <SelectItem value="3">3 年制</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>班级 *</Label>
                <Select value={formData.school} onValueChange={(v) => setFormData({ ...formData, school: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_CLASS_SECTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>微信号</Label>
                <Input value={formData.wechat} onChange={(e) => setFormData({ ...formData, wechat: e.target.value })} placeholder="微信号" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>邮箱</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="student@example.com" />
              </div>
              <div className="space-y-2">
                <Label>电话</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="138****8888" />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">家长信息</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>家长姓名</Label>
                  <Input value={formData.parent_name} onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })} placeholder="家长姓名" />
                </div>
                <div className="space-y-2">
                  <Label>家长电话</Label>
                  <Input value={formData.parent_phone} onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })} placeholder="139****9999" />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? '保存中...' : '保存'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>此操作不可恢复，该学生的所有关联数据（课程、成绩、院校申请等）都将被删除。</DialogDescription>
          </DialogHeader>
          <p className="py-4">确定要删除学生 <strong>{deleteTarget?.name}</strong> 吗？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>取消</Button>
            <Button variant="destructive" onClick={handleDelete}>确认删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
