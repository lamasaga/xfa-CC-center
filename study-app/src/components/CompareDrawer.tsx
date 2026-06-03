import { useState, useMemo, useCallback } from 'react';
import { useCompare } from '@/context/CompareContext';
import { useData } from '@/context/DataContext';
import type { University } from '@/context/DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Scale,
  Search,
  Plus,
  Trash2,
  Star,
  Globe,
  GraduationCap,
  Wallet,
  HomeIcon,
  Briefcase,
  Trophy,
  ChevronRight,
  Check,
  XCircle,
} from 'lucide-react';

/* ─── region colors ─── */
const REGION_COLORS: Record<string, string> = {
  us: '#3B6EA5',
  uk: '#8B2332',
  canada: '#C2553A',
  australia: '#4A7C6F',
  europe: '#6B4C8A',
  'hong-kong': '#C8553D',
  singapore: '#D4943A',
  art: '#C8A45C',
};

const REGION_NAMES: Record<string, string> = {
  us: '美国',
  uk: '英国',
  canada: '加拿大',
  australia: '澳大利亚',
  europe: '欧洲大陆',
  'hong-kong': '香港',
  singapore: '新加坡',
  art: '艺术院校',
};

/* ─── easing ─── */
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

/* ─── tabs ─── */
const TABS = [
  { key: 'basic', label: '基本信息', icon: Globe },
  { key: 'admission', label: '录取要求', icon: GraduationCap },
  { key: 'tuition', label: '专业学费', icon: Wallet },
  { key: 'living', label: '生活成本', icon: HomeIcon },
  { key: 'career', label: '职业前景', icon: Briefcase },
  { key: 'rankings', label: '排名数据', icon: Trophy },
];

const MOBILE_TAB_LABELS: Record<string, string> = {
  basic: '基本',
  admission: '录取',
  tuition: '学费',
  living: '生活',
  career: '职业',
  rankings: '排名',
};

/* ─── helpers ─── */
function getRegionColor(uni: University) {
  if (uni.is_art_school) return REGION_COLORS.art;
  return REGION_COLORS[uni.region] || '#C8A45C';
}

function getRegionName(uni: University) {
  if (uni.is_art_school) return '艺术院校';
  return REGION_NAMES[uni.region] || uni.region;
}

/* ─── mini components ─── */
function EmptySlot({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 flex items-center justify-center rounded-xl transition-all duration-200 hover:border-accent-gold hover:text-text-secondary"
      style={{
        width: 180,
        height: 56,
        border: '2px dashed #E8E2D9',
        color: '#6B6560',
      }}
    >
      <Plus size={16} className="mr-1" />
      <span className="text-[13px]">添加</span>
    </button>
  );
}

function FilledSlot({
  uni,
  onRemove,
}: {
  uni: University;
  onRemove: () => void;
}) {
  const color = getRegionColor(uni);
  return (
    <motion.div
      layout
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-2"
      style={{
        width: 180,
        height: 56,
        backgroundColor: '#F0EBE3',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium truncate" style={{ color: '#2C2420' }}>
          {uni.name}
        </p>
        <p className="text-[11px] truncate" style={{ color: '#6B6560' }}>
          {uni.name_en}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-1 rounded transition-colors duration-150 hover:bg-bg-surface"
        aria-label={`移除 ${uni.name}`}
      >
        <X size={14} style={{ color: '#6B6560' }} className="hover:text-accent-crimson transition-colors" />
      </button>
    </motion.div>
  );
}

/* ─── University Picker ─── */
function UniversityPicker({
  onSelect,
  onClose,
}: {
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { universities } = useData();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return universities;
    return universities.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.name_en.toLowerCase().includes(q) ||
        u.city?.toLowerCase().includes(q)
    );
  }, [universities, search]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50"
      style={{
        backgroundColor: '#F5F0E8',
        border: '1px solid #E8E2D9',
        maxHeight: 320,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}
    >
      <div className="p-3" style={{ borderBottom: '1px solid #E8E2D9' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0EBE3' }}>
          <Search size={14} style={{ color: '#6B6560' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索院校..."
            className="flex-1 bg-transparent text-[13px] outline-none"
            style={{ color: '#2C2420' }}
            autoFocus
          />
        </div>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
        {filtered.map((u) => (
          <button
            key={u.id}
            onClick={() => {
              onSelect(u.id);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-bg-elevated text-left"
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getRegionColor(u) }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] truncate" style={{ color: '#2C2420' }}>
                {u.name}
              </p>
              <p className="text-[11px] truncate" style={{ color: '#6B6560' }}>
                {u.name_en}
              </p>
            </div>
            {u.ranking?.qs && (
              <span className="text-[11px] font-mono flex-shrink-0" style={{ color: '#C8A45C' }}>
                #{u.ranking.qs}
              </span>
            )}
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-[13px]" style={{ color: '#6B6560' }}>
            未找到匹配院校
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Comparison Tab Content ─── */
function ComparisonContent({
  activeTab,
  selectedUnis,
}: {
  activeTab: string;
  selectedUnis: University[];
}) {
  const colWidth = Math.max(160, Math.floor(100 / selectedUnis.length));

  switch (activeTab) {
    case 'basic':
      return <BasicInfoTab unis={selectedUnis} colWidth={colWidth} />;
    case 'admission':
      return <AdmissionTab unis={selectedUnis} colWidth={colWidth} />;
    case 'tuition':
      return <TuitionTab unis={selectedUnis} colWidth={colWidth} />;
    case 'living':
      return <LivingCostTab unis={selectedUnis} colWidth={colWidth} />;
    case 'career':
      return <CareerTab unis={selectedUnis} colWidth={colWidth} />;
    case 'rankings':
      return <RankingsTab unis={selectedUnis} colWidth={colWidth} />;
    default:
      return null;
  }
}

/* ─── Row component ─── */
function Row({
  label,
  children,
  highlight = false,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex items-stretch"
      style={{
        borderBottom: '1px solid #E8E2D9',
        backgroundColor: highlight ? 'rgba(200, 164, 92, 0.05)' : 'transparent',
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-end px-4 py-3 text-right"
        style={{
          width: 120,
          minWidth: 120,
          position: 'sticky',
          left: 0,
          backgroundColor: highlight ? '#F5F0E8' : '#F5F0E8',
          zIndex: 10,
        }}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#6B6560' }}>
          {label}
        </span>
      </div>
      <div className="flex flex-1 min-w-0">{children}</div>
    </div>
  );
}

function Cell({
  children,
  width,
  best = false,
  muted = false,
}: {
  children: React.ReactNode;
  width: number;
  best?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-center px-3 py-3 text-center flex-shrink-0"
      style={{
        width: `${width}%`,
        minWidth: 140,
        borderLeft: '1px solid #E8E2D9',
      }}
    >
      <span
        className="text-[13px] leading-relaxed"
        style={{
          color: best ? '#C8A45C' : muted ? '#6B6560' : '#2C2420',
          fontWeight: best ? 500 : 400,
        }}
      >
        {best && <Star size={10} className="inline mr-1 -mt-0.5" />}
        {children}
      </span>
    </div>
  );
}

/* ─── Tab: Basic Info ─── */
function BasicInfoTab({
  unis,
  colWidth,
}: {
  unis: University[];
  colWidth: number;
}) {
  return (
    <div>
      <Row label="中文名">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            <span className="font-medium">{u.name}</span>
          </Cell>
        ))}
      </Row>
      <Row label="英文名">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            <span className="text-[12px] uppercase" style={{ color: '#6B6560' }}>
              {u.name_en}
            </span>
          </Cell>
        ))}
      </Row>
      <Row label="所在地区">
        {unis.map((u) => {
          const color = getRegionColor(u);
          const name = getRegionName(u);
          return (
            <Cell key={u.id} width={colWidth}>
              <span
                className="text-[12px] font-medium px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {name}
              </span>
            </Cell>
          );
        })}
      </Row>
      <Row label="城市">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {u.city || '-'}
          </Cell>
        ))}
      </Row>
      <Row label="国家">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {u.country || '-'}
          </Cell>
        ))}
      </Row>
      <Row label="学校类型">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {u.is_art_school ? '艺术院校' : u.school_type === 'private' ? '私立' : u.school_type === 'public' ? '公立' : '综合大学'}
          </Cell>
        ))}
      </Row>
    </div>
  );
}

/* ─── Tab: Admission ─── */
function AdmissionTab({
  unis,
  colWidth,
}: {
  unis: University[];
  colWidth: number;
}) {
  /* Find best (lowest) acceptance rate */
  const parseRate = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const m = v.match(/[\d.]+/);
      return m ? parseFloat(m[0]) : Infinity;
    }
    return Infinity;
  };
  const acceptanceRates = unis
    .map((u) => parseRate(u.admission?.acceptance_rate))
    .filter((v) => v !== Infinity);
  const lowestAcceptance = acceptanceRates.length > 0 ? Math.min(...acceptanceRates) : undefined;

  return (
    <div>
      <Row label="A-Level">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {u.admission?.a_level || '-'}
          </Cell>
        ))}
      </Row>
      <Row label="雅思">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {u.admission?.ielts || '-'}
          </Cell>
        ))}
      </Row>
      <Row label="托福">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {u.admission?.toefl || '-'}
          </Cell>
        ))}
      </Row>
      <Row label="录取率">
        {unis.map((u) => {
          const rateRaw = u.admission?.acceptance_rate;
          const rateNum = parseRate(rateRaw);
          const rateStr = typeof rateRaw === 'string' ? rateRaw : typeof rateRaw === 'number' ? `${rateRaw}%` : undefined;
          const isHardest = rateNum !== Infinity && rateNum === lowestAcceptance && unis.length > 1;
          return (
            <Cell key={u.id} width={colWidth} best={isHardest} muted={rateNum === Infinity}>
              {rateStr !== undefined ? (
                <div className="flex items-center gap-2">
                  <div
                    className="w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0"
                    style={{ backgroundColor: '#F0EBE3' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(rateNum * 2, 100)}%`,
                        backgroundColor: isHardest ? '#8B2332' : '#4A7C6F',
                      }}
                    />
                  </div>
                  <span>{rateStr}</span>
                </div>
              ) : (
                '-'
              )}
            </Cell>
          );
        })}
      </Row>
      <Row label="作品集">
        {unis.map((u) => {
          const required = u.admission?.portfolio_required;
          return (
            <Cell key={u.id} width={colWidth}>
              {required ? (
                <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: '#8B2332' }}>
                  <Check size={12} /> 需要
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: '#6B6560' }}>
                  <XCircle size={12} /> 不需要
                </span>
              )}
            </Cell>
          );
        })}
      </Row>
    </div>
  );
}

/* ─── Tab: Tuition ─── */
function TuitionTab({
  unis,
  colWidth,
}: {
  unis: University[];
  colWidth: number;
}) {
  const amounts = unis
    .map((u) => u.tuition?.amount)
    .filter((v): v is number => v !== undefined);
  const lowestTuition = amounts.length > 0 ? Math.min(...amounts) : undefined;

  return (
    <div>
      <Row label="学费/年">
        {unis.map((u) => {
          const amount = u.tuition?.amount;
          const isBest = amount !== undefined && amount === lowestTuition && unis.length > 1;
          return (
            <Cell key={u.id} width={colWidth} best={isBest} muted={!amount}>
              {amount !== undefined ? `$${amount.toLocaleString()}` : '-'}
            </Cell>
          );
        })}
      </Row>
      <Row label="货币">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth} muted>
            {u.tuition?.currency || 'USD'}
          </Cell>
        ))}
      </Row>
      <Row label="热门专业">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            <div className="flex flex-wrap gap-1 justify-center">
              {(u.majors || []).slice(0, 4).map((m) => (
                <span
                  key={m}
                  className="text-[10px] px-2 py-0.5 rounded"
                  style={{ backgroundColor: '#F0EBE3', color: '#6B6560' }}
                >
                  {m}
                </span>
              ))}
              {(u.majors || []).length === 0 && '-'}
            </div>
          </Cell>
        ))}
      </Row>
    </div>
  );
}

/* ─── Tab: Living Cost ─── */
function LivingCostTab({
  unis,
  colWidth,
}: {
  unis: University[];
  colWidth: number;
}) {
  return (
    <div>
      <Row label="所在城市">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {u.city || '-'}
          </Cell>
        ))}
      </Row>
      <Row label="国家">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {u.country || '-'}
          </Cell>
        ))}
      </Row>
      <Row label="城市规模">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth} muted>
            {'city_type' in (u as Record<string, unknown>)
              ? String((u as Record<string, unknown>).city_type || '-')
              : '-'}
          </Cell>
        ))}
      </Row>
    </div>
  );
}

/* ─── Tab: Career ─── */
function CareerTab({
  unis,
  colWidth,
}: {
  unis: University[];
  colWidth: number;
}) {
  return (
    <div>
      <Row label="院校">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            <span className="font-medium text-[12px]">{u.name}</span>
          </Cell>
        ))}
      </Row>
      <Row label="专业数量">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {(u.majors || []).length} 个
          </Cell>
        ))}
      </Row>
      <Row label="作品集要求">
        {unis.map((u) => (
          <Cell key={u.id} width={colWidth}>
            {u.admission?.portfolio_required ? (
              <span style={{ color: '#8B2332' }}>需要作品集</span>
            ) : (
              <span style={{ color: '#6B6560' }}>不需要</span>
            )}
          </Cell>
        ))}
      </Row>
    </div>
  );
}

/* ─── Tab: Rankings ─── */
function RankingsTab({
  unis,
  colWidth,
}: {
  unis: University[];
  colWidth: number;
}) {
  /* Find best (lowest) QS rank */
  const qsRanks = unis
    .map((u) => u.ranking?.qs)
    .filter((v): v is number => v !== undefined);
  const bestQs = qsRanks.length > 0 ? Math.min(...qsRanks) : undefined;

  /* Find best US News */
  const usRanks = unis
    .map((u) => u.ranking?.us_news)
    .filter((v): v is number => v !== undefined);
  const bestUs = usRanks.length > 0 ? Math.min(...usRanks) : undefined;

  /* Find best THE */
  const theRanks = unis
    .map((u) => u.ranking?.the)
    .filter((v): v is number => v !== undefined);
  const bestThe = theRanks.length > 0 ? Math.min(...theRanks) : undefined;

  return (
    <div>
      <Row label="QS排名">
        {unis.map((u) => {
          const rank = u.ranking?.qs;
          const isBest = rank !== undefined && rank === bestQs && unis.length > 1;
          return (
            <Cell key={u.id} width={colWidth} best={isBest} muted={!rank}>
              <span className="font-mono text-lg">{rank ? `#${rank}` : '-'}</span>
            </Cell>
          );
        })}
      </Row>
      <Row label="US News">
        {unis.map((u) => {
          const rank = u.ranking?.us_news;
          const isBest = rank !== undefined && rank === bestUs && unis.length > 1;
          return (
            <Cell key={u.id} width={colWidth} best={isBest} muted={!rank}>
              <span className="font-mono">{rank ? `#${rank}` : '-'}</span>
            </Cell>
          );
        })}
      </Row>
      <Row label="THE排名">
        {unis.map((u) => {
          const rank = u.ranking?.the;
          const isBest = rank !== undefined && rank === bestThe && unis.length > 1;
          return (
            <Cell key={u.id} width={colWidth} best={isBest} muted={!rank}>
              <span className="font-mono">{rank ? `#${rank}` : '-'}</span>
            </Cell>
          );
        })}
      </Row>
    </div>
  );
}

/* ═════════════════════════════ MAIN DRAWER ═════════════════════════════ */
export default function CompareDrawer() {
  const { isDrawerOpen, setDrawerOpen, compareIds, removeFromCompare, addToCompare, clearCompare } = useCompare();
  const { universities } = useData();
  const [activeTab, setActiveTab] = useState('basic');
  const [showPicker, setShowPicker] = useState(false);

  const selectedUnis = useMemo(
    () => universities.filter((u) => compareIds.includes(u.id)),
    [universities, compareIds]
  );

  const handleAddFromPicker = useCallback(
    (id: string) => {
      if (compareIds.length < 4) {
        addToCompare(id);
      }
    },
    [compareIds.length, addToCompare]
  );

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[1400] flex justify-end">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setDrawerOpen(false)}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.5, ease: EASE }}
            className="relative w-full sm:w-[680px] lg:w-[900px] flex flex-col"
            style={{
              backgroundColor: '#F5F0E8',
              borderLeft: '1px solid #E8E2D9',
              height: '100dvh',
            }}
          >
            {/* ═══ Header ═══ */}
            <div
              className="flex-shrink-0 flex items-center justify-between px-6"
              style={{
                height: 64,
                borderBottom: '1px solid #E8E2D9',
              }}
            >
              <div className="flex items-center gap-3">
                <h2
                  className="font-space text-xl font-medium"
                  style={{ color: '#2C2420' }}
                >
                  院校对比
                </h2>
                <span className="text-[11px]" style={{ color: '#6B6560' }}>
                  最多4所
                </span>
              </div>
              <div className="flex items-center gap-2">
                {compareIds.length > 0 && (
                  <button
                    onClick={clearCompare}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg transition-colors duration-200 hover:bg-bg-elevated"
                    style={{ color: '#6B6560' }}
                  >
                    <Trash2 size={13} />
                    清空
                  </button>
                )}
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg transition-colors duration-200 hover:bg-bg-elevated"
                  aria-label="关闭"
                >
                  <X size={20} style={{ color: '#6B6560' }} />
                </button>
              </div>
            </div>

            {/* ═══ University Selector Row ═══ */}
            <div
              className="flex-shrink-0 px-6 py-3 relative"
              style={{
                backgroundColor: '#FFFFFF',
                borderBottom: '1px solid #E8E2D9',
              }}
            >
              <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                <AnimatePresence mode="popLayout">
                  {selectedUnis.map((uni) => (
                    <FilledSlot
                      key={uni.id}
                      uni={uni}
                      onRemove={() => removeFromCompare(uni.id)}
                    />
                  ))}
                </AnimatePresence>
                {Array.from({ length: Math.max(0, 4 - selectedUnis.length) }).map((_, i) => (
                  <EmptySlot
                    key={`empty-${i}`}
                    onClick={() => {
                      if (selectedUnis.length < 4) {
                        setShowPicker(true);
                      }
                    }}
                  />
                ))}
              </div>

              {/* University picker dropdown */}
              <AnimatePresence>
                {showPicker && (
                  <UniversityPicker
                    onSelect={handleAddFromPicker}
                    onClose={() => setShowPicker(false)}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* ═══ Tabs ═══ */}
            <div
              className="flex-shrink-0 flex items-center px-4 gap-1 overflow-x-auto"
              style={{
                borderBottom: '1px solid #E8E2D9',
                backgroundColor: '#F5F0E8',
              }}
            >
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className="flex items-center gap-1.5 py-3 px-3 text-[12px] font-medium whitespace-nowrap transition-colors duration-200 relative flex-shrink-0"
                    style={{
                      color: isActive ? '#C8A45C' : '#6B6560',
                    }}
                  >
                    <Icon size={14} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{MOBILE_TAB_LABELS[tab.key]}</span>
                    {isActive && (
                      <motion.div
                        layoutId="compare-tab-indicator"
                        className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                        style={{ backgroundColor: '#C8A45C' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ═══ Content Area ═══ */}
            <div className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F5F0E8' }}>
              <AnimatePresence mode="wait">
                {selectedUnis.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full px-6"
                    style={{ minHeight: 400 }}
                  >
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
                      style={{ backgroundColor: '#F0EBE3' }}
                    >
                      <Scale size={32} style={{ color: '#6B6560' }} />
                    </div>
                    <p
                      className="text-base font-medium mb-2"
                      style={{ color: '#2C2420' }}
                    >
                      请选择院校进行对比
                    </p>
                    <p
                      className="text-sm text-center mb-6"
                      style={{ color: '#6B6560', maxWidth: 300 }}
                    >
                      选择2-4所院校，从录取要求到职业前景全面比较
                    </p>
                    <button
                      onClick={() => setDrawerOpen(false)}
                      className="flex items-center gap-2 text-sm font-medium transition-colors duration-200 hover:text-text-primary"
                      style={{ color: '#C8A45C' }}
                    >
                      去浏览院校
                      <ChevronRight size={16} />
                    </button>
                  </motion.div>
                ) : selectedUnis.length === 1 ? (
                  <motion.div
                    key="partial"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-16 px-6"
                  >
                    <p
                      className="text-sm mb-4"
                      style={{ color: '#6B6560' }}
                    >
                      已选择 1 所院校，请至少再选 1 所进行对比
                    </p>
                    <div
                      className="flex items-center gap-2 text-sm cursor-pointer transition-colors duration-200 hover:text-text-primary"
                      style={{ color: '#C8A45C' }}
                      onClick={() => setShowPicker(true)}
                    >
                      <Plus size={16} />
                      添加院校
                    </div>

                    {/* Show single uni basic info */}
                    <div className="w-full mt-8 max-w-md">
                      <BasicInfoTab unis={selectedUnis} colWidth={100} />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`tab-${activeTab}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="overflow-x-auto"
                    style={{ minHeight: 300 }}
                  >
                    <div style={{ minWidth: selectedUnis.length * 140 + 120 }}>
                      {/* Column headers */}
                      <div className="flex" style={{ borderBottom: '2px solid #E8E2D9' }}>
                        <div
                          className="flex-shrink-0 flex items-center justify-end px-4 py-3"
                          style={{
                            width: 120,
                            minWidth: 120,
                            position: 'sticky',
                            left: 0,
                            backgroundColor: '#F5F0E8',
                            zIndex: 10,
                          }}
                        >
                          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#6B6560' }}>
                            对比项
                          </span>
                        </div>
                        <div className="flex flex-1 min-w-0">
                          {selectedUnis.map((uni) => {
                            const color = getRegionColor(uni);
                            return (
                              <div
                                key={uni.id}
                                className="flex items-center justify-center px-3 py-3 text-center flex-shrink-0"
                                style={{
                                  width: `${Math.max(140, Math.floor(100 / selectedUnis.length))}%`,
                                  minWidth: 140,
                                  borderLeft: '1px solid #E8E2D9',
                                  borderTop: `3px solid ${color}`,
                                }}
                              >
                                <span
                                  className="text-[13px] font-medium truncate"
                                  style={{ color: '#2C2420' }}
                                >
                                  {uni.name}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tab content */}
                      <ComparisonContent
                        activeTab={activeTab}
                        selectedUnis={selectedUnis}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
