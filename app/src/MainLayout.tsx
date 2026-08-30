import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
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
import { GradeProvider, useGrade } from '@/contexts/GradeContext';
import {
  COHORT_NAV_VISIBLE,
  formatCohortDisplay,
  getCohortNavDefaultWindowStart,
  parseEnrollmentYearFromGrade,
} from '@/lib/cohortLabels';
import {
  LayoutDashboard,
  Users,
  BookOpen,
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
  BookMarked,
  CalendarRange,
  ClipboardList,
  ShieldCheck,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react';
import { openStudyExploreWindow } from '@/lib/studyExploreUrl';

const Dashboard = lazy(() => import('./Dashboard'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const AdminAccountsPage = lazy(() => import('@/pages/AdminAccountsPage'));
const TranscriptPrintView = lazy(() => import('@/pages/TranscriptPrintView'));
const SchoolOverviewPage = lazy(() => import('@/pages/SchoolOverviewPage'));
const CurriculumLibraryPage = lazy(() => import('@/pages/CurriculumLibraryPage'));
const CoursePlanningPage = lazy(() => import('@/pages/CoursePlanningPage'));
const CourseSelectionPage = lazy(() => import('@/pages/CourseSelectionPage'));
const SchedulingPage = lazy(() => import('@/pages/SchedulingPage'));
const AcademicRecordsPage = lazy(() => import('@/pages/AcademicRecordsPage'));
const SecurityAuditPage = lazy(() => import('@/pages/SecurityAuditPage'));
const StudentList = lazy(() => import('@/sections/StudentList').then((module) => ({ default: module.StudentList })));
const StudentDetail = lazy(() => import('@/sections/StudentDetail').then((module) => ({ default: module.StudentDetail })));
const GradeOverview = lazy(() => import('@/sections/GradeOverview').then((module) => ({ default: module.GradeOverview })));
const CourseManagement = lazy(() => import('@/sections/CourseManagement').then((module) => ({ default: module.CourseManagement })));
const UniversityLibrary = lazy(() => import('@/sections/UniversityLibrary').then((module) => ({ default: module.UniversityLibrary })));
const CenterWorkbench = lazy(() => import('@/sections/CenterWorkbench').then((module) => ({ default: module.CenterWorkbench })));

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

function navItemClass(active: boolean, sidebar = false) {
  if (sidebar) {
    return `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active
        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
        : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
    }`;
  }
  return `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    active
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;
}

function MainLayoutInner() {
  const { user, logout, hasPermission } = useAuth();
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
        { name: '我的总览', href: `/student/${ownStudentId}`, icon: LayoutDashboard },
        { name: '选课', href: '/selection', icon: ClipboardList },
        { name: '我的课表', href: '/scheduling', icon: CalendarRange },
        { name: '学业档案', href: `/students/${ownStudentId}`, icon: Users },
        { name: '考试与成绩', href: `/students/${ownStudentId}?tab=sessions`, icon: NotebookPen },
        studyExploreItem,
      ];
    }
    if (isTeacher) {
      return [
        { name: '学校总览', href: '/', icon: LayoutDashboard },
        { name: '学生', href: '/students', icon: Users },
        { name: '学段档案', href: '/academic-records', icon: UserRoundCheck },
        { name: '课程与大纲', href: '/curriculum', icon: BookMarked },
        { name: '选课', href: '/selection', icon: ClipboardList },
        { name: '我的课表', href: '/scheduling', icon: CalendarRange },
        { name: '考试与成绩', href: studentContextHref('sessions', contextStudentId), icon: Calendar },
        studyExploreItem,
      ];
    }
    const items: MainNavItem[] = [
      { name: '学校总览', href: '/', icon: LayoutDashboard },
      { name: '学生', href: '/students', icon: Users },
      { name: '学段档案', href: '/academic-records', icon: UserRoundCheck },
      { name: '课程与大纲', href: '/curriculum', icon: BookMarked },
      { name: '选课', href: '/selection', icon: ClipboardList },
      { name: '开课与教学班', href: '/course-planning', icon: BookOpen },
      { name: '排课', href: '/scheduling', icon: CalendarRange },
      { name: '考试与成绩', href: studentContextHref('sessions', contextStudentId), icon: Calendar },
      studyExploreItem,
    ];
    if (user?.role === 'admin') items.push({ name: '权限与审计', href: '/security', icon: ShieldCheck });
    return items;
  }, [isStudent, isTeacher, ownStudentId, contextStudentId, user?.role]);

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
      p === '/academic-records' ||
      p === '/curriculum' ||
      p === '/course-planning' ||
      p === '/security' ||
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
      p === '/course-planning' ||
      p === '/security' ||
      p.startsWith('/admin/')
    ) {
      return <Navigate to="/students" replace />;
    }
  }

  const routeContent = (
    <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">正在加载工作区…</div>}>
    <Routes>
      <Route path="/" element={isStudent && ownStudentId ? <Navigate to={`/student/${ownStudentId}`} replace /> : <SchoolOverviewPage />} />
      <Route path="/workbench" element={<CenterWorkbench />} />
      <Route path="/students" element={<StudentList />} />
      <Route path="/students/:id" element={<StudentDetail />} />
      <Route path="/students/:id/transcript" element={<TranscriptPrintView />} />
      <Route path="/academic-records" element={<AcademicRecordsPage />} />
      <Route path="/curriculum" element={<CurriculumLibraryPage />} />
      <Route path="/selection" element={<CourseSelectionPage />} />
      <Route path="/course-planning" element={<CoursePlanningPage />} />
      <Route path="/scheduling" element={<SchedulingPage />} />
      <Route path="/security" element={user?.role === 'admin' ? <SecurityAuditPage /> : <Navigate to="/" replace />} />
      <Route path="/grade" element={<GradeOverview grade={activeGrade} />} />
      <Route path="/courses/:courseId" element={<CourseManagement />} />
      <Route path="/courses" element={<CourseManagement />} />
      <Route path="/universities" element={<UniversityLibrary />} />
      <Route path="/student/:id" element={<Dashboard />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/admin/accounts" element={user?.role === 'admin' ? <AdminAccountsPage /> : <Navigate to={isStudent && ownStudentId ? `/student/${ownStudentId}` : '/'} replace />} />
    </Routes>
    </Suspense>
  );

  if (hideAppChrome) {
    return <main className="min-h-screen bg-background">{routeContent}</main>;
  }

  const accountMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 rounded-lg">
          <div className="flex size-8 items-center justify-center rounded-full bg-muted ring-1 ring-border/60"><User className="size-4 text-muted-foreground" /></div>
          <div className="hidden text-left sm:block"><p className="text-sm font-medium">{user?.name}</p><p className="text-xs text-muted-foreground">{roleDisplayLabel(user?.role)}</p></div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>我的账号</DropdownMenuLabel><DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/profile')}><User />个人资料</DropdownMenuItem>
        {hasPermission('admin') && <DropdownMenuItem onClick={() => navigate('/admin/accounts')}><Shield />账号与权限</DropdownMenuItem>}
        {hasPermission('admin') && <DropdownMenuItem onClick={() => navigate('/settings')}><Settings />系统设置</DropdownMenuItem>}
        <DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onClick={() => void logout()}><LogOut />退出登录</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Link to="/" className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
          <img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="北京新学道" width={42} height={42} className="size-11 rounded-full bg-white object-contain ring-1 ring-sidebar-border" />
          <div className="flex min-w-0 flex-col gap-0.5 leading-tight"><span className="truncate text-base font-semibold text-sidebar-foreground">XFA IG–A Level</span><span className="text-xs text-sidebar-foreground/60">学习与学校管理</span></div>
        </Link>
        <nav className="thin-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navigation.map((item) => {
            if (item.openStudyExplore) return <button key={item.name} type="button" onClick={openStudyExploreWindow} className={navItemClass(false, true)}><item.icon className="size-4 shrink-0" />{item.name}</button>;
            const href = item.href || '/';
            return <Link key={item.name} to={href} className={navItemClass(isMainNavActive(href, location.pathname, location.search), true)}><item.icon className="size-4 shrink-0" />{item.name}</Link>;
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground"><User className="size-4" /></div><div className="min-w-0"><p className="truncate text-sm font-medium text-sidebar-foreground">{user?.name}</p><p className="text-xs text-sidebar-foreground/60">{roleDisplayLabel(user?.role)}</p></div></div></div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link to="/" className="flex items-center gap-3 lg:hidden"><img src={`${import.meta.env.BASE_URL}school-logo.png`} alt="北京新学道" width={36} height={36} className="size-9 rounded-full object-contain" /><div className="flex flex-col leading-tight"><span className="text-sm font-semibold">XFA IG–A Level</span><span className="text-[10px] text-muted-foreground">学习与学校管理</span></div></Link>
            <div className="hidden flex-col lg:flex"><span className="text-sm font-medium">XFA升学指导中心</span><span className="text-xs text-muted-foreground">教学、考试与升学数据仅供校内使用</span></div>
            {accountMenu}
          </div>
          <nav className="thin-scrollbar flex gap-1 overflow-x-auto border-t px-3 py-2 lg:hidden">
            {navigation.map((item) => item.openStudyExplore ? <button key={item.name} type="button" onClick={openStudyExploreWindow} className={navItemClass(false)}><item.icon className="size-4 shrink-0" />{item.name}</button> : <Link key={item.name} to={item.href || '/'} className={`${navItemClass(isMainNavActive(item.href || '/', location.pathname, location.search))} shrink-0`}><item.icon className="size-4 shrink-0" />{item.name}</Link>)}
          </nav>
        </header>

        {!isStudent && (location.pathname === '/grade' || /^\/student\/[^/]+\/?$/.test(location.pathname)) && (
          <div className="border-b bg-muted/30 px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3"><span className="shrink-0 text-sm text-muted-foreground">入学届</span>{showCohortScroll && <button type="button" aria-label="上一组届别" disabled={!canScrollCohortLeft} onClick={() => setCohortWindowStart((value) => Math.max(0, value - 1))} className="flex size-8 items-center justify-center rounded-md border bg-card disabled:opacity-40"><ChevronLeft className="size-4" /></button>}<div role="group" aria-label="入学届选择" className="flex min-w-0 gap-1 overflow-x-auto">{visibleCohortGrades.map((grade) => <button key={grade} type="button" onClick={() => setActiveGrade(grade)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${activeGrade === grade ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>{formatCohortDisplay(grade)}</button>)}</div>{showCohortScroll && <button type="button" aria-label="下一组届别" disabled={!canScrollCohortRight} onClick={() => setCohortWindowStart((value) => Math.min(cohortNavMaxStart, value + 1))} className="flex size-8 items-center justify-center rounded-md border bg-card disabled:opacity-40"><ChevronRight className="size-4" /></button>}</div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">{routeContent}</main>
        <footer className="border-t px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8"><div className="mx-auto flex w-full max-w-[1600px] flex-col gap-1 sm:flex-row sm:justify-between"><p>XFA IG–A Level 学习与学校管理</p><p>教学与升学数据仅供校内使用</p></div></footer>
      </div>
    </div>
  );
}
