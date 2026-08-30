import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import type { StudentDashboardData } from '@/types/student';
import { ConfirmedGradeBadge } from '@/components/ConfirmedGradeBadge';
import { resolveLanguageForMatch, pickBestLanguageForType } from '@/lib/languageScores';
import {
  pickRelevantSubjects,
  parseIeltsReq,
  alevelReqToTargetPct,
  findTargetUniversityByFocusId,
} from '@/lib/universityMatchHelpers';
import { 
  Target, 
  BookOpen, 
  Languages, 
  FileText,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  ChevronRight
} from 'lucide-react';

interface CompetencyAnalysisProps {
  data: StudentDashboardData;
  /** 选中目标院校后，雷达「目标水平」与语言能力「当前」按该校要求 / 匹配成绩偏好计算 */
  focusUniversityId?: string | null;
}

type DimensionKey = string;

function getSubjectScore(s: { computedFinalScore?: number | null; computedInternalAvg?: number | null; unitGrades: { score: number; maxScore: number; examType?: string }[]; internalScore?: number; mockScore?: number; finalScore?: number }) {
  if (s.computedFinalScore != null && s.computedFinalScore > 0) return s.computedFinalScore;
  if (s.computedInternalAvg != null && s.computedInternalAvg > 0) return s.computedInternalAvg;
  if (s.finalScore) return Math.min(s.finalScore, 100);
  if (s.mockScore) return Math.min(s.mockScore, 100);
  if (s.internalScore) return Math.min(s.internalScore, 100);
  return 0;
}

function pickTopProbs(prob: Record<string, number> | null | undefined, n: number) {
  if (!prob) return [];
  const entries = Object.entries(prob)
    .filter(([k, v]) => typeof v === 'number' && v > 0 && ['A*', 'A', 'B', 'C', 'D', 'E', 'U'].includes(k))
    .sort((a, b) => (b[1] - a[1]));
  return entries.slice(0, n).map(([k, v]) => ({ grade: k, p: v }));
}

function gradeChipStyle(grade: string) {
  if (grade === 'A*') return 'bg-purple-100 text-purple-700';
  if (grade === 'A') return 'bg-green-100 text-green-700';
  if (grade === 'B') return 'bg-primary/15 text-primary';
  if (grade === 'C') return 'bg-yellow-100 text-yellow-700';
  if (grade === 'D') return 'bg-orange-100 text-orange-700';
  return 'bg-slate-100 text-slate-600';
}

export function CompetencyAnalysis({ data, focusUniversityId }: CompetencyAnalysisProps) {
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('overall');

  const focusUni = useMemo(
    () => findTargetUniversityByFocusId(data, focusUniversityId),
    [data, focusUniversityId]
  );

  const buildDimensions = () => {
    const dims: { key: string; name: string; score: number; icon: typeof BookOpen; type: 'subject' | 'language' | 'application' }[] = [];

    const eduSystem = (focusUni as any)?.eduSystem || (focusUni as any)?.edu_system || (focusUni?.country === 'US' ? 'us' : 'commonwealth');
    if (eduSystem === 'us') {
      const sat = data.standardizedTests.find((t) => t.type === 'SAT' && t.bestScore) || data.standardizedTests.find((t) => t.type === 'SAT');
      const act = data.standardizedTests.find((t) => t.type === 'ACT' && t.bestScore) || data.standardizedTests.find((t) => t.type === 'ACT');
      const satPct = sat ? Math.min(100, Math.round((sat.score / 1600) * 100)) : 0;
      const actPct = act ? Math.min(100, Math.round((act.score / 36) * 100)) : 0;
      const academicScores = data.aLevelSubjects.map((s) => getSubjectScore(s)).filter((x) => x > 0);
      const academicAvg =
        academicScores.length > 0
          ? Math.round(academicScores.reduce((a, b) => a + b, 0) / academicScores.length)
          : 0;
      dims.push({ key: 'academic_alevel', name: '学术成绩', score: academicAvg, icon: BookOpen, type: 'subject' });
      dims.push({ key: 'sat_act', name: 'SAT/ACT', score: Math.max(satPct, actPct), icon: BookOpen, type: 'subject' });
      dims.push({ key: 'activities', name: '活动经历', score: Math.min(100, Math.round(((data.extracurriculars?.length || 0) / 5) * 100)), icon: BookOpen, type: 'subject' });
      dims.push({ key: 'essays', name: '文书准备', score: Math.min(100, Math.round(((data.timeline?.length || 0) / 6) * 100)), icon: BookOpen, type: 'subject' });
      dims.push({ key: 'recs', name: '推荐信', score: 0, icon: BookOpen, type: 'subject' });
    } else {
      data.aLevelSubjects.forEach(subject => {
        const score = Math.round(getSubjectScore(subject));
        dims.push({
          key: `subject_${subject.name}`,
          name: subject.name,
          score,
          icon: BookOpen,
          type: 'subject',
        });
      });
    }

    const langRow = focusUni
      ? resolveLanguageForMatch(data.languageScores, 'IELTS', focusUni.matchingPrefs ?? null)
      : pickBestLanguageForType(data.languageScores, 'IELTS') || data.languageScores.find((s) => s.type === 'IELTS');
    const bestLanguage = langRow || data.languageScores[0];
    const languageScore = bestLanguage ? Math.round((bestLanguage.overall / 9) * 100) : 0;
    dims.push({
      key: 'language',
      name: '语言能力',
      score: languageScore,
      icon: Languages,
      type: 'language',
    });

    const totalUni = data.targetUniversities?.length || 0;
    let applicationScore = 0;
    if (totalUni > 0) {
      const submitted = data.targetUniversities.filter(
        u => u.applicationStatus === 'submitted' || u.applicationStatus === 'offer'
      ).length;
      applicationScore = Math.round((submitted / totalUni) * 100);
    }
    dims.push({
      key: 'application',
      name: '申请进度',
      score: applicationScore,
      icon: FileText,
      type: 'application',
    });

    return dims;
  };

  const dimensions = buildDimensions();

  const radarData = dimensions.map((d) => {
    let target = d.type === 'application' ? 100 : d.type === 'language' ? 85 : 90;
    if (focusUni) {
      if (d.type === 'language') {
        const eduSystem = (focusUni as any)?.eduSystem || (focusUni as any)?.edu_system || (focusUni.country === 'US' ? 'us' : 'commonwealth');
        const us = (focusUni.requirements as any)?.requirementsStruct?.us;
        if (eduSystem === 'us' && us?.toefl_min) {
          target = Math.min(100, Math.round((Number(us.toefl_min) / 120) * 100));
        } else {
          target = Math.min(100, Math.round((parseIeltsReq(focusUni.requirements.language) / 9) * 100));
        }
      } else if (d.type === 'subject') {
        const subject = data.aLevelSubjects.find((s) => `subject_${s.name}` === d.key);
        const relevant = subject && pickRelevantSubjects(data, focusUni).some((x) => x.name === subject.name);
        const eduSystem = (focusUni as any)?.eduSystem || (focusUni as any)?.edu_system || (focusUni.country === 'US' ? 'us' : 'commonwealth');
        if (eduSystem === 'us') {
          const us = (focusUni.requirements as any)?.requirementsStruct?.us;
          if (d.key === 'sat_act') {
            const satMin = us?.sat_range ? parseInt(String(us.sat_range).match(/\\d{3,4}/)?.[0] || '1400', 10) : 1400;
            target = Math.min(100, Math.round((satMin / 1600) * 100));
          } else if (d.key === 'academic_alevel') {
            target = alevelReqToTargetPct(focusUni.requirements.aLevel || '');
          } else {
            target = 85;
          }
        } else {
          target = relevant ? alevelReqToTargetPct(focusUni.requirements.aLevel) : 90;
        }
      }
    }
    return {
      subject: d.name,
      current: d.score,
      target,
    };
  });

  const subjectDims = dimensions.filter(d => d.type === 'subject');
  const avgSubjectScore = subjectDims.length > 0
    ? Math.round(subjectDims.reduce((a, b) => a + b.score, 0) / subjectDims.length)
    : 0;

  const languageDim = dimensions.find(d => d.type === 'language')!;
  const applicationDim = dimensions.find(d => d.type === 'application')!;

  const overallScore = Math.round(
    avgSubjectScore * 0.5 + languageDim.score * 0.3 + applicationDim.score * 0.2
  );

  const weakest = dimensions.reduce((a, b) => a.score < b.score ? a : b);
  const strongest = dimensions.reduce((a, b) => a.score > b.score ? a : b);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getDimensionDetail = (key: string) => {
    const dim = dimensions.find(d => d.key === key);
    if (!dim) return { title: 'A-Level 总览', content: <ALevelOverview data={data} /> };

    if (key === 'language') return { title: '语言成绩详情', content: <LanguageDetail data={data} /> };
    if (key === 'application') return { title: '申请进度详情', content: <ApplicationDetail data={data} /> };
    if (key === 'academic_alevel') return { title: '学术成绩（A-Level）', content: <ALevelOverview data={data} /> };

    const subject = data.aLevelSubjects.find(s => `subject_${s.name}` === key);
    if (subject) return { title: `${subject.name} 详情`, content: <SubjectDetail subject={subject} /> };

    return { title: 'A-Level 总览', content: <ALevelOverview data={data} /> };
  };

  const activeDetail = activeDimension === 'overall'
    ? { title: 'A-Level 总览', content: <ALevelOverview data={data} /> }
    : getDimensionDetail(activeDimension);

  return (
    <div className="space-y-4">
      {/* 雷达图 */}
      <Card className="border border-slate-200 shadow-sm">
        <CardContent className="px-4 py-3">
          {focusUni && (
            <p className="text-xs text-slate-600 mb-3 pb-2 border-b border-slate-100">
              雷达「目标水平」参照院校：<span className="font-semibold text-primary">{focusUni.name}</span>
              {focusUni.course ? <span className="text-slate-500"> · {focusUni.course}</span> : null}
            </p>
          )}
          <div className="flex items-center gap-4">
            {/* 左侧：综合分数和图例 */}
            <div className="flex flex-col items-center gap-4 py-4">
              <Badge variant="outline" className="text-sm px-3 py-1">
                综合 {overallScore} 分
              </Badge>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-primary"></div>
                  <span className="text-xs text-slate-600">当前水平</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-green-500 border-dashed"></div>
                  <span className="text-xs text-slate-600">目标水平</span>
                </div>
              </div>
            </div>
            {/* 右侧：雷达图 */}
            <div className="flex-1 h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="85%" data={radarData}>
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                  <Radar
                    name="当前水平"
                    dataKey="current"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Radar
                    name="目标水平"
                    dataKey="target"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.05}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 维度得分 */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setActiveDimension('overall')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            activeDimension === 'overall'
              ? 'border-primary bg-primary/10 ring-1 ring-primary'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <Target className={`h-3.5 w-3.5 ${activeDimension === 'overall' ? 'text-primary' : 'text-slate-500'}`} />
            <span className={`text-[11px] font-medium ${activeDimension === 'overall' ? 'text-primary' : 'text-slate-600'}`}>
              总览
            </span>
          </div>
          <span className={`text-base font-bold ${getScoreColor(overallScore)}`}>{overallScore}</span>
        </button>
        {dimensions.map(dim => {
          const Icon = dim.icon;
          const isActive = activeDimension === dim.key;
          const isWeakest = dim.key === weakest.key;
          const subject = dim.type === 'subject' && dim.key !== 'academic_alevel' ? data.aLevelSubjects.find(s => `subject_${s.name}` === dim.key) : null;
          const finalLikeCount = subject ? subject.unitGrades.filter(u => u.examType === 'final' || u.examType === 'retake').length : 0;
          const hasPrediction = !!subject?.predictedProbabilities;
          const top = subject ? pickTopProbs(subject.predictedProbabilities || null, 2) : [];
          const conf = subject?.predictedConfidence ?? null;
          return (
            <button
              key={dim.key}
              onClick={() => setActiveDimension(dim.key)}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                isActive
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
                <span className={`text-[11px] font-medium truncate ${isActive ? 'text-primary' : 'text-slate-600'}`}>
                  {dim.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-base font-bold ${getScoreColor(dim.score)}`}>{dim.score}</span>
                <div className="flex items-center gap-1">
                  {isWeakest && (
                    <span className="text-[9px] text-red-600 bg-red-50 px-1 py-0.5 rounded">弱</span>
                  )}
                </div>
              </div>
              {dim.key === 'academic_alevel' && (
                <div className="mt-1 text-[10px] text-slate-500">
                  {data.aLevelSubjects.length > 0 ? `${data.aLevelSubjects.length} 门课程均分` : '暂无选课'}
                </div>
              )}
              {subject && (
                <div className="mt-1">
                  {hasPrediction ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {top.map((t) => (
                          <span key={t.grade} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${gradeChipStyle(t.grade)}`}>
                            {t.grade} {Math.round(t.p * 100)}%
                          </span>
                        ))}
                        {subject.predictionFinalized ? (
                          <ConfirmedGradeBadge />
                        ) : finalLikeCount > 0 ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">
                            推算
                          </span>
                        ) : null}
                      </div>
                      {conf != null && (
                        <span className="text-[10px] text-slate-500 tabular-nums">
                          置信 {Math.round(conf * 100)}%
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        校内参考
                      </span>
                      <span className="text-[10px] text-slate-400">
                        无实考
                      </span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 洞察 */}
      <div className="bg-primary/10 border border-primary/15 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-xs text-primary">
            <span className="font-semibold">{weakest.name}</span> 相对较弱({weakest.score}分)，建议优先提升。
            <span className="font-semibold">{strongest.name}</span> 表现最佳({strongest.score}分)。
          </p>
        </div>
      </div>

      {/* 详情面板 */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2 pt-3 px-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900">
              {activeDetail.title}
            </CardTitle>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {activeDetail.content}
        </CardContent>
      </Card>
    </div>
  );
}

function ALevelOverview({ data }: { data: StudentDashboardData }) {
  if (data.aLevelSubjects.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <BookOpen className="h-10 w-10 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">暂无选课数据</p>
      </div>
    );
  }
  return (
    <div className="p-3 space-y-2">
      {data.aLevelSubjects.map((subject, idx) => {
        const internalAvg = subject.computedInternalAvg;
        const finalScore = subject.computedFinalScore;
        const deviation = (finalScore != null && internalAvg != null) ? finalScore - internalAvg : null;
        return (
          <div key={idx} className="p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900">{subject.name}</span>
                <Badge variant="secondary" className="text-[10px]">{subject.board}</Badge>
                {subject.needsRetake && <Badge variant="destructive" className="text-[10px]">需补考</Badge>}
              </div>
              {deviation !== null && (
                <div className={`flex items-center gap-1 text-xs font-medium ${deviation >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {deviation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  偏差 {deviation >= 0 ? '+' : ''}{deviation}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">校内:</span>
                <span className={`font-semibold ${internalAvg != null ? (internalAvg >= 80 ? 'text-green-600' : internalAvg >= 60 ? 'text-primary' : 'text-orange-600') : 'text-slate-400'}`}>
                  {internalAvg != null ? internalAvg : '--'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">实考:</span>
                <span className={`font-semibold ${finalScore != null ? (finalScore >= 80 ? 'text-green-600' : finalScore >= 60 ? 'text-primary' : 'text-orange-600') : 'text-slate-400'}`}>
                  {finalScore != null ? finalScore : '--'}
                </span>
              </div>
              <span className="text-slate-400">
                {subject.finishedFinalUnits || 0}单元已考
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SubjectDetail({ subject }: { subject: StudentDashboardData['aLevelSubjects'][0] }) {
  const internalAvg = subject.computedInternalAvg;
  const finalScore = subject.computedFinalScore;
  const deviation = (finalScore != null && internalAvg != null) ? finalScore - internalAvg : null;

  const gradeMap: Record<string, number> = { 'A*': 95, A: 85, B: 75, C: 65, D: 55 };
  const targetScore = gradeMap[subject.predictedGrade || 'A'] || 85;
  const bestScore = finalScore ?? internalAvg ?? 0;
  const gap = bestScore - targetScore;

  const finalUnits = subject.unitGrades.filter(u => u.examType === 'final');
  const retakeUnits = subject.unitGrades.filter(u => u.examType === 'retake');
  const internalUnits = subject.unitGrades
    .filter(u => u.examType === 'internal')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const mockUnits = subject.unitGrades
    .filter(u => u.examType === 'mock')
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{subject.name}</span>
          <Badge variant="secondary" className="text-xs">{subject.board}</Badge>
          {subject.predictionFinalized && <ConfirmedGradeBadge />}
          {subject.computedAlevelGrade && (
            <Badge className={subject.computedAlevelGrade === 'A*' ? 'bg-purple-100 text-purple-700 border-0 text-xs' : 'bg-green-100 text-green-700 border-0 text-xs'}>
              当前 {subject.computedAlevelGrade}
            </Badge>
          )}
        </div>
        {deviation !== null && (
          <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${deviation >= 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
            {deviation >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            偏差 {deviation >= 0 ? '+' : ''}{deviation}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-primary/10 rounded-lg p-2.5 border border-primary/15">
          <p className="text-[10px] text-primary font-medium">校内成绩 (近{internalUnits.length > 2 ? 2 : internalUnits.length}次均分)</p>
          <p className={`text-xl font-bold ${internalAvg != null ? (internalAvg >= 80 ? 'text-green-600' : internalAvg >= 60 ? 'text-primary' : 'text-orange-600') : 'text-slate-400'}`}>
            {internalAvg != null ? internalAvg : '--'}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
          <p className="text-[10px] text-slate-600 font-medium">模考成绩</p>
          <p className={`text-xl font-bold ${subject.mockScore ? (subject.mockScore >= 80 ? 'text-green-600' : subject.mockScore >= 60 ? 'text-primary' : 'text-orange-600') : 'text-slate-400'}`}>
            {subject.mockScore ? Math.round(subject.mockScore) : '--'}
          </p>
        </div>
        <div className="bg-green-50 rounded-lg p-2.5 border border-green-100">
          <p className="text-[10px] text-green-600 font-medium">实考成绩 (加权合成)</p>
          <p className={`text-xl font-bold ${finalScore != null ? (finalScore >= 80 ? 'text-green-600' : finalScore >= 60 ? 'text-primary' : 'text-orange-600') : 'text-slate-400'}`}>
            {finalScore != null ? finalScore : '--'}
          </p>
          {typeof subject.computedAdvancedPct === 'number' && (
            <p className="text-[10px] text-slate-600 mt-0.5">
              高阶 {subject.computedAdvancedPct}%
            </p>
          )}
        </div>
      </div>

      {finalUnits.length > 0 && (
        <div>
          <p className="text-xs font-medium text-green-700 mb-1.5">实考单元</p>
          <div className="grid grid-cols-4 gap-1.5">
            {finalUnits.map((unit, uidx) => (
              <div
                key={uidx}
                className={`text-center py-1.5 rounded text-xs ${
                  unit.grade === 'A*' ? 'bg-purple-100 text-purple-700' :
                  unit.grade === 'A' ? 'bg-green-100 text-green-700' :
                  unit.grade === 'B' ? 'bg-primary/15 text-primary' :
                  unit.grade === 'C' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-slate-100 text-slate-600'
                }`}
              >
                <div className="font-semibold">{unit.score}/{unit.maxScore}</div>
                <div className="text-[10px] opacity-75">{unit.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {retakeUnits.length > 0 && (
        <div>
          <p className="text-xs font-medium text-orange-700 mb-1.5">重考记录</p>
          <div className="grid grid-cols-4 gap-1.5">
            {retakeUnits.slice(0, 4).map((unit, uidx) => (
              <div key={uidx} className="text-center py-1.5 rounded text-xs bg-orange-50 text-orange-700">
                <div className="font-semibold">{unit.score}/{unit.maxScore}</div>
                <div className="text-[10px] opacity-75">{unit.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {internalUnits.length > 0 && (
        <div>
          <p className="text-xs font-medium text-primary mb-1.5">校内考试</p>
          <div className="grid grid-cols-4 gap-1.5">
            {internalUnits.slice(0, 4).map((unit, uidx) => (
              <div key={uidx} className="text-center py-1.5 rounded text-xs bg-primary/10 text-primary">
                <div className="font-semibold">{unit.score}/{unit.maxScore}</div>
                <div className="text-[10px] opacity-75">{unit.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mockUnits.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-700 mb-1.5">模考</p>
          <div className="grid grid-cols-4 gap-1.5">
            {mockUnits.slice(0, 4).map((unit, uidx) => (
              <div key={uidx} className="text-center py-1.5 rounded text-xs bg-slate-50 text-slate-700 border border-slate-100">
                <div className="font-semibold">{unit.score}/{unit.maxScore}</div>
                <div className="text-[10px] opacity-75">{unit.unit}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {finalUnits.length === 0 && internalUnits.length === 0 && (
        <div className="text-center py-3 text-xs text-slate-400 bg-slate-50 rounded-lg">
          暂无单元成绩记录
        </div>
      )}

      <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-2">
        <div className="flex items-center gap-3">
          <span className="text-slate-500">当前: <span className="font-medium text-slate-900">{bestScore > 0 ? bestScore : '--'}</span></span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-500">目标: <span className="font-medium text-slate-900">{targetScore}</span></span>
        </div>
        {bestScore > 0 && (
          <div className={`flex items-center gap-1 text-xs ${gap >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {gap >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {gap >= 0 ? `+${gap}` : gap}分
          </div>
        )}
      </div>
    </div>
  );
}

function LanguageDetail({ data }: { data: StudentDashboardData }) {
  const bestLanguage = data.languageScores.find(l => l.bestScore) || data.languageScores[0];

  if (!bestLanguage) {
    return (
      <div className="p-6 text-center text-slate-500">
        <Languages className="h-10 w-10 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">暂无语言成绩</p>
        <p className="text-xs mt-1 text-slate-400">建议尽快报名雅思/托福考试</p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="bg-gradient-to-r from-primary/10 to-accent rounded-lg p-3 mb-3 border border-primary/15">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-600">最佳成绩</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-primary">{bestLanguage.overall}</span>
              <span className="text-sm text-slate-500">{bestLanguage.type}</span>
            </div>
          </div>
          <div className="text-right">
            <Badge className="bg-green-100 text-green-700 border-0 text-xs">
              <CheckCircle className="h-3 w-3 mr-1" />有效
            </Badge>
            <p className="text-[10px] text-slate-500 mt-1">
              {bestLanguage.overall >= 7 ? '已满足多数院校要求' : '建议冲刺 7.0+'}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: '听力', value: bestLanguage.listening },
          { label: '阅读', value: bestLanguage.reading },
          { label: '写作', value: bestLanguage.writing },
          { label: '口语', value: bestLanguage.speaking },
        ].filter(x => x.value != null).map((item, i) => (
          <div key={i} className="text-center p-2 bg-slate-50 rounded-lg">
            <p className="text-[10px] text-slate-500">{item.label}</p>
            <p className="text-lg font-bold text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>
      {data.languageScores.length > 1 && (
        <div>
          <p className="text-xs font-medium text-slate-600 mb-1.5">考试历史</p>
          <div className="space-y-1.5">
            {data.languageScores.map((score, idx) => (
              <div key={idx} className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                score.bestScore ? 'bg-green-50 border border-green-100' : 'bg-slate-50'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{score.overall}</span>
                  <span className="text-xs text-slate-500">{score.type}</span>
                  {score.bestScore && <Badge className="bg-green-100 text-green-700 text-[10px]">最佳</Badge>}
                </div>
                <span className="text-xs text-slate-400">{score.testDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationDetail({ data }: { data: StudentDashboardData }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'offer': return <Badge className="bg-green-100 text-green-700 border-0 text-[10px]">已录取</Badge>;
      case 'submitted': return <Badge className="bg-primary/15 text-primary border-0 text-[10px]">已提交</Badge>;
      case 'preparing': return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-[10px]">准备中</Badge>;
      default: return <Badge variant="outline" className="text-slate-500 text-[10px]">未开始</Badge>;
    }
  };

  if (data.targetUniversities.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <FileText className="h-10 w-10 mx-auto mb-2 text-slate-300" />
        <p className="text-sm">暂无目标院校</p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {data.targetUniversities.map((uni, idx) => (
        <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="text-base">
              {uni.country === 'UK' ? '🇬🇧' : uni.country === 'US' ? '🇺🇸' : uni.country === 'Canada' ? '🇨🇦' : uni.country === 'Australia' ? '🇦🇺' : '🌍'}
            </span>
            <div>
              <p className="text-sm font-medium text-slate-900">{uni.name}</p>
              <p className="text-[10px] text-slate-500">{uni.course} · 排名 {uni.ranking}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              uni.status === 'reach' ? 'text-purple-600 bg-purple-50' :
              uni.status === 'target' ? 'text-primary bg-primary/10' :
              'text-green-600 bg-green-50'
            }`}>
              {uni.status === 'reach' ? '冲刺' : uni.status === 'target' ? '目标' : '保底'}
            </span>
            {getStatusBadge(uni.applicationStatus)}
          </div>
        </div>
      ))}
    </div>
  );
}
