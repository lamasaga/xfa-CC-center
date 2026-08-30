import { useEffect, useMemo, useRef, useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StudentList } from '@/sections/StudentList';
import { StudentDetail } from '@/sections/StudentDetail';
import { GradeOverview } from '@/sections/GradeOverview';
import { CourseManagement } from '@/sections/CourseManagement';
import { UniversityLibrary } from '@/sections/UniversityLibrary';
import { CenterWorkbench } from '@/sections/CenterWorkbench';
import { GradeProvider, useGrade } from '@/contexts/GradeContext';
import {
  COHORT_NAV_VISIBLE,
  formatCohortDisplay,
  getCohortNavDefaultWindowStart,
  parseEnrollmentYearFromGrade,
} from '@/lib/cohortLabels';
import Dashboard from './Dashboard';
import ProfilePage from '@/pages/ProfilePage';
import SettingsPage from '@/pages/SettingsPage';
import AdminAccountsPage from '@/pages/AdminAccountsPage';
import TranscriptPrintView from '@/pages/TranscriptPrintView';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  School,
  Library,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Settings,
  Calendar,
  NotebookPen,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { openStudyExploreWindow } from '@/lib/studyExploreUrl';

type MainNavItem = {
  name: string;
  icon: LucideIcon;
  href?: string;
  /** 新窗口打开 study-app 院校探索站 */
  openStudyExplore?: boolean;
};

function roleDisplayLabel(role: string | undefined) {
  switch (role) {
    case 'admin':
      return '系统管理员';
    case 'staff':
      return '教务';
    case 'supervisor':
      return '指导老师';
    case 'teacher':
      return '任课教师';
    case 'student':
      return '学生';
    default:
      return role || '';
  }
}

export default function MainLayout() {
  return (
    <GradeProvider>
      <MainLayoutInner />
    </GradeProvider>
  );
}

function studentIdFromPath(pathname: string) {
  const match = pathname.match(/^\/students?\/([^/]+)/);
  return match?.[1] || '';
}

function studentContextHref(tab: string, contextStudentId?: string) {
  const sid = contextStudentId || localStorage.getItem('lastViewedStudentId');
  return sid ? `/students/${sid}?tab=${encodeURIComponent(tab)}` : '/students';
}

function isMainNavActive(itemHref: string, pathname: string, search: string) {
  if (itemHref.includes('?')) {
    return `${pathname}${search}` === itemHref;
  }
  if (itemHref === '/') {
    return pathname === '/' || pathname.startsWith('/student/');
  }
  if (itemHref === '/students') {
    return pathname === '/students' || pathname.startsWith('/students/');
  }
  if (itemHref === '/courses') {
    return pathname === '/courses' || pathname.startsWith('/courses/');
  }
  return pathname === itemHref;
}

function isStudentTranscriptPath(pathname: string) {
  return /^\/students\/[^/]+\/transcript\/?$/.test(pathname);
}

function navItemClass(active: boolean) {
  return `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;
}

function MainLayoutInner() {
  const { user, logout, hasPermission, canEditUniversityCatalog } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';
  const ownStudentId = user?.student_id || '';
  const { activeGrade, setActiveGrade, availableGrades } = useGrade();
  const hideAppChrome = isStudentTranscriptPath(location.pathname);
  // 当前学生详情路由是最可靠的上下文；只有列表/总览页才回退到最近查看的学生。
  const routeStudentId = studentIdFromPath(location.pathname);
  const contextStudentId = routeStudentId || localStorage.getItem('lastViewedStudentId') || '';

  const sortedGrades = useMemo(
    () =>
      [...availableGrades].sort(
        (a, b) =>
          (parseEnrollmentYearFromGrade(a) || 0) - (parseEnrollmentYearFromGrade(b) || 0)
      ),
    [availableGrades]
  );

  const anchorCalendarYear = new Date().getFullYear();
  const gradesListKey = sortedGrades.join('\0');
  const prevGradesKeyRef = useRef<string | null>(null);

  const [cohortWindowStart, setCohortWindowStart] = useState(0);

  useEffect(() => {
    const maxStart = Math.max(0, sortedGrades.length - COHORT_NAV_VISIBLE);
    const anchorStart = getCohortNavDefaultWindowStart(sortedGrades, anchorCalendarYear);
    const idx = sortedGrades.indexOf(activeGrade);
    const listChanged = prevGradesKeyRef.current !== gradesListKey;
    prevGradesKeyRef.current = gradesListKey;

    setCohortWindowStart((prev) => {
      let start = listChanged ? anchorStart : prev;
      if (idx >= 0) {
        if (idx < start) start = idx;
        else if (idx >= start + COHORT_NAV_VISIBLE) start = idx - COHORT_NAV_VISIBLE + 1;
      }
      return Math.max(0, Math.min(start, maxStart));
    });
  }, [gradesListKey, activeGrade, sortedGrades, anchorCalendarYear]);

  const cohortNavMaxStart = Math.max(0, sortedGrades.length - COHORT_NAV_VISIBLE);
  const visibleCohortGrades = sortedGrades.slice(cohortWindowStart, cohortWindowStart + COHORT_NAV_VISIBLE);
  const showCohortScroll = sortedGrades.length > COHORT_NAV_VISIBLE;
  const canScrollCohortLeft = showCohortScroll && cohortWindowStart > 0;
  const canScrollCohortRight = showCohortScroll && cohortWindowStart < cohortNavMaxStart;

  const navigation = useMemo((): MainNavItem[] => {
    const studyExploreItem: MainNavItem = {
      name: '院校',
      icon: Library,
      openStudyExplore: true,
    };
    if (isStudent && ownStudentId) {
      return [
        { name: '升学仪表盘', href: `/student/${ownStudentId}`, icon: LayoutDashboard },
        { name: '学业档案', href: `/students/${ownStudentId}`, icon: Users },
        { name: '成绩', href: `/students/${ownStudentId}?tab=grades`, icon: NotebookPen },
        studyExploreItem,
      ];
    }
    if (isTeacher) {
      return [
        { name: '仪表盘', href: '/', icon: LayoutDashboard },
        { name: '学生管理', href: '/students', icon: Users },
        { name: '成绩查看', href: studentContextHref('grades', contextStudentId), icon: NotebookPen },
        { name: '考季规划', href: studentContextHref('sessions', contextStudentId), icon: Calendar },
        { name: '年级概览', href: '/grade', icon: School },
        studyExploreItem,
      ];
    }
    const items: MainNavItem[] = [
      { name: '仪表盘', href: '/', icon: LayoutDashboard },
      { name: '学生管理', href: '/students', icon: Users },
      { name: '成绩管理', href: studentContextHref('grades', contextStudentId), icon: NotebookPen },
      { name: '考季规划', href: studentContextHref('sessions', contextStudentId), icon: Calendar },
      { name: '年级概览', href: '/grade', icon: School },
      { name: '课程管理', href: '/courses', icon: BookOpen },
      studyExploreItem,
    ];
    if (canEditUniversityCatalog) {
      items.push({ name: '维护', href: '/universities', icon: Shield });
    }
    return items;
  }, [isStudent, isTeacher, ownStudentId, canEditUniversityCatalog, contextStudentId]);

  if (isStudent && !ownStudentId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-destructive font-medium">学生账号未绑定学生档案，无法使用系统。请联系管理员。</p>
        <Button variant="outline" onClick={logout}>
          退出登录
        </Button>
      </div>
    );
  }

  if (isStudent && ownStudentId) {
    const p = location.pathname;
    if (p === '/students' || p === '/students/') {
      return <Navigate to={`/students/${ownStudentId}`} replace />;
    }
    const sm = p.match(/^\/students\/([^/]+)/);
    if (sm && sm[1] && !p.includes('/transcript') && sm[1] !== ownStudentId) {
      return <Navigate to={`/students/${ownStudentId}`} replace />;
    }
    const stm = p.match(/^\/student\/([^/]+)/);
    if (stm && stm[1] && stm[1] !== ownStudentId) {
      return <Navigate to={`/student/${ownStudentId}`} replace />;
    }
    const transcriptM = p.match(/^\/students\/([^/]+)\/transcript\/?$/);
    if (transcriptM && transcriptM[1] !== ownStudentId) {
      return <Navigate to={`/students/${ownStudentId}/transcript`} replace />;
    }
    if (
      p === '/workbench' ||
      p === '/grade' ||
      p === '/courses' ||
      p === '/universities' ||
      p === '/settings' ||
      p.startsWith('/admin/') ||
      p.startsWith('/courses/')
    ) {
      return <Navigate to={`/student/${ownStudentId}`} replace />;
    }
  }

  if (isTeacher) {
    const p = location.pathname;
    if (
      p === '/courses' ||
      p.startsWith('/courses/') ||
      p === '/universities' ||
      p === '/workbench' ||
      p === '/settings' ||
      p.startsWith('/admin/')
    ) {
      return <Navigate to="/students" replace />;
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 成绩单打印页不挂载顶栏，避免打印/PDF 带出管理员身份与主导航 */}
      {!hideAppChrome && (
      <header className="sticky top-0 z-50 border-b border-border/80 bg-card/90 backdrop-blur-md shadow-sm shadow-black/[0.04]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[3.25rem]">
            <div className="flex items-center gap-8">
              {/* Logo */}
              <Link to="/" className="flex items-center gap-3 group">
                <img
                  src={`${import.meta.env.BASE_URL}school-logo.png`}
                  alt="北京新学道"
                  width={40}
                  height={40}
                  className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full object-contain bg-white ring-1 ring-border/70 shadow-sm transition-transform group-hover:scale-[1.02]"
                />
                <div className="flex flex-col leading-tight">
                  <span className="font-serif text-lg font-semibold tracking-tight text-foreground">
                    XFA升学指导中心
                  </span>
                  <span className="text-[10px] text-muted-foreground font-sans font-medium">
                    学生综合管理系统
                  </span>
                </div>
              </Link>

              {/* 主导航 */}
              <nav className="hidden md:flex items-center gap-0.5">
                {navigation.map((item) => {
                  if (item.openStudyExplore) {
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={openStudyExploreWindow}
                        className={navItemClass(false)}
                      >
                        <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                        {item.name}
                      </button>
                    );
                  }
                  const href = item.href ?? '/';
                  const isActive = isMainNavActive(href, location.pathname, location.search);
                  return (
                    <Link key={item.name} to={href} className={navItemClass(isActive)}>
                      <item.icon className="h-4 w-4 shrink-0 opacity-90" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* 右侧：用户菜单 */}
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 rounded-lg">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center ring-1 ring-border/60">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-left hidden sm:block">
                      <p className="text-sm font-medium text-foreground">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{roleDisplayLabel(user?.role)}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>我的账号</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex items-center gap-2"
                    onClick={() => navigate('/profile')}
                  >
                    <User className="h-4 w-4" />
                    个人资料
                  </DropdownMenuItem>
                  {hasPermission('admin') && (
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={() => navigate('/admin/accounts')}
                    >
                      <Shield className="h-4 w-4" />
                      账号与权限
                    </DropdownMenuItem>
                  )}
                  {hasPermission('admin') && (
                    <DropdownMenuItem
                      className="flex items-center gap-2"
                      onClick={() => navigate('/settings')}
                    >
                      <Settings className="h-4 w-4" />
                      系统设置
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="flex items-center gap-2 text-red-600"
                    onClick={logout}
                  >
                    <LogOut className="h-4 w-4" />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      )}

      {/* 子导航（年级选择）：教务/管理员；学生仅查看本人数据，不显示届别条 */}
      {!isStudent &&
        (location.pathname === '/' ||
        location.pathname === '/grade' ||
        /^\/student\/[^/]+\/?$/.test(location.pathname)) && (
        <div className="bg-muted/40 border-b border-border/70">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 sm:gap-4 min-h-11 py-1.5">
              <span className="text-sm text-muted-foreground shrink-0">
                入学届
                <span className="hidden sm:inline text-muted-foreground/80 font-normal">
                  （{String(anchorCalendarYear).slice(-2)} 年届起）
                </span>
              </span>
              <div className="flex flex-1 items-center justify-center sm:justify-start gap-1 min-w-0">
                {showCohortScroll && (
                <button
                  type="button"
                  aria-label="上一组届别"
                  disabled={!canScrollCohortLeft}
                  onClick={() => setCohortWindowStart((s) => Math.max(0, s - 1))}
                  className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-35"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                )}
                <div
                  role="group"
                  aria-label="入学届选择"
                  className="flex flex-1 sm:flex-initial items-center justify-center gap-1 sm:gap-1.5 min-w-0 rounded-xl border border-border/60 bg-card/80 px-1.5 py-1 shadow-sm shadow-black/[0.03]"
                >
                  {visibleCohortGrades.map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setActiveGrade(grade)}
                      className={`min-w-[3.25rem] px-3 py-1.5 rounded-lg text-sm font-semibold tabular-nums transition-colors ${
                        activeGrade === grade
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {formatCohortDisplay(grade)}
                    </button>
                  ))}
                </div>
                {showCohortScroll && (
                <button
                  type="button"
                  aria-label="下一组届别"
                  disabled={!canScrollCohortRight}
                  onClick={() =>
                    setCohortWindowStart((s) => Math.min(cohortNavMaxStart, s + 1))
                  }
                  className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-card text-foreground shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-35"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto w-full flex-1 px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/workbench" element={<CenterWorkbench />} />
          <Route path="/students" element={<StudentList />} />
          <Route path="/students/:id" element={<StudentDetail />} />
          <Route path="/students/:id/transcript" element={<TranscriptPrintView />} />
          <Route path="/grade" element={<GradeOverview grade={activeGrade} />} />
          <Route path="/courses/:courseId" element={<CourseManagement />} />
          <Route path="/courses" element={<CourseManagement />} />
          <Route path="/universities" element={<UniversityLibrary />} />
          <Route path="/student/:id" element={<Dashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/admin/accounts"
            element={
              user?.role === 'admin' ? (
                <AdminAccountsPage />
              ) : (
                <Navigate
                  to={user?.role === 'student' && ownStudentId ? `/student/${ownStudentId}` : '/'}
                  replace
                />
              )
            }
          />
        </Routes>
      </main>

      {!hideAppChrome && (
      <footer className="mt-auto border-t border-border/70 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
            <p>XFA升学指导中心 · 学生综合管理系统 v2.0</p>
            <p className="text-muted-foreground/80">教学与升学数据仅供校内使用</p>
          </div>
        </div>
      </footer>
      )}
    </div>
  );
}
