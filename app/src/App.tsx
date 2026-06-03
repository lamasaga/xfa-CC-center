import { useState } from 'react';
import { StudentHeader } from '@/sections/StudentHeader';
import { OverallProgress } from '@/sections/OverallProgress';
import { GradesOverview } from '@/sections/GradesOverview';
import { TargetUniversities } from '@/sections/TargetUniversities';
import { ExamScheduleSection } from '@/sections/ExamSchedule';
import { ApplicationTimeline } from '@/sections/ApplicationTimeline';
import { Extracurriculars } from '@/sections/Extracurriculars';
import { Recommendations } from '@/sections/Recommendations';
import { StudentRadarChart } from '@/sections/StudentRadarChart';
import { UniversityMatchPanel } from '@/sections/UniversityMatchPanel';
import { GradeComparisonPanel } from '@/sections/GradeComparisonPanel';
import { PriorityTasksPanel } from '@/sections/PriorityTasksPanel';
import { KeyMetricsPanel } from '@/sections/KeyMetricsPanel';
import { QuickActionsPanel } from '@/sections/QuickActionsPanel';
import { mockStudentData } from '@/data/mockStudent';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  GraduationCap,
  BookOpen,
  Target,
  Calendar,
  Trophy,
  Lightbulb,
  LayoutDashboard,
  LayoutList,
} from 'lucide-react';

function App() {
  const [viewMode, setViewMode] = useState<'detailed' | 'dashboard'>('dashboard');

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-card/90 backdrop-blur-md shadow-sm shadow-black/[0.04]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-sm ring-1 ring-primary/15">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-serif text-xl font-semibold tracking-tight text-foreground">
                  XFA升学指导中心
                </h1>
                <p className="text-xs text-muted-foreground">学生管理系统（演示）</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* 视图切换按钮 */}
              <div className="flex items-center gap-1 bg-muted/80 rounded-lg p-1 ring-1 ring-border/50">
                <Button
                  variant={viewMode === 'dashboard' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('dashboard')}
                  className="flex items-center gap-2"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  仪表盘
                </Button>
                <Button
                  variant={viewMode === 'detailed' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('detailed')}
                  className="flex items-center gap-2"
                >
                  <LayoutList className="h-4 w-4" />
                  详细版
                </Button>
              </div>
              <span className="text-sm text-muted-foreground">
                当前学生: <span className="font-medium text-foreground">{mockStudentData.student.name}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                顾问: <span className="font-medium text-foreground">{mockStudentData.student.advisor}</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* 学生信息头部 */}
        <div className="mb-6">
          <StudentHeader student={mockStudentData.student} summary={`${mockStudentData.student.grade} 学生，正在准备大学申请`} />
        </div>

        {viewMode === 'dashboard' ? (
          /* 仪表盘视图 */
          <>
            {/* 关键指标概览 */}
            <div className="mb-6">
              <KeyMetricsPanel data={mockStudentData} />
            </div>

            {/* 主要内容区 - 三列布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <StudentRadarChart data={mockStudentData} />
              <GradeComparisonPanel data={mockStudentData} />
              <UniversityMatchPanel data={mockStudentData} />
            </div>

            {/* 底部区域 - 两列布局 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PriorityTasksPanel data={mockStudentData} />
              <QuickActionsPanel data={mockStudentData} />
            </div>
          </>
        ) : (
          /* 详细版视图 */
          <>
            {/* 整体进度概览 */}
            <div className="mb-6">
              <OverallProgress data={mockStudentData} />
            </div>

            {/* 标签页内容 */}
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="overview" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">成绩总览</span>
                </TabsTrigger>
                <TabsTrigger value="universities" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">目标院校</span>
                </TabsTrigger>
                <TabsTrigger value="exams" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">考试安排</span>
                </TabsTrigger>
                <TabsTrigger value="activities" className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="hidden sm:inline">课外活动</span>
                </TabsTrigger>
                <TabsTrigger value="strategy" className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  <span className="hidden sm:inline">升学策略</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GradesOverview
                    aLevelSubjects={mockStudentData.aLevelSubjects}
                    languageScores={mockStudentData.languageScores}
                    standardizedTests={mockStudentData.standardizedTests}
                  />
                  <ApplicationTimeline timeline={mockStudentData.timeline} />
                </div>
              </TabsContent>

              <TabsContent value="universities" className="space-y-6">
                <TargetUniversities universities={mockStudentData.targetUniversities} />
              </TabsContent>

              <TabsContent value="exams" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ExamScheduleSection
                    exams={mockStudentData.examSchedule}
                    retakePlans={mockStudentData.retakePlans}
                  />
                  <ApplicationTimeline timeline={mockStudentData.timeline} />
                </div>
              </TabsContent>

              <TabsContent value="activities" className="space-y-6">
                <Extracurriculars activities={mockStudentData.extracurriculars} />
              </TabsContent>

              <TabsContent value="strategy" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Recommendations recommendations={mockStudentData.recommendations} />
                  <TargetUniversities universities={mockStudentData.targetUniversities} />
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      {/* 底部信息 */}
      <footer className="border-t border-border/70 bg-card/50 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>XFA升学指导中心 · 学生管理系统 v1.0</p>
            <p>最后更新: {new Date().toLocaleDateString('zh-CN')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
