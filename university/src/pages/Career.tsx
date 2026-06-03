import { useState, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';
import { TrendingUp, GraduationCap, Building2, Award, ArrowUpRight, Star, Briefcase } from 'lucide-react';

/* ── types ── */
interface SalaryEntry {
  key: string;
  school: string;
  country: string;
  region: string;
  early_career_salary: number;
  mid_career_salary: number;
  currency: string;
  by_major?: Record<string, number>;
}

interface EmploymentEntry {
  key: string;
  school: string;
  employment_rate: number;
  top_industries: string[];
  top_employers: string[];
  grad_school_rate: number;
  source: string;
}

interface MajorSalary {
  major: string;
  avg_starting_salary: number;
  projected_2025: number;
  currency: string;
}

/* ── region colors ── */
const REGION_COLORS: Record<string, string> = {
  美国: '#3B6EA5',
  英国: '#8B2332',
  加拿大: '#C2553A',
  澳大利亚: '#4A7C6F',
  欧洲: '#6B4C8A',
  亚洲: '#D4943A',
};

function getRegionColor(country: string): string {
  if (country === '美国') return REGION_COLORS.美国;
  if (country === '英国') return REGION_COLORS.英国;
  return REGION_COLORS.欧洲;
}

/* ── animations ── */
const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

/* ── salary tooltip ── */
function SalaryTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; payload: SalaryEntry }> }) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#F0EBE3', border: '1px solid #E8E2D9' }}>
      <div className="font-medium mb-1" style={{ color: '#2C2420' }}>{data.school}</div>
      <div style={{ color: '#6B6560' }}>地区: <span style={{ color: '#2C2420' }}>{data.country}</span></div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: '#6B6560' }}>
          {p.dataKey === 'early_career_salary' ? '毕业起薪' : '中期薪资'}:
          <span style={{ color: '#C8A45C' }}> {data.currency} {p.value.toLocaleString()}</span>
        </div>
      ))}
      <div style={{ color: '#4A7C6F' }}>增幅: {((data.mid_career_salary / data.early_career_salary - 1) * 100).toFixed(0)}%</div>
    </div>
  );
}

/* ── sort helper ── */
type SortKey = 'school' | 'early_career_salary' | 'mid_career_salary' | 'growth' | 'employment_rate' | 'grad_school_rate';
type SortDir = 'asc' | 'desc';

export default function Career() {
  const { thirdParty, loading } = useData();
  const [salaryToggle, setSalaryToggle] = useState<'starting' | 'mid'>('mid');
  const [sortKey, setSortKey] = useState<SortKey>('mid_career_salary');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  /* ── parse salary data ── */
  const salaries: SalaryEntry[] = useMemo(() => {
    if (!thirdParty?.salaries) return [];
    const raw = thirdParty.salaries as Record<string, Record<string, unknown>>;
    return Object.entries(raw).map(([key, val]) => ({
      key,
      school: val.school as string,
      country: val.country as string,
      region: val.country === '美国' ? '美国' : val.country === '英国' ? '英国' : '欧洲',
      early_career_salary: (val.early_career_salary as number) ?? 0,
      mid_career_salary: (val.mid_career_salary as number) ?? 0,
      currency: (val.currency as string) ?? 'USD',
      by_major: val.by_major as Record<string, number> | undefined,
    }));
  }, [thirdParty]);

  /* ── parse employment data ── */
  const employment: EmploymentEntry[] = useMemo(() => {
    if (!thirdParty?.employment) return [];
    const raw = thirdParty.employment as Record<string, Record<string, unknown>>;
    return Object.entries(raw).map(([key, val]) => ({
      key,
      school: val.school as string,
      employment_rate: (val.employment_rate as number) ?? 0,
      top_industries: (val.top_industries as string[]) ?? [],
      top_employers: (val.top_employers as string[]) ?? [],
      grad_school_rate: (val.grad_school_rate as number) ?? 0,
      source: val.source as string,
    }));
  }, [thirdParty]);

  /* ── parse major salary data ── */
  const majorSalaries: MajorSalary[] = useMemo(() => {
    if (!thirdParty?.salary_by_major) return [];
    const raw = thirdParty.salary_by_major as Record<string, unknown>;
    const usData = raw.us_2024_2025 as Record<string, unknown> | undefined;
    if (!usData) return [];
    return Object.entries(usData)
      .filter(([k]) => k !== 'description')
      .map(([, v]) => v as MajorSalary)
      .sort((a, b) => b.avg_starting_salary - a.avg_starting_salary);
  }, [thirdParty]);

  /* ── merged data for table ── */
  const mergedData = useMemo(() => {
    return salaries.map(s => {
      const emp = employment.find(e => e.key === s.key);
      return {
        ...s,
        employment_rate: emp?.employment_rate ?? 0,
        top_industries: emp?.top_industries ?? [],
        top_employers: emp?.top_employers ?? [],
        grad_school_rate: emp?.grad_school_rate ?? 0,
        growth: s.early_career_salary > 0 ? s.mid_career_salary / s.early_career_salary : 0,
      };
    });
  }, [salaries, employment]);

  /* ── sorted table data ── */
  const sortedTableData = useMemo(() => {
    const data = [...mergedData];
    data.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : (bv as string).localeCompare(av);
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return data;
  }, [mergedData, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  /* ── aggregated stats ── */
  const stats = useMemo(() => {
    const avgEmployment = employment.length ? employment.reduce((s, e) => s + e.employment_rate, 0) / employment.length : 0;
    const avgGradSchool = employment.length ? employment.reduce((s, e) => s + e.grad_school_rate, 0) / employment.length : 0;
    const usSalaries = salaries.filter(s => s.currency === 'USD');
    const avgStarting = usSalaries.length ? usSalaries.reduce((s, e) => s + e.early_career_salary, 0) / usSalaries.length : 0;
    // industry frequency
    const industryCount: Record<string, number> = {};
    employment.forEach(e => e.top_industries.forEach(ind => { industryCount[ind] = (industryCount[ind] || 0) + 1; }));
    const topIndustries = Object.entries(industryCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
    // employer frequency
    const employerCount: Record<string, number> = {};
    employment.forEach(e => e.top_employers.forEach(emp => { employerCount[emp] = (employerCount[emp] || 0) + 1; }));
    const topEmployers = Object.entries(employerCount).sort((a, b) => b[1] - a[1]).slice(0, 20);
    return { avgEmployment, avgGradSchool, avgStarting, topIndustries, topEmployers };
  }, [employment, salaries]);

  /* ── chart data ── */
  const salaryChartData = useMemo(() => {
    return [...salaries].sort((a, b) => b.mid_career_salary - a.mid_career_salary);
  }, [salaries]);

  const gradSchoolData = useMemo(() => {
    return [...employment].sort((a, b) => b.grad_school_rate - a.grad_school_rate).slice(0, 15);
  }, [employment]);

  /* ── industry pie data ── */
  const industryPieData = useMemo(() => {
    return stats.topIndustries.map(([name, value]) => ({ name, value }));
  }, [stats]);

  const INDUSTRY_COLORS = ['#C8A45C', '#3B6EA5', '#8B2332', '#4A7C6F', '#6B4C8A', '#C2553A', '#D4943A', '#6B6560'];

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: '#FAF7F2' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#C8A45C', borderTopColor: 'transparent' }} />
          <p style={{ color: '#6B6560' }}>加载职业数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh]" style={{ backgroundColor: '#FAF7F2' }}>
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="pt-24 pb-8 px-6 md:px-10 max-w-[1400px] mx-auto"
      >
        <h1 className="font-display text-4xl md:text-5xl font-normal tracking-tight mb-3" style={{ color: '#2C2420', letterSpacing: '-0.02em' }}>
          毕业生职业前景
        </h1>
        <p className="text-base md:text-lg max-w-2xl" style={{ color: '#6B6560', lineHeight: 1.7 }}>
          基于 PayScale、HESA 等第三方平台数据，分析27所顶尖院校的毕业生薪资、就业率与职业发展路径。
        </p>
      </motion.div>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20 space-y-12">
        {/* ── Stats Overview ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            { label: '平均就业率', value: stats.avgEmployment.toFixed(1) + '%', icon: Briefcase, color: '#4A7C6F' },
            { label: '平均起薪 (USD)', value: '$' + Math.round(stats.avgStarting).toLocaleString(), icon: TrendingUp, color: '#C8A45C' },
            { label: '平均深造比例', value: stats.avgGradSchool.toFixed(1) + '%', icon: GraduationCap, color: '#3B6EA5' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              className="rounded-xl p-5 text-center"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
            >
              <stat.icon size={24} className="mx-auto mb-2" style={{ color: stat.color }} />
              <div className="text-2xl font-mono-data font-medium" style={{ color: '#C8A45C' }}>{stat.value}</div>
              <div className="text-xs uppercase tracking-wider mt-1" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Section 1: Salary Comparison ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <h2 className="font-display text-xl md:text-2xl font-medium" style={{ color: '#2C2420' }}>毕业生薪资对比</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setSalaryToggle('starting')}
                className="px-4 py-2 rounded-lg text-sm transition-all duration-200"
                style={{ backgroundColor: salaryToggle === 'starting' ? '#C8A45C' : '#F0EBE3', color: salaryToggle === 'starting' ? '#FAF7F2' : '#6B6560' }}
              >
                毕业起薪
              </button>
              <button
                onClick={() => setSalaryToggle('mid')}
                className="px-4 py-2 rounded-lg text-sm transition-all duration-200"
                style={{ backgroundColor: salaryToggle === 'mid' ? '#C8A45C' : '#F0EBE3', color: salaryToggle === 'mid' ? '#FAF7F2' : '#6B6560' }}
              >
                中期薪资
              </button>
            </div>
          </div>
          <div className="rounded-[14px] p-4 md:p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
            <ResponsiveContainer width="100%" height={650}>
              <BarChart data={salaryChartData} layout="vertical" margin={{ top: 5, right: 40, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6B6560', fontSize: 11 }} axisLine={{ stroke: '#E8E2D9' }} />
                <YAxis
                  type="category"
                  dataKey="school"
                  tick={{ fill: '#6B6560', fontSize: 11 }}
                  axisLine={{ stroke: '#E8E2D9' }}
                  width={75}
                />
                <Tooltip content={<SalaryTooltip />} />
                <Bar dataKey="early_career_salary" name="毕业起薪" radius={[0, 4, 4, 0]} barSize={8}>
                  {salaryChartData.map((entry, index) => (
                    <Cell key={`e-${index}`} fill={getRegionColor(entry.country)} fillOpacity={salaryToggle === 'starting' ? 1 : 0.4} />
                  ))}
                </Bar>
                <Bar dataKey="mid_career_salary" name="中期薪资" radius={[0, 4, 4, 0]} barSize={8}>
                  {salaryChartData.map((entry, index) => (
                    <Cell key={`m-${index}`} fill={getRegionColor(entry.country)} fillOpacity={salaryToggle === 'mid' ? 1 : 0.4} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3 justify-center">
            {Object.entries(REGION_COLORS).slice(0, 4).map(([region, color]) => (
              <div key={region} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs" style={{ color: '#6B6560' }}>{region}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Section 2: Salary by Major ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>热门专业薪资排行</h2>
          <div className="rounded-[14px] p-4 md:p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
            <ResponsiveContainer width="100%" height={450}>
              <BarChart data={majorSalaries} layout="vertical" margin={{ top: 5, right: 80, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6B6560', fontSize: 11 }} axisLine={{ stroke: '#E8E2D9' }} />
                <YAxis
                  type="category"
                  dataKey="major"
                  tick={{ fill: '#6B6560', fontSize: 12 }}
                  axisLine={{ stroke: '#E8E2D9' }}
                  width={100}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as MajorSalary;
                    return (
                      <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#F0EBE3', border: '1px solid #E8E2D9' }}>
                        <div className="font-medium mb-1" style={{ color: '#2C2420' }}>{d.major}</div>
                        <div style={{ color: '#6B6560' }}>平均起薪: <span style={{ color: '#C8A45C' }}>USD {d.avg_starting_salary.toLocaleString()}</span></div>
                        <div style={{ color: '#6B6560' }}>2025预测: <span style={{ color: '#4A7C6F' }}>USD {d.projected_2025.toLocaleString()}</span></div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="avg_starting_salary" radius={[0, 4, 4, 0]} barSize={18}>
                  {majorSalaries.map((_entry, index) => (
                    <Cell key={`ms-${index}`} fill={index < 3 ? '#C8A45C' : '#6B6560'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Major insight cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {majorSalaries.slice(0, 6).map((m, i) => (
              <motion.div
                key={m.major}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="rounded-xl p-4 transition-all duration-300 hover:-translate-y-1"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium" style={{ color: '#2C2420' }}>{m.major}</span>
                  {i < 3 && <Star size={16} style={{ color: '#C8A45C' }} />}
                </div>
                <div className="text-xl font-mono-data" style={{ color: '#C8A45C' }}>
                  USD {m.avg_starting_salary.toLocaleString()}
                </div>
                <div className="text-xs mt-1" style={{ color: '#6B6560' }}>2025预测: USD {m.projected_2025.toLocaleString()}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Section 3: Employment Outcomes ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* Industry distribution */}
          <div>
            <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>最受毕业生欢迎的行业</h2>
            <div className="rounded-[14px] p-4 md:p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={industryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {industryPieData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={INDUSTRY_COLORS[index % INDUSTRY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0];
                      return (
                        <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: '#F0EBE3', border: '1px solid #E8E2D9' }}>
                          <span style={{ color: '#2C2420' }}>{d.name}: </span>
                          <span style={{ color: '#C8A45C' }}>{d.value} 所院校</span>
                        </div>
                      );
                    }}
                  />
                  <Legend
                    formatter={(value: string) => <span style={{ color: '#6B6560', fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top employers */}
          <div>
            <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>顶尖雇主</h2>
            <div className="rounded-[14px] p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
              <div className="flex flex-wrap gap-2">
                {stats.topEmployers.map(([name, count], i) => (
                  <span
                    key={name}
                    className="px-3 py-1.5 rounded-md text-xs transition-all duration-200 hover:scale-105"
                    style={{
                      backgroundColor: '#F0EBE3',
                      color: '#6B6560',
                      border: i < 5 ? '1px solid #C8A45C' : '1px solid #E8E2D9',
                    }}
                  >
                    {name} <span style={{ color: '#6B6560' }}>({count})</span>
                  </span>
                ))}
              </div>
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-3" style={{ color: '#6B6560' }}>行业薪资排行</h3>
                <div className="space-y-2">
                  {stats.topIndustries.map(([industry, count], i) => (
                    <div key={industry} className="flex items-center gap-3">
                      <span className="text-xs w-16" style={{ color: '#6B6560' }}>{industry}</span>
                      <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: '#F0EBE3' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${(count / (stats.topIndustries[0]?.[1] || 1)) * 100}%` }}
                          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: INDUSTRY_COLORS[i % INDUSTRY_COLORS.length] }}
                        />
                      </div>
                      <span className="text-xs font-mono-data w-6" style={{ color: '#6B6560' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Section 4: Grad School & Career Trajectory ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>深造与职业发展</h2>
          <div className="rounded-[14px] p-4 md:p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={gradSchoolData} layout="vertical" margin={{ top: 5, right: 40, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" horizontal={false} />
                <XAxis type="number" domain={[0, 50]} tick={{ fill: '#6B6560', fontSize: 11 }} axisLine={{ stroke: '#E8E2D9' }} />
                <YAxis
                  type="category"
                  dataKey="school"
                  tick={{ fill: '#6B6560', fontSize: 11 }}
                  axisLine={{ stroke: '#E8E2D9' }}
                  width={75}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as EmploymentEntry;
                    return (
                      <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#F0EBE3', border: '1px solid #E8E2D9' }}>
                        <div className="font-medium mb-1" style={{ color: '#2C2420' }}>{d.school}</div>
                        <div style={{ color: '#6B6560' }}>深造比例: <span style={{ color: '#C8A45C' }}>{d.grad_school_rate}%</span></div>
                        <div style={{ color: '#6B6560' }}>就业率: <span style={{ color: '#4A7C6F' }}>{d.employment_rate}%</span></div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="grad_school_rate" radius={[0, 4, 4, 0]} barSize={14}>
                  {gradSchoolData.map((entry, index) => (
                    <Cell key={`gs-${index}`} fill={entry.grad_school_rate > 30 ? '#4A7C6F' : '#6B6560'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Career timeline illustration */}
          <div className="mt-6 rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
            <h3 className="text-sm font-medium mb-6" style={{ color: '#6B6560' }}>职业发展时间线</h3>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute top-6 left-0 right-0 h-0.5 hidden md:block" style={{ backgroundColor: '#E8E2D9' }} />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { year: '毕业 (Year 0)', title: '入职起步', desc: '起薪范围因学校和专业差异大，STEM专业通常更高', icon: GraduationCap, color: '#3B6EA5' },
                  { year: '3-5年', title: '快速成长', desc: '第一次晋升或跳槽，部分选择攻读研究生', icon: ArrowUpRight, color: '#4A7C6F' },
                  { year: '10年', title: '中层管理', desc: '达到中期薪资水平，部分人进入管理层或创业', icon: Building2, color: '#C8A45C' },
                  { year: '15年+', title: '资深/高管', desc: '行业专家或C-level，薪资增长趋于稳定', icon: Award, color: '#8B2332' },
                ].map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    viewport={{ once: true }}
                    className="relative text-center"
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 relative z-10"
                      style={{ backgroundColor: `${step.color}20`, border: `2px solid ${step.color}` }}
                    >
                      <step.icon size={20} style={{ color: step.color }} />
                    </div>
                    <div className="text-xs font-mono-data mb-1" style={{ color: step.color }}>{step.year}</div>
                    <div className="text-sm font-medium mb-1" style={{ color: '#2C2420' }}>{step.title}</div>
                    <div className="text-xs" style={{ color: '#6B6560', lineHeight: 1.5 }}>{step.desc}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ── Section 5: University Career Detail Table ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
        >
          <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>院校就业详情</h2>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E2D9' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F5F0E8' }}>
                    {[
                      { key: 'school' as SortKey, label: '院校' },
                      { key: 'early_career_salary' as SortKey, label: '毕业起薪' },
                      { key: 'mid_career_salary' as SortKey, label: '中期薪资' },
                      { key: 'growth' as SortKey, label: '薪资增幅' },
                      { key: 'employment_rate' as SortKey, label: '就业率' },
                      { key: 'grad_school_rate' as SortKey, label: '深造比例' },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => toggleSort(col.key)}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider cursor-pointer select-none transition-colors hover:text-accent-gold"
                        style={{ color: '#6B6560', letterSpacing: '0.06em' }}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key && (
                            <span style={{ color: '#C8A45C' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>主要行业</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#E8E2D9' }}>
                  {sortedTableData.map((row, i) => (
                    <motion.tr
                      key={row.key}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      viewport={{ once: true }}
                      whileHover={{ backgroundColor: '#F0EBE3' }}
                      className="transition-colors"
                      style={{ backgroundColor: '#FFFFFF' }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: getRegionColor(row.country) }} />
                          <div>
                            <div className="font-medium" style={{ color: '#2C2420' }}>{row.school}</div>
                            <div className="text-xs" style={{ color: '#6B6560' }}>{row.country}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono-data" style={{ color: '#6B6560' }}>
                        {row.currency === 'USD' ? '$' : '£'}{row.early_career_salary.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono-data" style={{ color: '#C8A45C' }}>
                        {row.currency === 'USD' ? '$' : '£'}{row.mid_career_salary.toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={row.growth > 1.8 ? 'text-[#4A7C6F]' : row.growth > 1.5 ? 'text-[#D4943A]' : 'text-[#6B6560]'}>
                          {row.growth > 0 ? ((row.growth - 1) * 100).toFixed(0) : '0'}%
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono-data" style={{ color: row.employment_rate >= 93 ? '#4A7C6F' : '#6B6560' }}>
                        {row.employment_rate}%
                      </td>
                      <td className="px-4 py-3 font-mono-data" style={{ color: row.grad_school_rate > 30 ? '#3B6EA5' : '#6B6560' }}>
                        {row.grad_school_rate}%
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {row.top_industries.slice(0, 2).map(ind => (
                            <span key={ind} className="px-2 py-0.5 rounded text-[10px]" style={{ backgroundColor: '#F0EBE3', color: '#6B6560' }}>
                              {ind}
                            </span>
                          ))}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
