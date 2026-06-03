import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { courseApi, studentApi, universityApi, type Course, type University, type WorkbenchItem } from '@/services/api';
import { useGrade } from '@/contexts/GradeContext';
import { formatCohortDisplay, mergeCanonicalCohortList } from '@/lib/cohortLabels';
import { AlertTriangle, ClipboardList, Search } from 'lucide-react';

const ALL = '__all__';

export function CenterWorkbench() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeGrade, setActiveGrade, availableGrades, setAvailableGrades } = useGrade();

  useEffect(() => {
    let cancelled = false;
    studentApi
      .getAll({ status: 'active' })
      .then((list) => {
        if (cancelled) return;
        const gs = [...new Set(list.map((s) => s.grade).filter(Boolean))] as string[];
        setAvailableGrades((prev) => mergeCanonicalCohortList([...prev, ...gs]));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [setAvailableGrades]);

  const focusStudentId = searchParams.get('studentId');

  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<WorkbenchItem[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!focusStudentId) return;
    let cancelled = false;
    studentApi
      .getById(focusStudentId)
      .then((st) => {
        if (cancelled || !st?.grade) return;
        setActiveGrade(st.grade);
        setQuery(st.name || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [focusStudentId, setActiveGrade]);

  const [courseOptions, setCourseOptions] = useState<Course[]>([]);
  const [universityOptions, setUniversityOptions] = useState<University[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(ALL);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string>(ALL);

  const courseIdForQuery = selectedCourseId !== ALL ? selectedCourseId : undefined;
  const universityIdForQuery = selectedUniversityId !== ALL ? selectedUniversityId : undefined;

  useEffect(() => {
    setIsLoading(true);
    studentApi.getWorkbench({ grade: activeGrade, course_id: courseIdForQuery, university_id: universityIdForQuery })
      .then((r) => setItems(r.items || []))
      .catch(() => setItems([]))
      .finally(() => setIsLoading(false));
  }, [activeGrade, courseIdForQuery, universityIdForQuery]);

  useEffect(() => {
    // 下拉选项：课程按当前年级过滤（后端会自动包含 ALL 可见课）
    let cancelled = false;
    courseApi.getAll({ grade_level: activeGrade })
      .then((courses) => { if (!cancelled) setCourseOptions(courses || []); })
      .catch(() => { if (!cancelled) setCourseOptions([]); });
    return () => { cancelled = true; };
  }, [activeGrade]);

  useEffect(() => {
    // 目标院校库整体加载即可（体量通常不大）
    let cancelled = false;
    universityApi.getAll()
      .then((unis) => { if (!cancelled) setUniversityOptions(unis || []); })
      .catch(() => { if (!cancelled) setUniversityOptions([]); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      it.name.toLowerCase().includes(q) ||
      (it.english_name || '').toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">升学中心工作台</h1>
          <p className="text-sm text-slate-500 mt-1">按风险与任务截止日期聚合本入学届需要优先跟进的学生</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/students')}>
            <ClipboardList className="h-4 w-4 mr-2" />
            打开学生管理
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* 入学届筛选 */}
            <Select
              value={activeGrade}
              onValueChange={(v) => {
                setActiveGrade(v);
                setSelectedCourseId(ALL);
                setSelectedUniversityId(ALL);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="入学届" />
              </SelectTrigger>
              <SelectContent>
                {availableGrades.map((g) => (
                  <SelectItem key={g} value={g}>{formatCohortDisplay(g)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 课程筛选 */}
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="课程" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部课程</SelectItem>
                {courseOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}{c.board ? ` · ${c.board}` : ''}{c.grade_level ? ` · ${c.grade_level}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 目标院校筛选 */}
            <Select value={selectedUniversityId} onValueChange={setSelectedUniversityId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="目标院校" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>全部目标院校</SelectItem>
                {universityOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}{u.country ? ` · ${u.country}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 搜索 */}
            <div className="relative w-[220px] min-w-[180px]">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <Input
                className="pl-9 h-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索学生姓名/英文名"
              />
            </div>
            <Badge variant="outline">命中：{filtered.length}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            风险清单
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="py-10 text-center text-slate-400">加载中...</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-400">暂无数据</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>学生</TableHead>
                  <TableHead>风险分</TableHead>
                  <TableHead>IELTS</TableHead>
                  <TableHead>重考</TableHead>
                  <TableHead>未排考季</TableHead>
                  <TableHead>7天内到期</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((it) => (
                  <TableRow key={it.student_id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="font-medium text-slate-900">{it.name}</div>
                      <div className="text-xs text-slate-500">{it.english_name || ''}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className={it.risk_score >= 8 ? 'bg-red-100 text-red-700 border-0' : it.risk_score >= 4 ? 'bg-orange-100 text-orange-700 border-0' : 'bg-slate-100 text-slate-700 border-0'}>
                        {it.risk_score}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {it.best_ielts ? (
                        <Badge className="bg-green-100 text-green-700 border-0">{it.best_ielts}</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700 border-0">缺失</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {it.resit_needed > 0 ? (
                        <Badge className="bg-orange-100 text-orange-700 border-0">{it.resit_needed}</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {it.unplanned_units > 0 ? (
                        <Badge className="bg-slate-100 text-slate-700 border-0">{it.unplanned_units}</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {it.urgent_tasks_7d > 0 ? (
                        <Badge className="bg-red-100 text-red-700 border-0">{it.urgent_tasks_7d}</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(it.reasons || []).slice(0, 3).map((r, idx) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {r}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/students/${it.student_id}?tab=info`)}>
                        打开
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/students/${it.student_id}?tab=tasks`)}>
                        任务
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/students/${it.student_id}?tab=sessions`)}>
                        考季
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

