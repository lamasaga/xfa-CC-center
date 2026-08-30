import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ALevelSubject, LanguageScore, StandardizedTest } from '@/types/student';
import { ConfirmedGradeBadge } from '@/components/ConfirmedGradeBadge';
import { BookOpen, Award, AlertCircle, CheckCircle } from 'lucide-react';

interface GradesOverviewProps {
  aLevelSubjects: ALevelSubject[];
  languageScores: LanguageScore[];
  standardizedTests: StandardizedTest[];
}

export function GradesOverview({ aLevelSubjects, languageScores, standardizedTests }: GradesOverviewProps) {
  // 计算A-Level整体进度
  const totalUnits = aLevelSubjects.reduce((acc, subj) => acc + (subj.totalConfiguredUnits || subj.unitGrades.length), 0);
  const completedUnits = aLevelSubjects.reduce(
    // 重考不应把同一单元重复计数；组合型数学课程以六个有效单元为完成口径。
    (acc, subj) => acc + (subj.finishedFinalUnits ?? subj.unitGrades.filter((u) => u.grade).length),
    0
  );
  const progressPercentage = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

  // 获取最佳语言成绩
  const bestLanguage = languageScores.find((l) => l.bestScore) || languageScores[0];

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            成绩总览
          </CardTitle>
          <Badge variant="outline" className="text-primary">
            整体进度 {progressPercentage}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="alevel" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="alevel">A-Level</TabsTrigger>
            <TabsTrigger value="language">语言成绩</TabsTrigger>
            <TabsTrigger value="standardized">标化考试</TabsTrigger>
          </TabsList>

          <TabsContent value="alevel" className="space-y-4">
            <div className="space-y-3">
              {aLevelSubjects.map((subject, idx) => (
                <div key={idx} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{subject.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {subject.board}
                      </Badge>
                    {subject.predictionFinalized && <ConfirmedGradeBadge />}
                    {subject.computedAlevelGrade && (
                      <Badge className={subject.computedAlevelGrade === 'A*' ? 'bg-purple-100 text-purple-700 border-0' : 'bg-green-100 text-green-700 border-0'}>
                        当前: {subject.computedAlevelGrade}
                      </Badge>
                    )}
                    {typeof subject.computedFinalScore === 'number' && subject.computedFinalScore > 0 && (
                      <Badge variant="outline" className="text-xs text-slate-600">
                        总分 {subject.computedFinalScore}%
                        {typeof subject.computedAdvancedPct === 'number' ? ` · 高阶 ${subject.computedAdvancedPct}%` : ''}
                      </Badge>
                    )}
                      {subject.needsRetake && (
                        <Badge variant="destructive" className="text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          需补考
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {subject.asGrade && (
                        <span className="text-sm text-gray-500">AS: {subject.asGrade}</span>
                      )}
                      {subject.predictedGrade && (
                        <Badge className="bg-primary/15 text-primary border-0">
                          预估: {subject.predictedGrade}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-1 mt-2">
                    {subject.unitGrades.map((unit, uidx) => (
                      <div
                        key={uidx}
                        className={`text-center py-1 px-1 rounded text-xs ${
                          unit.grade === 'A*'
                            ? 'bg-purple-100 text-purple-700'
                            : unit.grade === 'A'
                            ? 'bg-green-100 text-green-700'
                            : unit.grade === 'B'
                            ? 'bg-primary/15 text-primary'
                            : unit.grade === 'C'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        title={`${unit.unit}: ${unit.score}/${unit.maxScore}`}
                      >
                        <div className="font-medium">{unit.grade}</div>
                        <div className="text-[10px] opacity-75">{unit.unit}</div>
                      </div>
                    ))}
                  </div>
                  {subject.retakeUnits.length > 0 && (
                    <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      补考单元: {subject.retakeUnits.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="language" className="space-y-4">
            {bestLanguage ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-accent rounded-lg border border-primary/15">
                  <div>
                    <p className="text-sm text-gray-500">最佳成绩</p>
                    <p className="text-3xl font-bold text-primary">{bestLanguage.overall}</p>
                    <p className="text-sm text-gray-600">{bestLanguage.type}</p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-100 text-green-700 border-0">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      有效
                    </Badge>
                    <p className="text-xs text-gray-500 mt-1">
                      有效期至: {bestLanguage.validUntil}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {bestLanguage.listening && (
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">听力</p>
                      <p className="font-semibold">{bestLanguage.listening}</p>
                    </div>
                  )}
                  {bestLanguage.reading && (
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">阅读</p>
                      <p className="font-semibold">{bestLanguage.reading}</p>
                    </div>
                  )}
                  {bestLanguage.writing && (
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">写作</p>
                      <p className="font-semibold">{bestLanguage.writing}</p>
                    </div>
                  )}
                  {bestLanguage.speaking && (
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">口语</p>
                      <p className="font-semibold">{bestLanguage.speaking}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">历史成绩</p>
                  {languageScores.map((score, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded ${
                        score.bestScore ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{score.overall}</span>
                        <span className="text-sm text-gray-500">{score.type}</span>
                        {score.bestScore && (
                          <Badge className="bg-green-100 text-green-700 text-xs">最佳</Badge>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{score.testDate}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>暂无语言成绩</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="standardized" className="space-y-4">
            {standardizedTests.length > 0 ? (
              <div className="space-y-3">
                {standardizedTests.map((test, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      test.bestScore
                        ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">{test.type}</span>
                        {test.bestScore && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">最佳</Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-purple-600">{test.score}</span>
                        <p className="text-xs text-gray-500">{test.testDate}</p>
                      </div>
                    </div>
                    {test.sectionScores && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {test.sectionScores.map((section, sidx) => (
                          <div key={sidx} className="text-center p-2 bg-white rounded">
                            <p className="text-xs text-gray-500">{section.name}</p>
                            <p className="font-semibold">{section.score}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>暂无标化考试成绩</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
