import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StudentDashboard } from '@/services/api';
import { transformDashboardData } from '@/Dashboard';
import {
  analyzeUsUniversityRequirementsDetail,
  type UsProgramExtras,
  type UsReqCheckRow,
} from '@/lib/universityMatchHelpers';
import { Flag, School } from 'lucide-react';

function isUsTarget(raw: StudentDashboard['targetUniversities'][number]): boolean {
  const edu = (raw as { edu_system?: string | null }).edu_system;
  const c = String((raw as { country?: string }).country || '');
  return edu === 'us' || c === 'US' || c === '美国';
}

function programExtrasFrom(raw: StudentDashboard['targetUniversities'][number]): UsProgramExtras | null {
  const p = (raw as { program?: Record<string, unknown> | null }).program;
  if (!p) return null;
  return {
    subject_requirements_struct: p.subject_requirements_struct as UsProgramExtras['subject_requirements_struct'],
    alevel_required_grades: (p.alevel_required_grades as string[] | null) ?? null,
    a_level_requirement: (p.a_level_requirement as string | null) ?? null,
  };
}

function rowBadge(row: UsReqCheckRow) {
  switch (row.status) {
    case 'pass':
      return <Badge className="bg-green-100 text-green-800 border-0 text-[10px]">满足</Badge>;
    case 'fail':
      return <Badge variant="destructive" className="text-[10px]">未满足</Badge>;
    case 'warn':
      return <Badge className="bg-amber-100 text-amber-900 border-0 text-[10px]">待加强</Badge>;
    default:
      return <Badge variant="secondary" className="text-[10px]">参考</Badge>;
  }
}

export function UsRequirementsPanel({ dashboardData }: { dashboardData: StudentDashboard }) {
  const studentData = useMemo(() => transformDashboardData(dashboardData), [dashboardData]);

  const pairs = useMemo(() => {
    const out: {
      key: string;
      name: string;
      course: string;
      statusLabel: string;
      typeLabel: string;
      transformed: (typeof studentData.targetUniversities)[0];
      extras: UsProgramExtras | null;
    }[] = [];

    for (const raw of dashboardData.targetUniversities) {
      if (!isUsTarget(raw)) continue;
      const suId = (raw as { student_university_id?: string }).student_university_id;
      if (!suId) continue;
      const transformed = studentData.targetUniversities.find((tu) => tu.studentUniversityId === suId);
      if (!transformed) continue;

      const applicationType = (raw as { application_type?: string }).application_type;
      const status = (raw as { status?: string }).status;
      const typeLabel =
        applicationType === 'reach' ? '冲刺' : applicationType === 'safety' ? '保底' : '目标';
      const statusMap: Record<string, string> = {
        interested: '感兴趣',
        applying: '申请中',
        submitted: '已提交',
        offer: '已录取',
        rejected: '被拒',
        declined: '放弃',
      };
      const statusLabel = status ? statusMap[status] || status : '';

      out.push({
        key: suId,
        name: raw.name || transformed.name,
        course: String((raw as { program_name?: string }).program_name || raw.course_name || transformed.course || ''),
        statusLabel,
        typeLabel,
        transformed,
        extras: programExtrasFrom(raw),
      });
    }
    return out;
  }, [dashboardData, studentData]);

  if (pairs.length === 0) {
    return (
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flag className="h-4 w-4 text-primary" />
            美本需求
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground py-10 text-center space-y-2">
          <p>暂无美本目标院校。</p>
          <p className="text-xs">
            请在「目标院校」中添加<strong>美国本科</strong>（院校库中教育体制为「美本」或国家为美国），保存后即可在此查看逐项对照。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        以下为当前学生在「目标院校」中的<strong>美本</strong>志愿，按院校库中的<strong>美本学院要求</strong>做逐项对照。
        语言、标化、A-Level 学术分的取数规则与仪表盘「目标院校匹配度」相同，避免两处结论不一致。
      </p>

      {pairs.map((p) => {
        const { rows, matchScore, hardGate } = analyzeUsUniversityRequirementsDetail(
          studentData,
          p.transformed,
          p.extras
        );
        const scoreColor =
          matchScore >= 80 ? 'text-green-600' : matchScore >= 60 ? 'text-primary' : 'text-orange-600';

        return (
          <Card key={p.key} className="border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-2 border-b border-slate-100 bg-slate-50/80">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-lg flex-shrink-0" aria-hidden>
                    🇺🇸
                  </span>
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold text-slate-900 truncate flex items-center gap-2">
                      <School className="h-4 w-4 text-primary flex-shrink-0" />
                      {p.name}
                    </CardTitle>
                    {p.course ? (
                      <p className="text-xs text-slate-600 mt-0.5 truncate">{p.course}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant="outline" className="text-[10px]">
                        {p.typeLabel}
                      </Badge>
                      {p.statusLabel ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {p.statusLabel}
                        </Badge>
                      ) : null}
                      {!hardGate.ok ? (
                        <Badge variant="destructive" className="text-[10px]">
                          硬门槛未过
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 border-0 text-[10px]">硬门槛通过</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 flex-shrink-0">
                  <span className="text-xs text-slate-500">综合匹配</span>
                  <span className={`text-2xl font-bold tabular-nums ${scoreColor}`}>{matchScore}</span>
                  <span className="text-sm text-slate-500">%</span>
                </div>
              </div>
              {!hardGate.ok && hardGate.reasons.length > 0 && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-md px-2 py-1.5 mt-2">
                  {hardGate.reasons.join('；')}
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-white text-left text-xs text-slate-500">
                      <th className="py-2.5 px-3 font-medium w-[22%]">项目</th>
                      <th className="py-2.5 px-3 font-medium w-[28%]">院校要求</th>
                      <th className="py-2.5 px-3 font-medium w-[28%]">学生当前</th>
                      <th className="py-2.5 px-3 font-medium w-[14%]">结论</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.key} className="border-b border-slate-50 last:border-0 align-top">
                        <td className="py-2.5 px-3 text-slate-900 font-medium">{row.label}</td>
                        <td className="py-2.5 px-3 text-slate-600 text-xs">{row.requirement}</td>
                        <td className="py-2.5 px-3 text-slate-800 text-xs">{row.current}</td>
                        <td className="py-2.5 px-3">{rowBadge(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.some((r) => r.note) && (
                <div className="px-3 py-2 bg-slate-50/90 border-t border-slate-100 space-y-1">
                  {rows
                    .filter((r) => r.note)
                    .map((r) => (
                      <p key={`n-${r.key}`} className="text-[10px] text-slate-500 leading-snug">
                        <span className="font-medium text-slate-600">{r.label}：</span>
                        {r.note}
                      </p>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
