import { useState, useMemo, useCallback } from 'react';
import { useData } from '@/context/DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell, RadarChart, PolarGrid, PolarAngleAxis,
  Radar, Legend,
} from 'recharts';
import { MapPin, Home, Utensils, Bus, ShoppingBag, TrendingUp, ChevronDown, Calculator } from 'lucide-react';

/* ── types ── */
interface CityCost {
  key: string;
  city: string;
  country: string;
  region: string;
  cost_index: number;
  rent_index: number;
  groceries_index: number;
  restaurant_index: number;
  rent_avg_1br: number;
  currency: string;
}

type Lifestyle = 'frugal' | 'moderate' | 'premium';
type Housing = 'dorm' | 'shared' | 'private' | 'homestay';

/* ── region helpers ── */
const REGION_COLORS: Record<string, string> = {
  美国: '#3B6EA5',
  英国: '#8B2332',
  加拿大: '#C2553A',
  澳大利亚: '#4A7C6F',
  欧洲: '#6B4C8A',
  亚洲: '#D4943A',
  瑞士: '#6B4C8A',
  荷兰: '#6B4C8A',
  德国: '#6B4C8A',
  法国: '#6B4C8A',
  丹麦: '#6B4C8A',
  瑞典: '#6B4C8A',
  爱尔兰: '#6B4C8A',
  意大利: '#6B4C8A',
  西班牙: '#6B4C8A',
  奥地利: '#6B4C8A',
  芬兰: '#6B4C8A',
  中国: '#C8553D',
  新加坡: '#D4943A',
};

function getRegion(country: string): string {
  const map: Record<string, string> = {
    美国: '美国', 英国: '英国', 加拿大: '加拿大', 澳大利亚: '澳大利亚',
    中国: '亚洲', 新加坡: '亚洲',
    瑞士: '欧洲', 荷兰: '欧洲', 德国: '欧洲', 法国: '欧洲',
    丹麦: '欧洲', 瑞典: '欧洲', 爱尔兰: '欧洲', 意大利: '欧洲',
    西班牙: '欧洲', 奥地利: '欧洲', 芬兰: '欧洲',
  };
  return map[country] || '其他';
}

function getColor(country: string): string {
  return REGION_COLORS[country] || REGION_COLORS[getRegion(country)] || '#6B6560';
}

const REGIONS = ['全部', '美国', '英国', '加拿大', '澳大利亚', '欧洲', '亚洲'];

/* ── lifestyle multipliers ── */
const HOUSING_MULTIPLIER: Record<Housing, number> = {
  dorm: 0.6,
  shared: 0.8,
  private: 1.0,
  homestay: 0.7,
};

const HOUSING_LABELS: Record<Housing, string> = {
  dorm: '学校宿舍',
  shared: '合租公寓',
  private: '独立一居',
  homestay: '家庭寄宿',
};

const LIFESTYLE_MULTIPLIER: Record<Lifestyle, number> = {
  frugal: 0.7,
  moderate: 1.0,
  premium: 1.5,
};

const LIFESTYLE_LABELS: Record<Lifestyle, string> = {
  frugal: '节俭型',
  moderate: '普通型',
  premium: '宽裕型',
};

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

/* ── custom tooltip ── */
function CostTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: CityCost }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#F0EBE3', border: '1px solid #E8E2D9' }}>
      <div className="font-medium mb-1" style={{ color: '#2C2420' }}>{d.city} · {d.country}</div>
      <div style={{ color: '#6B6560' }}>生活成本指数: <span style={{ color: '#C8A45C' }}>{d.cost_index.toFixed(1)}</span></div>
      <div style={{ color: '#6B6560' }}>租金指数: <span style={{ color: '#C8A45C' }}>{d.rent_index.toFixed(1)}</span></div>
      <div style={{ color: '#6B6560' }}>食品指数: <span style={{ color: '#C8A45C' }}>{d.groceries_index.toFixed(1)}</span></div>
      <div style={{ color: '#6B6560' }}>餐饮指数: <span style={{ color: '#C8A45C' }}>{d.restaurant_index.toFixed(1)}</span></div>
      <div style={{ color: '#6B6560' }}>一居室租金: <span style={{ color: '#C8A45C' }}>{d.currency} {d.rent_avg_1br.toLocaleString()}</span></div>
    </div>
  );
}

/* ── number counter ── */
function AnimatedNumber({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="font-mono-data"
    >
      {prefix}{value.toLocaleString()}{suffix}
    </motion.span>
  );
}

/* ── main component ── */
export default function LivingCost() {
  const { thirdParty, loading } = useData();
  const [selectedRegion, setSelectedRegion] = useState('全部');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [calcCity, setCalcCity] = useState<string>('new_york');
  const [housing, setHousing] = useState<Housing>('shared');
  const [lifestyle, setLifestyle] = useState<Lifestyle>('moderate');
  const [duration, setDuration] = useState<3 | 4>(4);
  const [compareCities, setCompareCities] = useState<string[]>([]);

  /* parse cities data */
  const cities: CityCost[] = useMemo(() => {
    if (!thirdParty?.cities_living_costs) return [];
    const raw = thirdParty.cities_living_costs as Record<string, Record<string, unknown>>;
    return Object.entries(raw).map(([key, val]) => ({
      key,
      city: val.city as string,
      country: val.country as string,
      region: getRegion(val.country as string),
      cost_index: (val.cost_index as number) ?? 0,
      rent_index: (val.rent_index as number) ?? 0,
      groceries_index: (val.groceries_index as number) ?? 0,
      restaurant_index: (val.restaurant_index as number) ?? 0,
      rent_avg_1br: (val.rent_avg_1br as number) ?? 0,
      currency: (val.currency as string) ?? 'USD',
    })).sort((a, b) => b.cost_index - a.cost_index);
  }, [thirdParty]);

  const filteredCities = useMemo(() => {
    if (selectedRegion === '全部') return cities;
    if (selectedRegion === '亚洲') return cities.filter(c => c.country === '中国' || c.country === '新加坡');
    return cities.filter(c => c.region === selectedRegion);
  }, [cities, selectedRegion]);

  const cityMap = useMemo(() => {
    const map = new Map<string, CityCost>();
    cities.forEach(c => map.set(c.key, c));
    return map;
  }, [cities]);

  const selectedCityData = selectedCity ? cityMap.get(selectedCity) || null : null;
  const calcCityData = cityMap.get(calcCity);

  /* budget calculation */
  const budget = useMemo(() => {
    if (!calcCityData) return null;
    const rent = calcCityData.rent_avg_1br * HOUSING_MULTIPLIER[housing];
    const food = 400 * LIFESTYLE_MULTIPLIER[lifestyle] * (calcCityData.groceries_index / 100);
    const transport = 100 * LIFESTYLE_MULTIPLIER[lifestyle] * (calcCityData.cost_index / 100);
    const entertainment = 200 * LIFESTYLE_MULTIPLIER[lifestyle] * (calcCityData.restaurant_index / 100);
    const others = 150 * (calcCityData.cost_index / 100);
    const monthly = rent + food + transport + entertainment + others;
    return { rent, food, transport, entertainment, others, monthly, annual: monthly * 12 };
  }, [calcCityData, housing, lifestyle]);

  const compareData = useMemo(() => {
    return compareCities.map(k => cityMap.get(k)).filter(Boolean) as CityCost[];
  }, [compareCities, cityMap]);

  const toggleCompare = useCallback((key: string) => {
    setCompareCities(prev => prev.includes(key) ? prev.filter(k => k !== key) : prev.length < 3 ? [...prev, key] : prev);
  }, []);

  /* regional averages */
  const regionAverages = useMemo(() => {
    const groups: Record<string, CityCost[]> = {};
    cities.forEach(c => {
      const r = c.region;
      if (!groups[r]) groups[r] = [];
      groups[r].push(c);
    });
    return Object.entries(groups).map(([region, list]) => ({
      region,
      count: list.length,
      avgCost: list.reduce((s, c) => s + c.cost_index, 0) / list.length,
      avgRent: list.reduce((s, c) => s + c.rent_index, 0) / list.length,
      avgRent1br: list.reduce((s, c) => s + c.rent_avg_1br, 0) / list.length,
      maxCity: list.reduce((a, c) => c.cost_index > a.cost_index ? c : a, list[0]),
      minCity: list.reduce((a, c) => c.cost_index < a.cost_index ? c : a, list[0]),
      color: getColor(region === '亚洲' ? '中国' : region),
    })).sort((a, b) => b.avgCost - a.avgCost);
  }, [cities]);

  /* radar data */
  const radarData = useMemo(() => {
    const metrics = ['cost_index', 'rent_index', 'groceries_index', 'restaurant_index', 'rent_1br_norm'];
    const labels = ['生活成本', '租金', '食品', '餐饮', '一居室租金'];
    return labels.map((label, i) => {
      const entry: Record<string, string | number> = { metric: label };
      regionAverages.forEach(r => {
        const citiesInRegion = cities.filter(c => c.region === r.region);
        if (i === 4) {
          const avg = citiesInRegion.reduce((s, c) => s + c.rent_avg_1br, 0) / citiesInRegion.length;
          entry[r.region] = Math.min((avg / 50) * 100, 100); // normalize
        } else {
          const avg = citiesInRegion.reduce((s, c) => s + (c[metrics[i] as keyof CityCost] as number || 0), 0) / citiesInRegion.length;
          entry[r.region] = Number(avg.toFixed(1));
        }
      });
      return entry;
    });
  }, [regionAverages, cities]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#C8A45C', borderTopColor: 'transparent' }} />
          <p style={{ color: '#6B6560' }}>加载生活成本数据...</p>
        </div>
      </div>
    );
  }

  const globalAvgCost = cities.length ? cities.reduce((s, c) => s + c.cost_index, 0) / cities.length : 0;

  return (
    <div className="min-h-full bg-background">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="pt-24 pb-8 px-6 md:px-10 max-w-[1400px] mx-auto"
      >
        <h1 className="font-display text-4xl md:text-5xl font-normal tracking-tight mb-3" style={{ color: '#2C2420', letterSpacing: '-0.02em' }}>
          留学生活成本指南
        </h1>
        <p className="text-base md:text-lg max-w-2xl" style={{ color: '#6B6560', lineHeight: 1.7 }}>
          基于 Numbeo 2025 数据，覆盖51个留学热门城市的生活成本指数，帮助您合理规划留学预算。
          <span style={{ color: '#6B6560' }}> 以纽约为基准（100）</span>
        </p>

        {/* Region filters */}
        <div className="flex flex-wrap gap-2 mt-6">
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => setSelectedRegion(r)}
              className="px-4 py-2 rounded-full text-sm font-medium transition-all duration-250"
              style={{
                backgroundColor: selectedRegion === r ? '#C8A45C' : '#F0EBE3',
                color: selectedRegion === r ? '#FAF7F2' : '#6B6560',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </motion.div>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20 space-y-12">
        {/* ── Section 1: Bar Chart ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl md:text-2xl font-medium" style={{ color: '#2C2420' }}>各城市生活成本指数</h2>
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>
              {filteredCities.length} 个城市
            </span>
          </div>
          <div className="rounded-[14px] p-4 md:p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
            <ResponsiveContainer width="100%" height={Math.max(400, filteredCities.length * 28)}>
              <BarChart
                data={filteredCities}
                layout="vertical"
                margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" horizontal={false} />
                <XAxis type="number" domain={[0, 110]} tick={{ fill: '#6B6560', fontSize: 11 }} axisLine={{ stroke: '#E8E2D9' }} />
                <YAxis
                  type="category"
                  dataKey="city"
                  tick={{ fill: '#6B6560', fontSize: 11 }}
                  axisLine={{ stroke: '#E8E2D9' }}
                  width={80}
                />
                <Tooltip content={<CostTooltip />} />
                <Bar
                  dataKey="cost_index"
                  radius={[0, 4, 4, 0]}
                  onClick={(_: unknown, index: number) => setSelectedCity(filteredCities[index]?.key || null)}
                  style={{ cursor: 'pointer' }}
                >
                  {filteredCities.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getColor(entry.country)}
                      fillOpacity={selectedCity === entry.key ? 1 : 0.75}
                      stroke={selectedCity === entry.key ? '#C8A45C' : 'none'}
                      strokeWidth={selectedCity === entry.key ? 2 : 0}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* ── Section 2: Scatter Plot ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>租金 vs 生活成本</h2>
          <div className="rounded-[14px] p-4 md:p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E2D9" />
                <XAxis
                  type="number"
                  dataKey="rent_index"
                  name="租金指数"
                  tick={{ fill: '#6B6560', fontSize: 11 }}
                  axisLine={{ stroke: '#E8E2D9' }}
                  label={{ value: '租金指数', position: 'insideBottomRight', offset: -10, fill: '#6B6560', fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="cost_index"
                  name="生活成本指数"
                  tick={{ fill: '#6B6560', fontSize: 11 }}
                  axisLine={{ stroke: '#E8E2D9' }}
                  label={{ value: '生活成本指数', angle: -90, position: 'insideLeft', fill: '#6B6560', fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="rent_avg_1br" range={[40, 400]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as CityCost;
                    return (
                      <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: '#F0EBE3', border: '1px solid #E8E2D9' }}>
                        <div className="font-medium" style={{ color: '#2C2420' }}>{d.city}</div>
                        <div style={{ color: '#6B6560' }}>租金指数: {d.rent_index.toFixed(1)}</div>
                        <div style={{ color: '#6B6560' }}>生活成本: {d.cost_index.toFixed(1)}</div>
                        <div style={{ color: '#6B6560' }}>一居室: {d.currency} {d.rent_avg_1br.toLocaleString()}</div>
                      </div>
                    );
                  }}
                />
                <Scatter data={filteredCities}>
                  {filteredCities.map((entry, index) => (
                    <Cell key={`sc-${index}`} fill={getColor(entry.country)} fillOpacity={0.8} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            {/* Quadrant labels */}
            <div className="flex justify-between mt-2 px-4">
              <span className="text-xs" style={{ color: '#6B6560' }}>低租金 · 高消费</span>
              <span className="text-xs" style={{ color: '#4A7C6F' }}>低租金 · 低消费</span>
            </div>
            <div className="flex justify-between px-4">
              <span className="text-xs" style={{ color: '#6B6560' }}>高租金 · 高消费</span>
              <span className="text-xs" style={{ color: '#6B6560' }}>高租金 · 低消费</span>
            </div>
          </div>
        </motion.section>

        {/* ── Section 3: City Detail Cards (top 12) ── */}
        <motion.section
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>热门留学城市生活详情</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {cities.slice(0, 12).map((city, i) => {
              const isMax = i === 0;
              const isMin = city.cost_index === cities[cities.length - 1].cost_index;
              return (
                <motion.div
                  key={city.key}
                  variants={cardVariants}
                  className="rounded-xl p-5 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E8E2D9',
                    borderTop: isMax ? '3px solid #8B2332' : isMin ? '3px solid #4A7C6F' : '1px solid #E8E2D9',
                  }}
                  onClick={() => setSelectedCity(city.key)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} style={{ color: getColor(city.country) }} />
                      <span className="font-medium" style={{ color: '#2C2420' }}>{city.city}</span>
                    </div>
                    <span className="text-xs" style={{ color: '#6B6560' }}>{city.country}</span>
                  </div>
                  {/* Cost meter */}
                  <div className="w-full h-2 rounded-full mb-3" style={{ backgroundColor: '#F0EBE3' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min((city.cost_index / 150) * 100, 100)}%` }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, #4A7C6F 0%, #D4943A 50%, #8B2332 100%)`,
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs mb-1" style={{ color: '#6B6560' }}>成本指数</div>
                      <div className="text-sm font-medium font-mono-data" style={{ color: '#C8A45C' }}>{city.cost_index.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: '#6B6560' }}>租金指数</div>
                      <div className="text-sm font-medium font-mono-data" style={{ color: '#2C2420' }}>{city.rent_index.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: '#6B6560' }}>食品指数</div>
                      <div className="text-sm font-medium" style={{ color: '#2C2420' }}>{city.groceries_index.toFixed(1)}</div>
                    </div>
                    <div>
                      <div className="text-xs mb-1" style={{ color: '#6B6560' }}>一居室租金</div>
                      <div className="text-sm font-medium" style={{ color: '#2C2420' }}>{city.currency} {city.rent_avg_1br.toLocaleString()}</div>
                    </div>
                  </div>
                  {selectedCity === city.key && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 pt-3 text-xs"
                      style={{ borderTop: '1px solid #E8E2D9', color: '#6B6560' }}
                    >
                      相比全球平均: {((city.cost_index - globalAvgCost) / globalAvgCost * 100).toFixed(1)}%
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Section 4: Budget Calculator ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="rounded-[14px] p-6 md:p-8"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Calculator size={22} style={{ color: '#C8A45C' }} />
            <h2 className="font-display text-xl md:text-2xl font-medium" style={{ color: '#2C2420' }}>留学预算估算器</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Inputs */}
            <div className="space-y-5">
              {/* City select */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#6B6560' }}>目标城市</label>
                <select
                  value={calcCity}
                  onChange={e => setCalcCity(e.target.value)}
                  className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
                  style={{ backgroundColor: '#F0EBE3', color: '#2C2420', border: '1px solid #E8E2D9' }}
                >
                  {cities.map(c => (
                    <option key={c.key} value={c.key}>{c.city} · {c.country}</option>
                  ))}
                </select>
              </div>

              {/* Housing type */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#6B6560' }}>住宿类型</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(HOUSING_LABELS) as Housing[]).map(h => (
                    <button
                      key={h}
                      onClick={() => setHousing(h)}
                      className="px-4 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: housing === h ? '#C8A45C' : '#F0EBE3',
                        color: housing === h ? '#FAF7F2' : '#6B6560',
                      }}
                    >
                      {HOUSING_LABELS[h]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lifestyle */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#6B6560' }}>生活方式</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(LIFESTYLE_LABELS) as Lifestyle[]).map(l => (
                    <button
                      key={l}
                      onClick={() => setLifestyle(l)}
                      className="px-4 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: lifestyle === l ? '#C8A45C' : '#F0EBE3',
                        color: lifestyle === l ? '#FAF7F2' : '#6B6560',
                      }}
                    >
                      {LIFESTYLE_LABELS[l]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#6B6560' }}>学制</label>
                <div className="flex gap-2">
                  {[3, 4].map(y => (
                    <button
                      key={y}
                      onClick={() => setDuration(y as 3 | 4)}
                      className="px-4 py-2 rounded-lg text-sm transition-all duration-200"
                      style={{
                        backgroundColor: duration === y ? '#C8A45C' : '#F0EBE3',
                        color: duration === y ? '#FAF7F2' : '#6B6560',
                      }}
                    >
                      {y}年
                    </button>
                  ))}
                </div>
              </div>

              {/* Compare cities */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#6B6560' }}>对比城市（最多3个）</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {cities.map(c => (
                    <button
                      key={c.key}
                      onClick={() => toggleCompare(c.key)}
                      className="px-3 py-1 rounded-md text-xs transition-all duration-200"
                      style={{
                        backgroundColor: compareCities.includes(c.key) ? getColor(c.country) : '#F0EBE3',
                        color: compareCities.includes(c.key) ? '#2C2420' : '#6B6560',
                      }}
                    >
                      {c.city}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Results */}
            <div>
              {budget && calcCityData && (
                <motion.div
                  key={`${calcCity}-${housing}-${lifestyle}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-5"
                >
                  {/* Total */}
                  <div className="rounded-xl p-5" style={{ backgroundColor: '#F5F0E8', border: '1px solid #E8E2D9' }}>
                    <div className="text-xs uppercase tracking-wider mb-1" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>每月总费用</div>
                    <div className="text-3xl font-mono-data font-medium" style={{ color: '#C8A45C' }}>
                      <AnimatedNumber value={Math.round(budget.monthly)} prefix={calcCityData.currency + ' '} />
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#6B6560' }}>
                      每年: <span style={{ color: '#2C2420' }}>{calcCityData.currency} {Math.round(budget.annual).toLocaleString()}</span>
                      {' · '}
                      {duration}年总费用: <span style={{ color: '#2C2420' }}>{calcCityData.currency} {Math.round(budget.annual * duration).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="space-y-3">
                    {[
                      { label: '住宿', icon: Home, value: budget.rent, color: '#3B6EA5' },
                      { label: '餐饮', icon: Utensils, value: budget.food, color: '#4A7C6F' },
                      { label: '交通', icon: Bus, value: budget.transport, color: '#6B4C8A' },
                      { label: '娱乐', icon: ShoppingBag, value: budget.entertainment, color: '#D4943A' },
                      { label: '其他', icon: TrendingUp, value: budget.others, color: '#6B6560' },
                    ].map(item => (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <item.icon size={14} style={{ color: item.color }} />
                            <span className="text-sm" style={{ color: '#6B6560' }}>{item.label}</span>
                          </div>
                          <span className="text-sm font-mono-data" style={{ color: '#2C2420' }}>
                            {calcCityData.currency} {Math.round(item.value).toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#F0EBE3' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.value / budget.monthly) * 100}%` }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Compare table */}
                  {compareData.length > 0 && (
                    <div className="mt-6 rounded-xl overflow-hidden" style={{ border: '1px solid #E8E2D9' }}>
                      <div className="px-4 py-3 text-sm font-medium" style={{ backgroundColor: '#F5F0E8', color: '#2C2420' }}>
                        城市对比
                      </div>
                      <div className="divide-y" style={{ borderColor: '#E8E2D9' }}>
                        {compareData.map(c => {
                          const cBudget = {
                            rent: c.rent_avg_1br * HOUSING_MULTIPLIER[housing],
                            food: 400 * LIFESTYLE_MULTIPLIER[lifestyle] * (c.groceries_index / 100),
                            transport: 100 * LIFESTYLE_MULTIPLIER[lifestyle] * (c.cost_index / 100),
                            entertainment: 200 * LIFESTYLE_MULTIPLIER[lifestyle] * (c.restaurant_index / 100),
                            others: 150 * (c.cost_index / 100),
                          };
                          const cMonthly = Object.values(cBudget).reduce((s, v) => s + v, 0);
                          return (
                            <div key={c.key} className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#FFFFFF' }}>
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getColor(c.country) }} />
                                <span className="text-sm" style={{ color: '#2C2420' }}>{c.city}</span>
                              </div>
                              <span className="text-sm font-mono-data" style={{ color: '#C8A45C' }}>{c.currency} {Math.round(cMonthly).toLocaleString()}/月</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>
        </motion.section>

        {/* ── Section 5: Regional Radar Chart ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>地区生活成本对比</h2>
          <div className="rounded-[14px] p-4 md:p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
            <ResponsiveContainer width="100%" height={450}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E8E2D9" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#6B6560', fontSize: 11 }} />
                {regionAverages.map(r => (
                  <Radar
                    key={r.region}
                    name={r.region}
                    dataKey={r.region}
                    stroke={r.color}
                    fill={r.color}
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                ))}
                <Legend
                  wrapperStyle={{ color: '#6B6560', fontSize: 12 }}
                  formatter={(value: string) => <span style={{ color: '#6B6560' }}>{value}</span>}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Regional averages table */}
          <div className="mt-6 rounded-xl overflow-hidden" style={{ border: '1px solid #E8E2D9' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F5F0E8' }}>
                    {['地区', '城市数', '平均成本指数', '平均租金指数', '平均租金', '最贵城市', '最便宜城市'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: '#E8E2D9' }}>
                  {regionAverages.map(r => (
                    <motion.tr
                      key={r.region}
                      whileHover={{ backgroundColor: '#F0EBE3' }}
                      className="transition-colors cursor-pointer"
                      style={{ backgroundColor: '#FFFFFF' }}
                      onClick={() => setSelectedRegion(r.region === '亚洲' ? '亚洲' : r.region)}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: '#2C2420' }}>
                        <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: r.color }} />
                        {r.region}
                      </td>
                      <td className="px-4 py-3 font-mono-data" style={{ color: '#6B6560' }}>{r.count}</td>
                      <td className="px-4 py-3 font-mono-data" style={{ color: '#C8A45C' }}>{r.avgCost.toFixed(1)}</td>
                      <td className="px-4 py-3 font-mono-data" style={{ color: '#6B6560' }}>{r.avgRent.toFixed(1)}</td>
                      <td className="px-4 py-3" style={{ color: '#6B6560' }}>{r.avgRent1br.toLocaleString()}</td>
                      <td className="px-4 py-3" style={{ color: '#8B2332' }}>{r.maxCity.city}</td>
                      <td className="px-4 py-3" style={{ color: '#4A7C6F' }}>{r.minCity.city}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.section>

        {/* ── Selected City Detail Panel ── */}
        <AnimatePresence>
          {selectedCityData && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="rounded-xl p-6 sticky bottom-6"
              style={{ backgroundColor: '#F5F0E8', border: '1px solid #C8A45C', zIndex: 50 }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <MapPin size={20} style={{ color: '#C8A45C' }} />
                  <div>
                    <span className="text-lg font-medium" style={{ color: '#2C2420' }}>{selectedCityData.city}</span>
                    <span className="text-sm ml-2" style={{ color: '#6B6560' }}>{selectedCityData.country}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedCity(null)}
                  className="p-1 rounded-lg transition-colors hover:bg-bg-elevated"
                  style={{ color: '#6B6560' }}
                >
                  <ChevronDown size={20} className="rotate-180" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg p-3" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="text-xs mb-1" style={{ color: '#6B6560' }}>生活成本指数</div>
                  <div className="text-xl font-mono-data" style={{ color: '#C8A45C' }}>{selectedCityData.cost_index.toFixed(1)}</div>
                  <div className="text-xs" style={{ color: selectedCityData.cost_index > globalAvgCost ? '#8B2332' : '#4A7C6F' }}>
                    {((selectedCityData.cost_index - globalAvgCost) / globalAvgCost * 100).toFixed(1)}% vs 全球平均
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="text-xs mb-1" style={{ color: '#6B6560' }}>月租金范围</div>
                  <div className="text-sm" style={{ color: '#2C2420' }}>
                    {selectedCityData.currency} {Math.round(selectedCityData.rent_avg_1br * 0.6).toLocaleString()} - {Math.round(selectedCityData.rent_avg_1br * 1.2).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="text-xs mb-1" style={{ color: '#6B6560' }}>预估月餐饮</div>
                  <div className="text-sm" style={{ color: '#2C2420' }}>
                    {selectedCityData.currency} {Math.round(400 * (selectedCityData.groceries_index / 100)).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="text-xs mb-1" style={{ color: '#6B6560' }}>预估月交通</div>
                  <div className="text-sm" style={{ color: '#2C2420' }}>
                    {selectedCityData.currency} {Math.round(100 * (selectedCityData.cost_index / 100)).toLocaleString()}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
