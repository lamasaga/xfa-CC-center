import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
  Star,
  BookOpen,
  Globe,
  Palette,
  ExternalLink,
  GraduationCap,
  Briefcase,
  TrendingUp,
  Building2,
  Users,
  Home,
  Utensils,
  Bus,
  ShoppingBag,
} from 'lucide-react';
import { useData } from '@/context/DataContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type TabKey = 'overview' | 'admission' | 'majors' | 'living' | 'facilities' | 'career';

interface UniRecord {
  id: string;
  name: string;
  name_en: string;
  region: string;
  country: string;
  abbreviation?: string;
  ranking: { qs?: number; us_news?: number; the?: number };
  admission: Record<string, unknown>;
  tuition: Record<string, unknown>;
  majors: string[];
  is_art_school: boolean;
  location?: Record<string, unknown>;
  school_type?: string;
  description?: string;
  features?: string[];
  facilities?: string;
  academic_resources?: string;
  living_cost?: Record<string, unknown>;
  official_website?: string;
  portfolio_tips?: string;
  [key: string]: unknown;
}

interface UniversityDetailModalProps {
  universityId: string;
  onClose: () => void;
  bookmarks: Set<string>;
  onToggleBookmark: (id: string) => void;
  onNavigate: (id: string) => void;
  universityIds: string[];
}

interface ThirdPartySalary {
  school: string;
  country: string;
  early_career_salary: number;
  mid_career_salary: number;
  currency: string;
  by_major: Record<string, number>;
}

interface ThirdPartyEmployment {
  school: string;
  employment_rate: number;
  top_industries: string[];
  top_employers: string[];
  grad_school_rate: number;
}

interface CityLivingCost {
  city: string;
  country: string;
  cost_index: number;
  rent_index: number;
  groceries_index: number;
  restaurant_index: number;
  rent_avg_1br: number;
  currency: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'admission', label: '录取要求' },
  { key: 'majors', label: '专业与学费' },
  { key: 'living', label: '生活成本' },
  { key: 'facilities', label: '校园设施' },
  { key: 'career', label: '职业前景' },
];

const REGION_COLORS: Record<string, string> = {
  '美国': '#3B6EA5',
  '英国': '#8B2332',
  '加拿大': '#C2553A',
  '澳大利亚': '#4A7C6F',
  '欧洲': '#6B4C8A',
  '香港': '#C8553D',
  '新加坡': '#D4943A',
  '艺术': '#C8A45C',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseAcceptanceRateNumeric(rate: unknown): number {
  if (typeof rate === 'number') return rate;
  if (typeof rate === 'string') {
    const match = rate.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  }
  return 0;
}

function formatAcceptanceRateDisplay(rate: unknown): string {
  if (typeof rate === 'string') return rate;
  if (typeof rate === 'number') return `${rate}%`;
  return '--';
}

function formatCurrency(amount: unknown, currency: unknown): string {
  const amt = typeof amount === 'number' ? amount : 0;
  if (!amt) return '--';
  const c = typeof currency === 'string' ? currency : 'USD';
  if (c === 'USD') return `$${amt.toLocaleString()}`;
  if (c === 'GBP') return `£${amt.toLocaleString()}`;
  if (c === 'EUR') return `€${amt.toLocaleString()}`;
  if (c === 'CAD') return `C$${amt.toLocaleString()}`;
  if (c === 'AUD') return `A$${amt.toLocaleString()}`;
  if (c === 'CHF') return `CHF ${amt.toLocaleString()}`;
  return `${amt.toLocaleString()} ${c}`;
}

function getAcceptanceColor(rate: number): string {
  if (rate < 5) return '#8B2332';
  if (rate < 15) return '#C8A45C';
  if (rate < 30) return '#4A7C6F';
  return 'rgba(74,124,111,0.7)';
}

function getCitySlug(city: string): string {
  const map: Record<string, string> = {
    '剑桥': 'cambridge', '波士顿': 'boston', '纽约': 'new_york',
    '旧金山': 'san_francisco', '洛杉矶': 'los_angeles', '芝加哥': 'chicago',
    '华盛顿': 'washington_dc', '西雅图': 'seattle', '费城': 'philadelphia',
    '迈阿密': 'miami', '亚特兰大': 'atlanta', '奥斯汀': 'austin',
    '匹兹堡': 'pittsburgh', '安娜堡': 'ann_arbor', '达勒姆': 'durham_nc',
    '休斯顿': 'houston', '伦敦': 'london', '牛津': 'oxford',
    '剑桥(英国)': 'cambridge', '曼彻斯特': 'manchester', '爱丁堡': 'edinburgh',
    '布里斯托': 'bristol', '伯明翰': 'birmingham', '格拉斯哥': 'glasgow',
    '利兹': 'leeds', '杜伦': 'durham_uk', '南安普顿': 'southampton',
    '兰卡斯特': 'lancaster', '多伦多': 'toronto', '温哥华': 'vancouver',
    '蒙特利尔': 'montreal', '汉密尔顿': 'hamilton', '埃德蒙顿': 'edmonton',
    '悉尼': 'sydney', '墨尔本': 'melbourne', '布里斯班': 'brisbane',
    '珀斯': 'perth', '阿德莱德': 'adelaide', '堪培拉': 'canberra',
    '苏黎世': 'zurich', '阿姆斯特丹': 'amsterdam', '慕尼黑': 'munich',
    '巴黎': 'paris', '哥本哈根': 'copenhagen', '斯德哥尔摩': 'stockholm',
    '都柏林': 'dublin', '米兰': 'milan', '巴塞罗那': 'barcelona',
    '香港': 'hong_kong', '新加坡': 'singapore', '柏林': 'berlin',
    '帕萨迪纳': 'pasadena', '普罗维登斯': 'providence', '伊萨卡': 'ithaca',
    '纽黑文': 'new_haven', '斯坦福': 'stanford', '普林斯顿': 'princeton',
    '汉诺威': 'hanover', '巴尔的摩': 'baltimore', '埃文斯顿': 'evanston',
    '圣母大学': 'notre_dame', '达勒姆(英国)': 'durham_uk', '布莱顿': 'brighton',
    '卡迪夫': 'cardiff', '利物浦': 'liverpool', '纽卡斯尔': 'newcastle',
    '诺丁汉': 'nottingham', '谢菲尔德': 'sheffield', '约克': 'york',
    '贝尔法斯特': 'belfast', '阿伯丁': 'aberdeen', '邓迪': 'dundee',
    '斯特灵': 'stirling', '温彻斯特': 'winchester', '雷丁': 'reading',
    '朴茨茅斯': 'portsmouth', '伯恩茅斯': 'bournemouth',
  };
  return map[city] || city.toLowerCase().replace(/\s+/g, '_');
}

/* ------------------------------------------------------------------ */
/*  Tab Content Components                                             */
/* ------------------------------------------------------------------ */

function OverviewTab({ u }: { u: UniRecord }) {
  return (
    <div className="space-y-8">
      {/* Description */}
      <div>
        <h4
          className="text-[12px] font-medium uppercase tracking-wider mb-3"
          style={{ color: '#6B6560', letterSpacing: '0.08em' }}
        >
          院校简介
        </h4>
        <p className="text-[17px] leading-[1.8]" style={{ color: '#2C2420' }}>
          {u.description || '暂无院校简介'}
        </p>
      </div>

      {/* Key Facts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: '学校类型', value: u.school_type || '--' },
          { label: '所在城市', value: (u.location?.city as string) || '--' },
          { label: '录取率', value: formatAcceptanceRateDisplay(u.admission?.acceptance_rate) },
          { label: '专业数量', value: String(u.majors?.length || 0) },
        ].map((fact) => (
          <div
            key={fact.label}
            className="rounded-[10px] p-4 text-center"
            style={{ backgroundColor: '#F0EBE3' }}
          >
            <p className="font-mono text-[24px] font-normal" style={{ color: '#C8A45C' }}>
              {fact.value}
            </p>
            <p className="text-[12px] mt-1" style={{ color: '#6B6560' }}>
              {fact.label}
            </p>
          </div>
        ))}
      </div>

      {/* Features */}
      {u.features && u.features.length > 0 && (
        <div>
          <h4
            className="text-[12px] font-medium uppercase tracking-wider mb-3"
            style={{ color: '#6B6560', letterSpacing: '0.08em' }}
          >
            特色亮点
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {u.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-2">
                <Star size={16} className="mt-0.5 shrink-0" style={{ color: '#C8A45C' }} />
                <span className="text-[15px]" style={{ color: '#2C2420' }}>
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rankings comparison */}
      <div>
        <h4
          className="text-[12px] font-medium uppercase tracking-wider mb-3"
          style={{ color: '#6B6560', letterSpacing: '0.08em' }}
        >
          世界排名
        </h4>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'qs', label: 'QS' },
            { key: 'us_news', label: 'US News' },
            { key: 'the', label: 'THE' },
          ].map((rk) => {
            const val = u.ranking?.[rk.key as keyof typeof u.ranking];
            return (
              <div
                key={rk.key}
                className="rounded-[10px] p-5 text-center"
                style={{ backgroundColor: '#F0EBE3' }}
              >
                <p
                  className="font-mono text-[28px] font-normal"
                  style={{ color: val ? '#C8A45C' : '#6B6560' }}
                >
                  {val ? `#${val}` : '—'}
                </p>
                <p className="text-[12px] mt-1" style={{ color: '#6B6560' }}>
                  {rk.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Official website */}
      {u.official_website && (
        <a
          href={u.official_website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-[15px] transition-all duration-200 hover:underline"
          style={{ color: '#C8A45C' }}
        >
          <Globe size={16} />
          访问官网
          <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AdmissionTab({ u }: { u: UniRecord }) {
  const rate = parseAcceptanceRateNumeric(u.admission?.acceptance_rate);
  const rateColor = getAcceptanceColor(rate);
  const adm = u.admission || {};

  return (
    <div className="space-y-8">
      {/* A-Level Requirements */}
      <div>
        <h4
          className="text-[12px] font-medium uppercase tracking-wider mb-3"
          style={{ color: '#6B6560', letterSpacing: '0.08em' }}
        >
          A-Level 要求
        </h4>
        <p className="text-[22px] font-medium" style={{ color: '#2C2420' }}>
          {typeof adm.a_level === 'string' ? adm.a_level : '暂无数据'}
        </p>
        {adm.portfolio_required === true && (
          <p className="text-[15px] mt-2" style={{ color: '#8B2332' }}>
            该校更看重作品集，A-Level要求相对宽松
          </p>
        )}
      </div>

      {/* Test scores grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'SAT', value: adm.sat },
          { label: 'ACT', value: adm.act },
          { label: 'IELTS', value: adm.ielts },
          { label: 'TOEFL', value: adm.toefl },
        ].map((test) => (
          <div
            key={test.label}
            className="rounded-[10px] p-4"
            style={{ backgroundColor: '#F0EBE3' }}
          >
            <p className="text-[12px] mb-1" style={{ color: '#6B6560' }}>
              {test.label}
            </p>
            <p className="text-[15px]" style={{ color: test.value ? '#2C2420' : '#6B6560' }}>
              {typeof test.value === 'string' ? test.value : '不要求'}
            </p>
          </div>
        ))}
      </div>

      {/* Application deadline */}
      <div>
        <h4
          className="text-[12px] font-medium uppercase tracking-wider mb-3"
          style={{ color: '#6B6560', letterSpacing: '0.08em' }}
        >
          申请时间线
        </h4>
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: '#C8A45C' }}
          />
          <p className="text-[15px]" style={{ color: '#2C2420' }}>
            {typeof adm.deadline === 'string' ? adm.deadline : '暂无数据'}
          </p>
        </div>
      </div>

      {/* Acceptance rate visualization */}
      <div>
        <h4
          className="text-[12px] font-medium uppercase tracking-wider mb-3"
          style={{ color: '#6B6560', letterSpacing: '0.08em' }}
        >
          录取率
        </h4>
        <p className="font-mono text-[48px] font-normal" style={{ color: rateColor }}>
          {formatAcceptanceRateDisplay(adm.acceptance_rate)}
        </p>
        {/* Progress bar */}
        <div
          className="w-full h-2 rounded-full mt-3 overflow-hidden"
          style={{ backgroundColor: '#F0EBE3' }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(rate * 2, 100)}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="h-full rounded-full"
            style={{ backgroundColor: rateColor }}
          />
        </div>
        <p className="text-[12px] mt-2" style={{ color: '#6B6560' }}>
          {rate < 5
            ? '极难录取 — 竞争激烈'
            : rate < 15
              ? '较难录取 — 需要优秀成绩'
              : rate < 30
                ? '中等难度 — 合理准备有机会'
                : '相对容易 — 录取机会较大'}
        </p>
      </div>

      {/* Interview & Portfolio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center gap-3 rounded-[10px] p-4" style={{ backgroundColor: '#F0EBE3' }}>
          <Users size={20} style={{ color: adm.interview_required ? '#C8A45C' : '#6B6560' }} />
          <div>
            <p className="text-[12px]" style={{ color: '#6B6560' }}>面试要求</p>
            <p className="text-[15px]" style={{ color: '#2C2420' }}>
              {adm.interview_required ? '需要面试' : '不要求面试'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-[10px] p-4" style={{ backgroundColor: '#F0EBE3' }}>
          <Palette size={20} style={{ color: adm.portfolio_required ? '#8B2332' : '#6B6560' }} />
          <div>
            <p className="text-[12px]" style={{ color: '#6B6560' }}>作品集</p>
            <p className="text-[15px]" style={{ color: adm.portfolio_required ? '#8B2332' : '#2C2420' }}>
              {adm.portfolio_required ? '需要作品集' : '不要求作品集'}
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio tips */}
      {adm.portfolio_required === true && typeof u.portfolio_tips === 'string' && u.portfolio_tips && (
        <div
          className="rounded-[10px] p-4 border"
          style={{ backgroundColor: '#8B233208', borderColor: '#8B233230' }}
        >
          <p className="text-[12px] font-medium mb-1" style={{ color: '#8B2332' }}>
            作品集建议
          </p>
          <p className="text-[15px]" style={{ color: '#2C2420' }}>
            {u.portfolio_tips}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MajorsTab({ u }: { u: UniRecord }) {
  const regionColor = REGION_COLORS[u.region] || '#C8A45C';
  const tuitionAmount = typeof u.tuition?.amount === 'number' ? u.tuition.amount : 0;
  const livingAmount = typeof u.living_cost?.amount === 'number' ? u.living_cost.amount : 0;
  const tuitionTotal = tuitionAmount + livingAmount;

  return (
    <div className="space-y-8">
      {/* Tuition card */}
      <div
        className="rounded-[14px] border p-6"
        style={{
          background: `linear-gradient(135deg, ${regionColor}10 0%, transparent 100%)`,
          borderColor: '#E8E2D9',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[12px]" style={{ color: '#6B6560' }}>
              年度学费
            </p>
            <p className="font-mono text-[32px] font-normal mt-1" style={{ color: '#2C2420' }}>
              {formatCurrency(u.tuition?.amount, u.tuition?.currency)}
            </p>
            <p className="text-[12px] mt-1" style={{ color: '#6B6560' }}>
              {typeof u.tuition?.period === 'string' ? u.tuition.period : '每年'}
            </p>
            {typeof u.tuition?.note === 'string' && u.tuition.note && (
              <p className="text-[12px] mt-1 italic" style={{ color: '#6B6560' }}>
                {u.tuition.note}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[12px]" style={{ color: '#6B6560' }}>
              学费+生活费/年
            </p>
            <p className="text-[22px] font-medium mt-1" style={{ color: '#C8A45C' }}>
              {formatCurrency(tuitionTotal, u.tuition?.currency)}
            </p>
          </div>
        </div>
      </div>

      {/* Scholarship info placeholder */}
      <div
        className="rounded-[10px] p-4 border"
        style={{ backgroundColor: '#F0EBE3', borderColor: '#E8E2D9' }}
      >
        <div className="flex items-center gap-2 mb-2">
          <GraduationCap size={16} style={{ color: '#C8A45C' }} />
          <span className="text-[14px] font-medium" style={{ color: '#C8A45C' }}>
            奖学金信息
          </span>
        </div>
        <p className="text-[14px]" style={{ color: '#6B6560' }}>
          建议访问院校官网了解最新奖学金政策与申请要求。
        </p>
      </div>

      {/* Majors list */}
      <div>
        <h4
          className="text-[12px] font-medium uppercase tracking-wider mb-4"
          style={{ color: '#6B6560', letterSpacing: '0.08em' }}
        >
          热门专业
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(u.majors || []).map((major) => (
            <div
              key={major}
              className="flex items-center gap-2.5 rounded-lg px-4 py-3"
              style={{ backgroundColor: '#F0EBE3' }}
            >
              <BookOpen size={16} style={{ color: '#6B6560' }} />
              <span className="text-[15px]" style={{ color: '#2C2420' }}>
                {major}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LivingCostTab({
  u,
  thirdParty,
}: {
  u: UniRecord;
  thirdParty: Record<string, unknown> | null;
}) {
  const citiesData = useMemo(() => {
    if (!thirdParty?.cities_living_costs) return {};
    return thirdParty.cities_living_costs as Record<string, CityLivingCost>;
  }, [thirdParty]);

  const cityName = (u.location?.city as string) || '';
  const citySlug = getCitySlug(cityName);
  const cityData = citiesData[citySlug];

  const budgetBreakdown = useMemo(() => {
    if (!cityData) return null;
    const rent = cityData.rent_avg_1br || 0;
    const food = Math.round(rent * 0.4);
    const transport = Math.round(rent * 0.15);
    const others = Math.round(rent * 0.25);
    return { rent, food, transport, others };
  }, [cityData]);

  return (
    <div className="space-y-8">
      {/* City summary */}
      <div
        className="rounded-[14px] p-6"
        style={{ backgroundColor: '#F0EBE3' }}
      >
        <h3 className="text-[22px] font-medium mb-4" style={{ color: '#2C2420' }}>
          {cityName || '未知城市'}
        </h3>
        {cityData ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-[12px]" style={{ color: '#6B6560' }}>生活费/年</p>
              <p className="font-mono text-[20px] mt-1" style={{ color: '#2C2420' }}>
                {formatCurrency(u.living_cost?.amount, u.living_cost?.currency)}
              </p>
            </div>
            <div>
              <p className="text-[12px]" style={{ color: '#6B6560' }}>一居室租金</p>
              <p className="font-mono text-[20px] mt-1" style={{ color: '#C8A45C' }}>
                {formatCurrency(cityData.rent_avg_1br, cityData.currency)}
                <span className="text-[12px] ml-1" style={{ color: '#6B6560' }}>/月</span>
              </p>
            </div>
            <div>
              <p className="text-[12px]" style={{ color: '#6B6560' }}>生活成本指数</p>
              <p className="font-mono text-[20px] mt-1" style={{ color: '#2C2420' }}>
                {cityData.cost_index}
              </p>
            </div>
            <div>
              <p className="text-[12px]" style={{ color: '#6B6560' }}>餐饮指数</p>
              <p className="font-mono text-[20px] mt-1" style={{ color: '#2C2420' }}>
                {cityData.restaurant_index}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[15px]" style={{ color: '#6B6560' }}>
            暂无该城市详细生活成本数据
          </p>
        )}
      </div>

      {/* Budget breakdown */}
      {budgetBreakdown && (
        <div>
          <h4
            className="text-[12px] font-medium uppercase tracking-wider mb-4"
            style={{ color: '#6B6560', letterSpacing: '0.08em' }}
          >
            月度预算估算
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Home, label: '住宿', value: budgetBreakdown.rent, color: '#C8A45C' },
              { icon: Utensils, label: '餐饮', value: budgetBreakdown.food, color: '#4A7C6F' },
              { icon: Bus, label: '交通', value: budgetBreakdown.transport, color: '#3B6EA5' },
              { icon: ShoppingBag, label: '其他', value: budgetBreakdown.others, color: '#6B4C8A' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[10px] p-4"
                style={{ backgroundColor: '#F0EBE3' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <item.icon size={16} style={{ color: item.color }} />
                  <span className="text-[12px]" style={{ color: '#6B6560' }}>
                    {item.label}
                  </span>
                </div>
                <p className="font-mono text-[18px]" style={{ color: '#2C2420' }}>
                  {formatCurrency(item.value, cityData?.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Living cost note */}
      {typeof u.living_cost?.note === 'string' && u.living_cost.note && (
        <p className="text-[14px] italic" style={{ color: '#6B6560' }}>
          {u.living_cost.note}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FacilitiesTab({ u }: { u: UniRecord }) {
  return (
    <div className="space-y-8">
      <div>
        <h4
          className="text-[12px] font-medium uppercase tracking-wider mb-3"
          style={{ color: '#6B6560', letterSpacing: '0.08em' }}
        >
          校园设施
        </h4>
        <p className="text-[17px] leading-[1.8]" style={{ color: '#2C2420' }}>
          {u.facilities || '暂无校园设施信息'}
        </p>
      </div>

      <div>
        <h4
          className="text-[12px] font-medium uppercase tracking-wider mb-3"
          style={{ color: '#6B6560', letterSpacing: '0.08em' }}
        >
          学术资源
        </h4>
        <p className="text-[17px] leading-[1.8]" style={{ color: '#2C2420' }}>
          {u.academic_resources || '暂无学术资源信息'}
        </p>
      </div>

      {/* Quick facility highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { icon: Building2, label: '图书馆', desc: '藏书与数字资源' },
          { icon: TrendingUp, label: '实验室', desc: '科研设施' },
          { icon: Users, label: '体育设施', desc: '运动场馆' },
          { icon: Home, label: '住宿', desc: '学生宿舍' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-[10px] p-4"
            style={{ backgroundColor: '#F0EBE3' }}
          >
            <item.icon size={20} style={{ color: '#C8A45C' }} />
            <div>
              <p className="text-[15px]" style={{ color: '#2C2420' }}>
                {item.label}
              </p>
              <p className="text-[12px]" style={{ color: '#6B6560' }}>
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CareerTab({
  u,
  thirdParty,
}: {
  u: UniRecord;
  thirdParty: Record<string, unknown> | null;
}) {
  const salaryData = useMemo(() => {
    if (!thirdParty?.salaries) return null;
    const salaries = thirdParty.salaries as Record<string, ThirdPartySalary>;
    return salaries[u.id] || null;
  }, [thirdParty, u.id]);

  const employmentData = useMemo(() => {
    if (!thirdParty?.employment) return null;
    const emp = thirdParty.employment as Record<string, ThirdPartyEmployment>;
    return emp[u.id] || null;
  }, [thirdParty, u.id]);

  const hasCareerData = salaryData || employmentData;

  if (!hasCareerData) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Briefcase size={48} style={{ color: '#6B6560' }} />
        <h3 className="text-[20px] font-medium mt-4" style={{ color: '#6B6560' }}>
          暂无该院校薪资数据
        </h3>
        <p className="text-[15px] mt-2" style={{ color: '#6B6560' }}>
          可参考同地区/同排名院校数据
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Salary cards */}
      {salaryData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            className="rounded-[14px] p-6"
            style={{ backgroundColor: '#F0EBE3' }}
          >
            <p className="text-[12px]" style={{ color: '#6B6560' }}>
              毕业起薪 (0-5年)
            </p>
            <p className="font-mono text-[36px] font-normal mt-1" style={{ color: '#C8A45C' }}>
              {formatCurrency(salaryData.early_career_salary, salaryData.currency)}
            </p>
          </div>
          <div
            className="rounded-[14px] p-6"
            style={{ backgroundColor: '#F0EBE3' }}
          >
            <p className="text-[12px]" style={{ color: '#6B6560' }}>
              中期薪资 (10+年)
            </p>
            <p className="font-mono text-[36px] font-normal mt-1" style={{ color: '#2C2420' }}>
              {formatCurrency(salaryData.mid_career_salary, salaryData.currency)}
            </p>
          </div>
        </div>
      )}

      {/* Salary by major */}
      {salaryData?.by_major && Object.keys(salaryData.by_major).length > 0 && (
        <div>
          <h4
            className="text-[12px] font-medium uppercase tracking-wider mb-4"
            style={{ color: '#6B6560', letterSpacing: '0.08em' }}
          >
            按专业薪资
          </h4>
          <div
            className="rounded-[12px] p-4 space-y-3"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            {Object.entries(salaryData.by_major)
              .sort(([, a], [, b]) => b - a)
              .map(([major, salary]) => {
                const maxSalary = Math.max(
                  ...Object.values(salaryData.by_major)
                );
                const pct = maxSalary > 0 ? (salary / maxSalary) * 100 : 0;
                return (
                  <div key={major}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px]" style={{ color: '#2C2420' }}>
                        {major}
                      </span>
                      <span
                        className="font-mono text-[13px]"
                        style={{ color: '#C8A45C' }}
                      >
                        {formatCurrency(salary, salaryData.currency)}
                      </span>
                    </div>
                    <div
                      className="w-full h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: '#F0EBE3' }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{
                          duration: 0.8,
                          ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                        }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: '#C8A45C' }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Employment data */}
      {employmentData && (
        <>
          {/* Employment rate */}
          <div>
            <h4
              className="text-[12px] font-medium uppercase tracking-wider mb-3"
              style={{ color: '#6B6560', letterSpacing: '0.08em' }}
            >
              就业率
            </h4>
            <div className="flex items-center gap-4">
              <p className="font-mono text-[48px] font-normal" style={{ color: '#4A7C6F' }}>
                {employmentData.employment_rate}%
              </p>
              <div className="flex-1">
                <div
                  className="w-full h-3 rounded-full overflow-hidden"
                  style={{ backgroundColor: '#F0EBE3' }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${employmentData.employment_rate}%` }}
                    transition={{
                      duration: 0.8,
                      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
                    }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: '#4A7C6F' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Top industries */}
          {employmentData.top_industries?.length > 0 && (
            <div>
              <h4
                className="text-[12px] font-medium uppercase tracking-wider mb-3"
                style={{ color: '#6B6560', letterSpacing: '0.08em' }}
              >
                主要就业行业
              </h4>
              <div className="flex flex-wrap gap-2">
                {employmentData.top_industries.map((ind) => (
                  <span
                    key={ind}
                    className="text-[13px] px-3 py-1.5 rounded-md"
                    style={{ backgroundColor: '#F0EBE3', color: '#2C2420' }}
                  >
                    {ind}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top employers */}
          {employmentData.top_employers?.length > 0 && (
            <div>
              <h4
                className="text-[12px] font-medium uppercase tracking-wider mb-3"
                style={{ color: '#6B6560', letterSpacing: '0.08em' }}
              >
                主要雇主
              </h4>
              <div className="flex flex-wrap gap-2">
                {employmentData.top_employers.map((emp) => (
                  <span
                    key={emp}
                    className="text-[13px] px-3 py-1.5 rounded-md"
                    style={{ backgroundColor: '#F0EBE3', color: '#2C2420' }}
                  >
                    {emp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Grad school rate */}
          <div
            className="rounded-[10px] p-4 inline-flex items-center gap-3"
            style={{ backgroundColor: '#F0EBE3' }}
          >
            <GraduationCap size={20} style={{ color: '#C8A45C' }} />
            <div>
              <p className="text-[12px]" style={{ color: '#6B6560' }}>继续深造比例</p>
              <p className="text-[18px] font-medium" style={{ color: '#2C2420' }}>
                {employmentData.grad_school_rate}%
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Modal Component                                               */
/* ------------------------------------------------------------------ */

export default function UniversityDetailModal({
  universityId,
  onClose,
  bookmarks,
  onToggleBookmark,
  onNavigate,
  universityIds,
}: UniversityDetailModalProps) {
  const { universities, thirdParty } = useData();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [scrollProgress, setScrollProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const isBookmarked = bookmarks.has(universityId);

  /* Find current university */
  const university = useMemo(() => {
    return (universities as UniRecord[]).find(
      (u) => u.id === universityId
    );
  }, [universities, universityId]);

  /* Navigation indices */
  const currentIndex = universityIds.indexOf(universityId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < universityIds.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(universityIds[currentIndex - 1]);
  }, [hasPrev, currentIndex, universityIds, onNavigate]);

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(universityIds[currentIndex + 1]);
  }, [hasNext, currentIndex, universityIds, onNavigate]);

  /* Keyboard support */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose, goPrev, goNext]);

  /* Scroll progress */
  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    const progress = el.scrollTop / (el.scrollHeight - el.clientHeight);
    setScrollProgress(progress || 0);
  }, []);

  if (!university) {
    return (
      <div
        className="fixed inset-0 z-[1300] flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <div className="text-center" onClick={(e) => e.stopPropagation()}>
          <p style={{ color: '#6B6560' }}>未找到院校信息</p>
        </div>
      </div>
    );
  }

  const regionColor = REGION_COLORS[university.region] || '#C8A45C';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[1300] flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        padding: '24px',
      }}
      onClick={onClose}
    >
      {/* Previous/Next arrows */}
      {hasPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-[1310] w-10 h-10 rounded-full items-center justify-center transition-all duration-200 hover:scale-110 hidden lg:flex"
          style={{ backgroundColor: 'rgba(26,26,26,0.8)', color: '#2C2420' }}
          aria-label="上一所院校"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-[1310] w-10 h-10 rounded-full items-center justify-center transition-all duration-200 hover:scale-110 hidden lg:flex"
          style={{ backgroundColor: 'rgba(26,26,26,0.8)', color: '#2C2420' }}
          aria-label="下一所院校"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Modal container */}
      <motion.div
        initial={{ scale: 0.93, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
        }}
        className="relative w-full overflow-hidden grid"
        style={{
          backgroundColor: '#F5F0E8',
          border: '1px solid #E8E2D9',
          borderRadius: '20px',
          maxWidth: 960,
          maxHeight: '90vh',
          margin: '0 auto',
          gridTemplateRows: 'auto auto 1fr auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scroll progress bar */}
        <div
          className="absolute top-0 left-0 right-0 z-20 h-[2px]"
          style={{ backgroundColor: '#E8E2D9' }}
        >
          <div
            className="h-full transition-all duration-150"
            style={{
              width: `${scrollProgress * 100}%`,
              backgroundColor: '#C8A45C',
            }}
          />
        </div>

        {/* ====== Header ====== */}
        <div
          style={{
            backgroundColor: '#F5F0E8',
            borderBottom: '1px solid #E8E2D9',
            padding: '24px 32px',
          }}
        >
          {/* Top row: actions */}
          <div className="flex items-center justify-end gap-2 mb-4">
            {/* Share button */}
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `${university.name} - UniGuide`,
                    url: window.location.href,
                  }).catch(() => { /* ignore */ });
                } else if (navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href).catch(() => {});
                }
              }}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200"
              style={{ backgroundColor: '#F0EBE3' }}
              aria-label="分享"
            >
              <Share2 size={18} style={{ color: '#6B6560' }} />
            </button>

            {/* Bookmark */}
            <button
              onClick={() => onToggleBookmark(universityId)}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200"
              style={{ backgroundColor: '#F0EBE3' }}
              aria-label={isBookmarked ? '取消收藏' : '收藏'}
            >
              <motion.div
                animate={isBookmarked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Heart
                  size={18}
                  style={{
                    color: isBookmarked ? '#8B2332' : '#6B6560',
                    fill: isBookmarked ? '#8B2332' : 'none',
                  }}
                />
              </motion.div>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200 hover:bg-bg-elevated"
              style={{ backgroundColor: '#F0EBE3' }}
              aria-label="关闭"
            >
              <X size={20} style={{ color: '#6B6560' }} />
            </button>
          </div>

          {/* Title block */}
          <div>
            <h2
              className="font-space text-[28px] sm:text-[36px] font-normal tracking-tight"
              style={{ color: '#2C2420' }}
            >
              {university.name}
            </h2>
            <p className="text-[15px] mt-1" style={{ color: '#6B6560' }}>
              {university.name_en}
            </p>

            {/* Quick info row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Abbreviation */}
              {university.abbreviation && (
                <span
                  className="text-[11px] font-mono px-2.5 py-0.5 rounded-md"
                  style={{
                    backgroundColor: 'rgba(200,164,92,0.15)',
                    color: '#C8A45C',
                  }}
                >
                  {university.abbreviation}
                </span>
              )}

              {/* Region badge */}
              <span
                className="text-[11px] font-medium px-2.5 py-1 rounded-md"
                style={{
                  backgroundColor: `${regionColor}20`,
                  color: regionColor,
                }}
              >
                {university.region === '艺术' ? '艺术院校' : university.region}
              </span>

              {/* Ranking badge */}
              {university.ranking?.qs && (
                <span
                  className="text-[14px] font-mono px-2.5 py-1 rounded-md"
                  style={{ backgroundColor: '#F0EBE3', color: '#C8A45C' }}
                >
                  QS #{university.ranking.qs}
                </span>
              )}

              {/* School type */}
              {university.school_type && (
                <span className="text-[11px]" style={{ color: '#6B6560' }}>
                  {university.school_type}
                </span>
              )}

              {/* Portfolio badge */}
              {university.admission?.portfolio_required === true && (
                <span
                  className="text-[11px] px-2.5 py-1 rounded-md flex items-center gap-1 border"
                  style={{ color: '#8B2332', borderColor: '#8B233240' }}
                >
                  <Palette size={12} />
                  需要作品集
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ====== Tab Navigation ====== */}
        <div
          className="overflow-x-auto"
          style={{
            backgroundColor: '#F5F0E8',
            borderBottom: '1px solid #E8E2D9',
            padding: '0 32px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
          <div className="flex scrollbar-hide" style={{ minWidth: 'max-content' }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="relative text-[15px] py-3.5 px-5 transition-colors duration-200 whitespace-nowrap"
                style={{
                  color: activeTab === tab.key ? '#2C2420' : '#6B6560',
                  fontWeight: activeTab === tab.key ? 500 : 400,
                }}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: '#C8A45C' }}
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 35,
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ====== Tab Content ====== */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="overflow-y-auto min-h-0"
          style={{ padding: '32px', scrollbarWidth: 'thin' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + universityId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
            >
              {activeTab === 'overview' && <OverviewTab u={university} />}
              {activeTab === 'admission' && <AdmissionTab u={university} />}
              {activeTab === 'majors' && <MajorsTab u={university} />}
              {activeTab === 'living' && (
                <LivingCostTab u={university} thirdParty={thirdParty as Record<string, unknown> | null} />
              )}
              {activeTab === 'facilities' && <FacilitiesTab u={university} />}
              {activeTab === 'career' && (
                <CareerTab u={university} thirdParty={thirdParty as Record<string, unknown> | null} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ====== Bottom Action Bar ====== */}
        <div
          style={{
            background: 'linear-gradient(to bottom, transparent, #F5F0E8 20px)',
            borderTop: '1px solid #E8E2D9',
            padding: '16px 32px',
          }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            {university.official_website && (
              <a
                href={university.official_website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[14px] font-medium px-5 py-2.5 rounded-lg transition-opacity duration-200 hover:opacity-90"
                style={{ backgroundColor: '#C8A45C', color: '#FAF7F2' }}
              >
                <ExternalLink size={16} />
                访问官网
              </a>
            )}
            <button
              onClick={() => onToggleBookmark(universityId)}
              className="inline-flex items-center gap-2 text-[14px] px-5 py-2.5 rounded-lg transition-all duration-200 border"
              style={{
                borderColor: '#C8A45C',
                color: isBookmarked ? '#8B2332' : '#C8A45C',
                backgroundColor: 'transparent',
              }}
            >
              <Heart
                size={16}
                style={{
                  fill: isBookmarked ? '#8B2332' : 'none',
                }}
              />
              {isBookmarked ? '已收藏' : '收藏'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
