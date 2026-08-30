import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useData } from '@/context/DataContext';
import UniversityDetailModal from '@/components/UniversityDetailModal';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Heart,
  ChevronDown,
  SearchX,
  Palette,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getDifficultyColor,
  getDifficultyLabel,
  getDifficultySortValue,
  DIFFICULTY_TIERS,
  type AdmissionDifficultyTier,
} from '@/lib/admissionDifficulty';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SortOption =
  | 'qs_asc'
  | 'qs_desc'
  | 'tuition_asc'
  | 'tuition_desc'
  | 'difficulty_asc'
  | 'name_asc';

// Use index signature to access fields beyond base University type
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
  admission_difficulty?: number;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REGION_FILTERS = [
  { key: 'all', label: '全部' },
  { key: '美国', label: '美国' },
  { key: '英国', label: '英国' },
  { key: '加拿大', label: '加拿大' },
  { key: '澳大利亚', label: '澳大利亚' },
  { key: '欧洲', label: '欧洲' },
  { key: '香港', label: '香港' },
  { key: '新加坡', label: '新加坡' },
  { key: '艺术', label: '艺术院校' },
] as const;

const SCHOOL_TYPES = [
  { key: 'all', label: '全部类型' },
  { key: 'comprehensive', label: '综合大学' },
  { key: 'art', label: '艺术院校' },
] as const;

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'qs_asc', label: 'QS排名 ↑' },
  { key: 'qs_desc', label: 'QS排名 ↓' },
  { key: 'tuition_asc', label: '学费 ↑' },
  { key: 'tuition_desc', label: '学费 ↓' },
  { key: 'difficulty_asc', label: '录取难度 ↑' },
  { key: 'name_asc', label: '学校名称 A-Z' },
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

function formatCurrency(
  amount: unknown,
  currency: unknown
): string {
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

/* ------------------------------------------------------------------ */
/*  Difficulty Ladder (Sidebar)                                        */
/* ------------------------------------------------------------------ */

function DifficultyLadder({
  activeTier,
  onSelectTier,
  universityCountByTier,
}: {
  activeTier: AdmissionDifficultyTier | null;
  onSelectTier: (tier: AdmissionDifficultyTier | null) => void;
  universityCountByTier: Record<number, number>;
}) {
  const [hoveredTier, setHoveredTier] = useState<AdmissionDifficultyTier | null>(null);
  const tiers = [1, 2, 3, 4, 5] as AdmissionDifficultyTier[];

  return (
    <div
      className="hidden xl:flex flex-col h-fit sticky top-6"
      style={{ width: 280 }}
    >
      <h3
        className="text-[17px] font-medium mb-4 flex items-center gap-2"
        style={{ color: '#2C2420' }}
      >
        <span
          className="inline-block w-1 h-4 rounded-full"
          style={{ backgroundColor: '#C8A45C' }}
        />
        留学申请难度天梯
      </h3>

      <div className="flex flex-col gap-2">
        {tiers.map((tierNum, idx) => {
          const info = DIFFICULTY_TIERS[tierNum];
          const isActive = activeTier === tierNum;
          const isHovered = hoveredTier === tierNum;
          const count = universityCountByTier[tierNum] ?? 0;
          // Pyramid width: tier 1 (hardest) narrowest, tier 5 widest
          const widthPercent = 60 + idx * 10;

          return (
            <div
              key={tierNum}
              className="relative flex flex-col items-center z-[60]"
              onMouseEnter={() => setHoveredTier(tierNum)}
              onMouseLeave={() => setHoveredTier(null)}
            >
              {/* Main tier bar */}
              <motion.button
                type="button"
                onClick={() => onSelectTier(isActive ? null : tierNum)}
                className="relative overflow-hidden rounded-lg text-left transition-all duration-200"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: isActive
                    ? info.color
                    : isHovered
                      ? `${info.color}18`
                      : '#F5F0E8',
                  border: `2px solid ${isActive ? info.color : isHovered ? info.color : '#E8E2D9'}`,
                  color: isActive ? '#FFFFFF' : info.color,
                  padding: '10px 14px',
                  cursor: 'pointer',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[13px] font-mono w-6 h-6 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : `${info.color}15`,
                        color: isActive ? '#FFFFFF' : info.color,
                      }}
                    >
                      {tierNum}
                    </span>
                    <span className="text-[15px] font-medium">{info.shortLabel}</span>
                  </div>
                  <span
                    className="text-[13px] px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : `${info.color}10`,
                    }}
                  >
                    {count} 所
                  </span>
                </div>

                {/* Mini progress bar showing relative count */}
                <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.15)' : '#E8E2D9' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: isActive ? '#FFFFFF' : info.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((count / 28) * 100, 100)}%` }}
                    transition={{ duration: 0.5, delay: idx * 0.05 }}
                  />
                </div>
              </motion.button>

              {/* Expanded detail panel on hover (left side) */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-0 right-full z-50 mr-2 rounded-lg shadow-xl overflow-hidden"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: `1px solid ${info.color}30`,
                      width: 260,
                    }}
                  >
                    <div className="p-4 space-y-3">
                      <div
                        className="text-[13px] font-medium px-2 py-1 rounded"
                        style={{ backgroundColor: `${info.color}10`, color: info.color }}
                      >
                        {info.fullLabel}
                      </div>
                      <div className="space-y-2">
                        <DetailRow label="A-Level" value={info.aLevel} />
                        <DetailRow label="语言" value={info.language} />
                        <DetailRow label="附加考试" value={info.additionalExams} />
                        <DetailRow label="竞赛/学术" value={info.competitions} />
                        <DetailRow label="课外活动" value={info.extracurriculars} />
                        <DetailRow label="面试" value={info.interview} />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectTier(isActive ? null : tierNum);
                        }}
                        className="w-full text-center text-[13px] py-2 rounded transition-colors"
                        style={{
                          backgroundColor: isActive ? info.color : `${info.color}10`,
                          color: isActive ? '#FFFFFF' : info.color,
                        }}
                      >
                        {isActive ? '取消筛选' : `查看该等级 ${count} 所院校`}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Reset button */}
      {activeTier && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => onSelectTier(null)}
          className="mt-3 text-[14px] text-center py-2 rounded-lg transition-colors"
          style={{ color: '#6B6560', backgroundColor: '#F0EBE3' }}
        >
          显示全部院校
        </motion.button>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-[12px] shrink-0 mt-0.5" style={{ color: '#6B6560', minWidth: 48 }}>
        {label}
      </span>
      <span className="text-[13px] leading-snug" style={{ color: '#2C2420' }}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  University Card                                                    */
/* ------------------------------------------------------------------ */

function UniversityCard({
  university,
  isBookmarked,
  onToggleBookmark,
  onClick,
  index,
}: {
  university: UniRecord;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onClick: (id: string) => void;
  index: number;
}) {
  const regionColor = REGION_COLORS[university.region] || '#C8A45C';
  const qsRank = university.ranking?.qs;

  const adm = university.admission || {};
  const aLevel = typeof adm.a_level === 'string' ? adm.a_level : '--';
  const difficultyLabel = getDifficultyLabel(university);
  const difficultyColor = getDifficultyColor(university);

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{
        duration: 0.22,
        delay: Math.min(index * 0.012, 0.18),
        ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
        layout: { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
      }}
      className="group cursor-pointer"
      onClick={() => onClick(university.id)}
    >
      <div
        className="relative overflow-hidden rounded-[14px] border transition-all"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: '#E8E2D9',
          boxShadow: '0 2px 8px rgba(44, 36, 32, 0.04), 0 0 1px rgba(44, 36, 32, 0.08)',
          transitionDuration: '350ms',
          transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Hover border change via data attribute */}
        <style>{`
          .group:hover > div {
            border-color: #C8A45C !important;
            box-shadow: 0 12px 40px rgba(44, 36, 32, 0.08), 0 4px 12px rgba(44, 36, 32, 0.05) !important;
            transform: translateY(-4px);
          }
        `}</style>

        {/* Image area */}
        <div
          className="relative overflow-hidden"
          style={{
            height: '220px',
            background: `linear-gradient(135deg, ${regionColor}15 0%, ${regionColor}05 50%, #FFFFFF 100%)`,
          }}
        >
          {/* Region color strip at top */}
          <div
            className="absolute top-0 left-0 right-0 z-20"
            style={{
              height: '4px',
              backgroundColor: university.is_art_school ? '#8B2332' : regionColor,
            }}
          />

          {/* School photo */}
          {university.image ? (
            <>
              <img
                src={university.image as string}
                alt={university.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[350ms] group-hover:scale-105"
                onError={(e) => {
                  // On error, hide the img and show the abbreviation fallback
                  (e.target as HTMLImageElement).style.display = 'none';
                  const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.uni-card-fallback');
                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                }}
              />
              {/* Refined gradient overlay */}
              <div
                className="absolute inset-0 z-[5] pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 25%, rgba(0,0,0,0) 82%, rgba(255,255,255,0.55) 92%, rgba(255,255,255,0.95) 100%)',
                }}
              />
            </>
          ) : null}

          {/* Abbreviation fallback (hidden by default when image exists) */}
          <div
            className="uni-card-fallback absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ display: university.image ? 'none' : 'flex' }}
          >
            <span
              className="font-mono text-[72px] font-normal"
              style={{ color: '#2C2420', opacity: 0.08 }}
            >
              {university.abbreviation || university.name_en?.slice(0, 3).toUpperCase()}
            </span>
          </div>

          {/* Bookmark button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(university.id);
            }}
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{ backgroundColor: 'rgba(10,10,10,0.6)' }}
            aria-label={isBookmarked ? '取消收藏' : '收藏'}
          >
            <motion.div
              animate={isBookmarked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Heart
                size={18}
                className="transition-colors"
                style={{
                  color: isBookmarked ? '#8B2332' : '#FFFFFF',
                  fill: isBookmarked ? '#8B2332' : 'none',
                }}
              />
            </motion.div>
          </button>
        </div>

        {/* Content area */}
        <div className="p-5">
          {/* Names */}
          <h3
            className="text-[18px] font-medium leading-tight truncate"
            style={{ color: '#2C2420' }}
          >
            {university.name}
          </h3>
          <p
            className="text-[11px] uppercase tracking-wider mt-1 truncate"
            style={{ color: '#6B6560' }}
          >
            {university.name_en}
          </p>

          {/* Region badge + ranking */}
          <div className="flex items-center gap-2 mt-3">
            <span
              className="inline-block text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: `${regionColor}20`,
                color: regionColor,
              }}
            >
              {university.region === '艺术' ? '艺术院校' : university.region}
            </span>
            {qsRank && (
              <span className="flex items-center gap-1">
                <span className="font-mono text-[20px] font-normal" style={{ color: '#C8A45C' }}>
                  {qsRank}
                </span>
                <span className="text-[11px]" style={{ color: '#6B6560' }}>
                  QS
                </span>
              </span>
            )}
          </div>

          {/* Divider */}
          <div className="my-3" style={{ borderTop: '1px solid #E8E2D9' }} />

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[11px] mb-0.5" style={{ color: '#6B6560' }}>
                A-Level
              </p>
              <p
                className="text-[13px] truncate"
                style={{ color: '#2C2420' }}
                title={aLevel}
              >
                {aLevel.split('（')[0]?.slice(0, 12) || '--'}
              </p>
            </div>
            <div>
              <p className="text-[11px] mb-0.5" style={{ color: '#6B6560' }}>
                录取难度
              </p>
              <p
                className="text-[13px] truncate font-medium"
                style={{ color: difficultyColor }}
                title={difficultyLabel}
              >
                {difficultyLabel}
              </p>
            </div>
            <div>
              <p className="text-[11px] mb-0.5" style={{ color: '#6B6560' }}>
                学费
              </p>
              <p className="text-[13px] truncate" style={{ color: '#2C2420' }}>
                {formatCurrency(
                  university.tuition?.amount,
                  university.tuition?.currency
                )}
              </p>
            </div>
          </div>

          {/* Major tags */}
          <div className="flex gap-1.5 mt-3 overflow-hidden">
            {(university.majors || []).slice(0, 3).map((major) => (
              <span
                key={major}
                className="shrink-0 text-[11px] px-2.5 py-1 rounded-md truncate max-w-[120px]"
                style={{ backgroundColor: '#F0EBE3', color: '#6B6560' }}
              >
                {major}
              </span>
            ))}
          </div>

          {/* Portfolio badge */}
          {adm.portfolio_required === true && (
            <div className="flex items-center gap-1 mt-2">
              <Palette size={12} style={{ color: '#8B2332' }} />
              <span className="text-[11px]" style={{ color: '#8B2332' }}>
                作品集导向
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Explore Page                                                  */
/* ------------------------------------------------------------------ */

export default function Explore() {
  const { universities, loading } = useData();
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['all']);
  const [selectedSchoolType, setSelectedSchoolType] = useState<string>('all');
  const [portfolioOnly, setPortfolioOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('qs_asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('uniguide_bookmarks');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedDifficultyTier, setSelectedDifficultyTier] = useState<AdmissionDifficultyTier | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* Debounce search */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* Persist bookmarks */
  useEffect(() => {
    localStorage.setItem('uniguide_bookmarks', JSON.stringify([...bookmarks]));
  }, [bookmarks]);

  /* Close sort dropdown on outside click */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* Keyboard shortcut: / to focus search */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const toggleBookmark = useCallback((id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleRegion = useCallback((key: string) => {
    setSelectedRegions((prev) => {
      if (key === 'all') return ['all'];
      const withoutAll = prev.filter((k) => k !== 'all');
      if (withoutAll.includes(key)) {
        const next = withoutAll.filter((k) => k !== key);
        return next.length === 0 ? ['all'] : next;
      }
      return [...withoutAll, key];
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setSelectedRegions(['all']);
    setSelectedSchoolType('all');
    setPortfolioOnly(false);
    setSearchQuery('');
    setDebouncedSearch('');
    setSelectedDifficultyTier(null);
  }, []);

  /* Count universities by difficulty tier (based on all universities) */
  const universityCountByTier = useMemo(() => {
    const counts: Record<number, number> = {};
    (universities as UniRecord[]).forEach((u) => {
      const tier = u.admission_difficulty;
      if (tier) {
        counts[tier] = (counts[tier] || 0) + 1;
      }
    });
    return counts;
  }, [universities]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (!selectedRegions.includes('all')) count += selectedRegions.length;
    if (selectedSchoolType !== 'all') count += 1;
    if (portfolioOnly) count += 1;
    if (debouncedSearch) count += 1;
    if (selectedDifficultyTier) count += 1;
    return count;
  }, [selectedRegions, selectedSchoolType, portfolioOnly, debouncedSearch, selectedDifficultyTier]);

  /* -------------------- Filtering & Sorting -------------------- */

  const filteredUniversities = useMemo(() => {
    const list = (universities as UniRecord[]).slice();

    // Region filter
    if (!selectedRegions.includes('all')) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const result = list.filter((u) => selectedRegions.includes(u.region));
      // Apply subsequent filters on result
      let final = result;

      // School type filter
      if (selectedSchoolType === 'art') {
        final = final.filter((u) => u.is_art_school);
      } else if (selectedSchoolType === 'comprehensive') {
        final = final.filter((u) => !u.is_art_school);
      }

      // Portfolio filter
      if (portfolioOnly) {
        final = final.filter((u) => u.admission?.portfolio_required === true);
      }

      // Difficulty tier filter
      if (selectedDifficultyTier) {
        final = final.filter((u) => u.admission_difficulty === selectedDifficultyTier);
      }

      // Search
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        final = final.filter(
          (u) =>
            u.name?.toLowerCase().includes(q) ||
            u.name_en?.toLowerCase().includes(q) ||
            (typeof u.abbreviation === 'string' && u.abbreviation.toLowerCase().includes(q)) ||
            (typeof u.location?.city === 'string' && u.location.city.toLowerCase().includes(q)) ||
            u.majors?.some((m: string) => m.toLowerCase().includes(q))
        );
      }

      // Sort
      final.sort((a, b) => {
        switch (sortBy) {
          case 'qs_asc':
            return (a.ranking?.qs ?? 99999) - (b.ranking?.qs ?? 99999);
          case 'qs_desc':
            return (b.ranking?.qs ?? -1) - (a.ranking?.qs ?? -1);
          case 'tuition_asc':
            return ((a.tuition?.amount as number) ?? 0) - ((b.tuition?.amount as number) ?? 0);
          case 'tuition_desc':
            return ((b.tuition?.amount as number) ?? 0) - ((a.tuition?.amount as number) ?? 0);
          case 'difficulty_asc':
            return getDifficultySortValue(a) - getDifficultySortValue(b);
          case 'name_asc':
            return (a.name || '').localeCompare(b.name || '', 'zh');
          default:
            return 0;
        }
      });

      return final;
    }

    // No region filter — apply others to full list
    let result = list;

    if (selectedSchoolType === 'art') {
      result = result.filter((u) => u.is_art_school);
    } else if (selectedSchoolType === 'comprehensive') {
      result = result.filter((u) => !u.is_art_school);
    }

    if (portfolioOnly) {
      result = result.filter((u) => u.admission?.portfolio_required === true);
    }

    if (selectedDifficultyTier) {
      result = result.filter((u) => u.admission_difficulty === selectedDifficultyTier);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.name_en?.toLowerCase().includes(q) ||
          (typeof u.abbreviation === 'string' && u.abbreviation.toLowerCase().includes(q)) ||
          (typeof u.location?.city === 'string' && u.location.city.toLowerCase().includes(q)) ||
          u.majors?.some((m: string) => m.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'qs_asc':
          return (a.ranking?.qs ?? 99999) - (b.ranking?.qs ?? 99999);
        case 'qs_desc':
          return (b.ranking?.qs ?? -1) - (a.ranking?.qs ?? -1);
        case 'tuition_asc':
          return ((a.tuition?.amount as number) ?? 0) - ((b.tuition?.amount as number) ?? 0);
        case 'tuition_desc':
          return ((b.tuition?.amount as number) ?? 0) - ((a.tuition?.amount as number) ?? 0);
        case 'difficulty_asc':
          return getDifficultySortValue(a) - getDifficultySortValue(b);
        case 'name_asc':
          return (a.name || '').localeCompare(b.name || '', 'zh');
        default:
          return 0;
      }
    });

    return result;
  }, [universities, selectedRegions, selectedSchoolType, portfolioOnly, debouncedSearch, sortBy, selectedDifficultyTier]);

  /* -------------------- Render -------------------- */

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">加载院校数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      {/* ====== Header / Filter Bar ====== */}
      <div className="shrink-0 border-b border-border bg-background px-4 sm:px-6 lg:px-8 py-5">
        {/* Row 1: Title + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight shrink-0 text-foreground">
            院校浏览
          </h1>

          <div className="flex items-center gap-3 flex-1 sm:justify-end">
            {/* Search input */}
            <div className="relative w-full sm:w-[400px]">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: '#6B6560' }}
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索院校、专业或城市... (/)"
                className="w-full h-11 rounded-[10px] pl-10 pr-9 text-[14px] outline-none transition-colors duration-200 focus:border"
                style={{
                  backgroundColor: '#F0EBE3',
                  color: '#2C2420',
                  border: '1px solid transparent',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#C8A45C';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'transparent';
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X size={16} style={{ color: '#6B6560' }} />
                </button>
              )}
            </div>

            {/* Mobile filter toggle */}
            <button
              type="button"
              className="sm:hidden p-2 rounded-lg shrink-0"
              style={{ backgroundColor: '#F0EBE3' }}
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              aria-expanded={mobileFiltersOpen}
              aria-controls="explore-filters"
              aria-label={mobileFiltersOpen ? '收起筛选' : '展开筛选'}
            >
              <SlidersHorizontal size={20} style={{ color: '#6B6560' }} aria-hidden />
            </button>
          </div>
        </div>

        {/* Row 2: Filters */}
        <div
          id="explore-filters"
          className={cn(
            'mt-4 space-y-4',
            mobileFiltersOpen ? 'block' : 'hidden sm:block'
          )}
          aria-label="院校筛选"
        >
          <fieldset className="border-0 p-0 m-0 min-w-0">
            <legend className="text-xs font-medium text-muted-foreground mb-2">地区</legend>
            <div className="flex flex-wrap gap-2">
              {REGION_FILTERS.map((r) => {
                const isActive =
                  r.key === 'all'
                    ? selectedRegions.includes('all')
                    : selectedRegions.includes(r.key);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => toggleRegion(r.key)}
                    aria-pressed={isActive}
                    className="text-[14px] px-4 py-1.5 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? 'hsl(201 55% 38%)' : 'hsl(210 22% 95%)',
                      color: isActive ? 'hsl(210 40% 98%)' : 'hsl(215 16% 42%)',
                      border: isActive ? 'none' : '1px solid hsl(214 32% 90%)',
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-end gap-4">
            <fieldset className="border-0 p-0 m-0 min-w-0">
              <legend className="text-xs font-medium text-muted-foreground mb-2">院校类型</legend>
              <div className="flex flex-wrap gap-2">
                {SCHOOL_TYPES.map((st) => {
                  const isActive = selectedSchoolType === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setSelectedSchoolType(st.key)}
                      aria-pressed={isActive}
                      className="text-[14px] px-4 py-1.5 rounded-full transition-all duration-200"
                      style={{
                        backgroundColor: isActive ? 'hsl(201 55% 38%)' : 'hsl(210 22% 95%)',
                        color: isActive ? 'hsl(210 40% 98%)' : 'hsl(215 16% 42%)',
                        border: isActive ? 'none' : '1px solid hsl(214 32% 90%)',
                      }}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={() => setPortfolioOnly(!portfolioOnly)}
              aria-pressed={portfolioOnly}
              className="text-[14px] px-4 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5"
              style={{
                backgroundColor: portfolioOnly ? '#8B233215' : '#F0EBE3',
                color: portfolioOnly ? '#8B2332' : '#6B6560',
                border: portfolioOnly ? '1px solid #8B2332' : '1px solid #E8E2D9',
              }}
            >
              <Palette size={14} aria-hidden />
              需要作品集
            </button>

            <div className="relative" ref={sortRef}>
              <span id="explore-sort-label" className="text-xs font-medium text-muted-foreground block mb-2">
                排序
              </span>
              <button
                type="button"
                id="explore-sort-button"
                aria-labelledby="explore-sort-label explore-sort-button"
                aria-haspopup="listbox"
                aria-expanded={showSortDropdown}
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="text-[14px] px-4 py-1.5 rounded-lg flex items-center gap-2 transition-colors duration-200"
                style={{ backgroundColor: '#F0EBE3', color: '#6B6560' }}
              >
                {SORT_OPTIONS.find((s) => s.key === sortBy)?.label}
                <ChevronDown
                  size={14}
                  className={`transition-transform ${showSortDropdown ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
            <AnimatePresence>
              {showSortDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 mt-2 rounded-lg shadow-lg z-[1300] overflow-hidden"
                  style={{
                    backgroundColor: '#F5F0E8',
                    border: '1px solid #E8E2D9',
                    minWidth: 180,
                  }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setSortBy(opt.key);
                        setShowSortDropdown(false);
                      }}
                      className="block w-full text-left text-[14px] px-4 py-2.5 transition-colors duration-150"
                      style={{
                        color: sortBy === opt.key ? '#C8A45C' : '#6B6560',
                        backgroundColor:
                          sortBy === opt.key ? '#F0EBE3' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (sortBy !== opt.key) {
                          e.currentTarget.style.backgroundColor = '#F0EBE3';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (sortBy !== opt.key) {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Active filter count + clear */}
        {activeFilterCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 mt-3"
          >
            <span className="text-[12px]" style={{ color: '#6B6560' }}>
              已选 {activeFilterCount} 项
            </span>
            <button
              onClick={clearAllFilters}
              className="text-xs text-primary transition-colors hover:underline"
            >
              清除全部
            </button>
          </motion.div>
        )}
      </div>

      {/* ====== Results Info Bar ====== */}
      <div className="shrink-0 flex items-center justify-between border-b border-border bg-background px-4 sm:px-6 lg:px-8 py-3">
        <p className="text-sm text-muted-foreground">
          共 {filteredUniversities.length} 所院校
        </p>
        <p className="text-xs text-muted-foreground">
          显示 {filteredUniversities.length} 所
          {filteredUniversities.length !== universities.length &&
            ` · 筛选后 ${filteredUniversities.length} 所`}
        </p>
      </div>

      {/* ====== Main Content: University Grid + Difficulty Ladder ====== */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Left: University Grid */}
          <div className="flex-1 min-w-0">
            {filteredUniversities.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-32">
                <SearchX size={48} style={{ color: '#6B6560' }} />
                <h3
                  className="text-[22px] font-medium mt-4"
                  style={{ color: '#6B6560' }}
                >
                  没有找到匹配的院校
                </h3>
                <p className="text-[15px] mt-2" style={{ color: '#6B6560' }}>
                  尝试调整筛选条件
                </p>
                <button
                  onClick={clearAllFilters}
                  className="text-sm mt-4 text-primary transition-colors hover:underline"
                >
                  清除所有筛选
                </button>
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                <AnimatePresence mode="popLayout">
                  {filteredUniversities.map((u, i) => (
                    <UniversityCard
                      key={u.id}
                      university={u}
                      isBookmarked={bookmarks.has(u.id)}
                      onToggleBookmark={toggleBookmark}
                      onClick={setSelectedUniversityId}
                      index={i}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>

          {/* Right: Difficulty Ladder Sidebar */}
          <DifficultyLadder
            activeTier={selectedDifficultyTier}
            onSelectTier={setSelectedDifficultyTier}
            universityCountByTier={universityCountByTier}
          />
        </div>

        {/* Bottom spacer */}
        <div className="h-8" />
      </div>

      {/* ====== University Detail Modal ====== */}
      <AnimatePresence>
        {selectedUniversityId && (
          <UniversityDetailModal
            universityId={selectedUniversityId}
            onClose={() => setSelectedUniversityId(null)}
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
            onNavigate={(id) => setSelectedUniversityId(id)}
            universityIds={filteredUniversities.map((u) => u.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
