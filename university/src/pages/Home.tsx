import { useEffect, useRef, useState, useMemo, lazy, Suspense } from 'react';
import { useData } from '@/context/DataContext';
import { useCompare } from '@/context/CompareContext';
import CompareDrawer from '@/components/CompareDrawer';
import CompareButton from '@/components/CompareButton';
import UniversityDetailModal from '@/components/UniversityDetailModal';
import { AnimatePresence } from 'framer-motion';
import { Scale } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Globe = lazy(() => import('@/components/Globe'));

/* ─── region data ─── */
const REGIONS = [
  { key: 'us', name: '美国', count: 30, color: '#3B6EA5', image: './region-us.jpg' },
  { key: 'uk', name: '英国', count: 20, color: '#8B2332', image: './region-uk.jpg' },
  { key: 'canada', name: '加拿大', count: 5, color: '#C2553A', image: './region-canada.jpg' },
  { key: 'australia', name: '澳大利亚', count: 10, color: '#4A7C6F', image: './region-au.jpg' },
  { key: 'europe', name: '欧洲大陆', count: 20, color: '#6B4C8A', image: './region-eu.jpg' },
  { key: 'hong-kong', name: '中国香港', count: 4, color: '#C8553D', image: './region-hk.jpg' },
  { key: 'singapore', name: '新加坡', count: 2, color: '#D4943A', image: './region-sg.jpg' },
  { key: 'art', name: '艺术院校', count: 15, color: '#C8A45C', image: './region-art.jpg' },
];

const REGION_NAME_MAP: Record<string, string> = {
  us: '美国', uk: '英国', canada: '加拿大', australia: '澳大利亚',
  europe: '欧洲大陆', 'hong-kong': '香港', singapore: '新加坡', art: '艺术院校',
};

/* ─── stat counters ─── */
const STATS = [
  { value: 106, label: '收录院校', suffix: '所' },
  { value: 8, label: '覆盖地区', suffix: '个' },
  { value: 51, label: '城市生活数据', suffix: '城' },
  { value: 196900, label: '最高中期薪资', suffix: '', prefix: '$', note: '(MIT)' },
  { value: 15, label: '艺术/作品集院校', suffix: '所' },
];

/* ─── small art schools for spotlight ─── */
const ART_SCHOOL_ABBRS = [
  { abbr: 'RISD', name: '罗德岛设计学院' },
  { abbr: 'Parsons', name: '帕森斯设计学院' },
  { abbr: 'ArtCenter', name: '艺术中心设计学院' },
  { abbr: 'CSM', name: '中央圣马丁' },
  { abbr: 'RCA', name: '皇家艺术学院' },
  { abbr: 'CalArts', name: '加州艺术学院' },
];

function HomeContent() {
  const { universities, loading } = useData();
  const { setDrawerOpen, compareIds } = useCompare();
  const [activeRegion, setActiveRegion] = useState('all');
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const heroTextRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const featuredRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const globeWrapRef = useRef<HTMLDivElement>(null);

  /* Filtered universities */
  const filteredUniversities = useMemo(() => {
    let list = [...universities];
    if (activeRegion !== 'all') {
      if (activeRegion === 'art') {
        list = list.filter((u) => u.is_art_school);
      } else {
        list = list.filter((u) => u.region === activeRegion);
      }
    }
    list.sort((a, b) => (a.ranking?.qs || 999) - (b.ranking?.qs || 999));
    return list;
  }, [universities, activeRegion]);

  const topArtSchools = useMemo(() => {
    return universities
      .filter((u) => u.is_art_school)
      .slice(0, 6);
  }, [universities]);

  /* GSAP scroll animations */
  useEffect(() => {
    if (loading) return;
    const ctx = gsap.context(() => {
      /* Hero entrance */
      if (heroTextRef.current) {
        const els = heroTextRef.current.querySelectorAll('.hero-animate');
        gsap.fromTo(
          els,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            stagger: 0.15,
            ease: 'power3.out',
            delay: 0.3,
          }
        );
      }

      /* Region section */
      if (regionRef.current) {
        const header = regionRef.current.querySelectorAll('.region-header');
        gsap.fromTo(
          header,
          { opacity: 0, y: 30 },
          {
            opacity: 1, y: 0, duration: 0.7, stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: regionRef.current,
              start: 'top 85%',
            },
          }
        );
        const cards = regionRef.current.querySelectorAll('.region-card');
        gsap.fromTo(
          cards,
          { opacity: 0, x: 60 },
          {
            opacity: 1, x: 0, duration: 0.6, stagger: 0.08,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: regionRef.current,
              start: 'top 75%',
            },
          }
        );
      }

      /* Stats counter */
      if (statsRef.current) {
        const items = statsRef.current.querySelectorAll('.stat-item');
        gsap.fromTo(
          items,
          { opacity: 0, y: 20 },
          {
            opacity: 1, y: 0, duration: 0.6, stagger: 0.15,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: statsRef.current,
              start: 'top 80%',
            },
          }
        );
      }

      /* Featured grid */
      if (featuredRef.current) {
        const cards = featuredRef.current.querySelectorAll('.uni-card');
        gsap.fromTo(
          cards,
          { opacity: 0, y: 30 },
          {
            opacity: 1, y: 0, duration: 0.5, stagger: 0.06,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: featuredRef.current,
              start: 'top 80%',
            },
          }
        );
      }

      /* Art spotlight */
      if (artRef.current) {
        gsap.fromTo(
          artRef.current,
          { opacity: 0, x: -40 },
          {
            opacity: 1, x: 0, duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: { trigger: artRef.current, start: 'top 85%' },
          }
        );
      }

      /* CTA section */
      if (ctaRef.current) {
        const els = ctaRef.current.querySelectorAll('.cta-animate');
        gsap.fromTo(
          els,
          { opacity: 0, y: 20 },
          {
            opacity: 1, y: 0, duration: 0.6, stagger: 0.2,
            ease: 'power3.out',
            scrollTrigger: { trigger: ctaRef.current, start: 'top 85%' },
          }
        );
      }
    });

    return () => ctx.revert();
  }, [loading]);

  /* Animated counter */
  const useCountUp = (target: number, duration = 2.5) => {
    const ref = useRef<HTMLSpanElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
      if (!ref.current || hasAnimated.current) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const obj = { val: 0 };
            gsap.to(obj, {
              val: target,
              duration,
              ease: 'expo.out',
              onUpdate: () => {
                if (ref.current) {
                  ref.current.textContent = Math.round(obj.val).toLocaleString();
                }
              },
            });
          }
        },
        { threshold: 0.5 }
      );
      observer.observe(ref.current);
      return () => observer.disconnect();
    }, [target, duration]);

    return ref;
  };

  function StatCounter({ value, prefix = '' }: { value: number; prefix?: string }) {
    const ref = useCountUp(value);
    return (
      <span ref={ref} className="font-mono-data" style={{ color: '#C8A45C', fontSize: 'clamp(32px, 4vw, 48px)', letterSpacing: '-0.02em' }}>
        {prefix}0
      </span>
    );
  }

  /* Region pills */
  const regionPills = ['all', 'us', 'uk', 'canada', 'australia', 'europe', 'hong-kong', 'singapore', 'art'];

  return (
    <div style={{ backgroundColor: '#FAF7F2' }}>
      {/* ═══════════════ HERO ═══════════════ */}
      <section
        id="hero"
        ref={heroRef}
        className="relative min-h-[100dvh] flex items-center overflow-hidden"
      >
        {/* Globe background */}
        {!loading && universities.length > 0 && (
          <Suspense fallback={null}>
            <div ref={globeWrapRef} className="absolute inset-0" style={{ zIndex: 1 }}>
              <Globe universities={universities} />
            </div>
          </Suspense>
        )}

        {/* Hero text */}
        <div
          ref={heroTextRef}
          className="relative z-10 w-full"
          style={{ padding: '0 max(24px, 2vw)' }}
        >
          <div className="max-w-[1400px] mx-auto">
            <div className="max-w-[600px]">
              <p
                className="hero-animate text-xs font-medium uppercase tracking-widest mb-4"
                style={{ color: '#C8A45C', letterSpacing: '0.1em', opacity: 0 }}
              >
                全球留学择校指南
              </p>
              <h1
                className="hero-animate font-display font-normal leading-none mb-2"
                style={{
                  color: '#2C2420',
                  fontSize: 'clamp(48px, 8vw, 100px)',
                  letterSpacing: '-0.03em',
                  lineHeight: 0.9,
                  opacity: 0,
                }}
              >
                探索
              </h1>
              <h1
                className="hero-animate font-display font-normal leading-none mb-6"
                style={{
                  color: '#2C2420',
                  fontSize: 'clamp(48px, 8vw, 100px)',
                  letterSpacing: '-0.03em',
                  lineHeight: 0.9,
                  opacity: 0,
                }}
              >
                世界顶尖学府
              </h1>
              <p
                className="hero-animate text-[17px] leading-relaxed mb-8"
                style={{ color: '#6B6560', maxWidth: 520, opacity: 0 }}
              >
                为A-Level学子 curated 的全球106所名校完整指南
              </p>
              <div className="hero-animate flex items-center gap-4 flex-wrap" style={{ opacity: 0 }}>
                <button
                  className="font-space font-medium text-base rounded-lg transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
                  style={{
                    backgroundColor: '#C8A45C',
                    color: '#FAF7F2',
                    padding: '14px 36px',
                  }}
                  onClick={() => {
                    const el = document.getElementById('explore');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  开始探索
                </button>
                <a
                  href="#explore"
                  onClick={(e) => {
                    e.preventDefault();
                    const el = document.getElementById('explore');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-[15px] transition-colors duration-200 hover:text-accent-gold"
                  style={{ color: '#6B6560' }}
                >
                  查看完整名单 →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ REGION EXPLORER ═══════════════ */}
      <section
        id="explore"
        ref={regionRef}
        style={{
          padding: 'clamp(80px, 10vh, 160px) max(24px, 2vw)',
          backgroundColor: '#FAF7F2',
        }}
      >
        <div className="max-w-[1400px] mx-auto">
          <p
            className="region-header text-xs font-medium uppercase tracking-widest mb-3"
            style={{ color: '#C8A45C', letterSpacing: '0.1em' }}
          >
            选择目的地
          </p>
          <h2
            className="region-header font-display font-normal mb-3"
            style={{
              color: '#2C2420',
              fontSize: 'clamp(36px, 5vw, 64px)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            探索世界各地区的顶尖学府
          </h2>
          <p
            className="region-header text-[17px] leading-relaxed mb-10"
            style={{ color: '#6B6560', maxWidth: 600 }}
          >
            按地区浏览106所名校，了解每个目的地的独特优势
          </p>

          {/* Horizontal scroll cards */}
          <div
            className="flex gap-6 overflow-x-auto pb-5"
            style={{
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'thin',
              scrollbarColor: '#C8A45C #E8E2D9',
            }}
          >
            {REGIONS.map((region) => (
              <div
                key={region.key}
                className="region-card flex-shrink-0 rounded-2xl overflow-hidden relative cursor-pointer transition-all duration-500 hover:scale-[1.02]"
                style={{
                  width: 280,
                  height: 360,
                  scrollSnapAlign: 'start',
                  border: '1px solid #E8E2D9',
                  backgroundColor: '#FFFFFF',
                  flexShrink: 0,
                }}
                onClick={() => {
                  setActiveRegion(region.key);
                  const el = document.getElementById('featured');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {/* Gradient overlay */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `linear-gradient(135deg, ${region.color}40, transparent)`,
                  }}
                />
                {/* Image */}
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: `url(${region.image})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, #FFFFFF 0%, transparent 60%)',
                  }}
                />
                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${region.color}30` }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: region.color }}
                    />
                  </div>
                  <h3
                    className="font-display text-xl font-medium mb-1"
                    style={{ color: '#2C2420' }}
                  >
                    {region.name}
                  </h3>
                  <p className="font-mono-data text-2xl mb-1" style={{ color: '#C8A45C' }}>
                    {region.count}
                  </p>
                  <p className="text-xs" style={{ color: '#6B6560' }}>
                    所院校
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ STATISTICS BAR ═══════════════ */}
      <section
        id="stats"
        ref={statsRef}
        style={{
          padding: '80px max(24px, 2vw)',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E8E2D9',
          borderBottom: '1px solid #E8E2D9',
          position: 'relative',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='0.5' opacity='0.05'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />
        <div className="max-w-[1400px] mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-4">
            {STATS.map((stat, i) => (
              <div key={i} className="stat-item text-center relative">
                <div className="flex items-baseline justify-center gap-1">
                  {stat.prefix && (
                    <span className="font-mono-data" style={{ color: '#C8A45C', fontSize: 'clamp(24px, 3vw, 36px)' }}>
                      {stat.prefix}
                    </span>
                  )}
                  <StatCounter value={stat.value} prefix={stat.prefix} />
                  {stat.suffix && (
                    <span className="font-mono-data" style={{ color: '#C8A45C', fontSize: 'clamp(24px, 3vw, 36px)' }}>
                      {stat.suffix}
                    </span>
                  )}
                </div>
                {stat.note && (
                  <p className="text-xs mt-1" style={{ color: '#6B6560' }}>
                    {stat.note}
                  </p>
                )}
                <p
                  className="text-xs font-medium uppercase tracking-wider mt-2"
                  style={{ color: '#6B6560', letterSpacing: '0.06em' }}
                >
                  {stat.label}
                </p>
                {i < STATS.length - 1 && (
                  <div
                    className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 h-12"
                    style={{ width: 1, backgroundColor: '#E8E2D9' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURED UNIVERSITIES ═══════════════ */}
      <section
        id="featured"
        ref={featuredRef}
        style={{
          padding: 'clamp(80px, 10vh, 160px) max(24px, 2vw)',
          backgroundColor: '#FAF7F2',
        }}
      >
        <div className="max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <p
                className="text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: '#C8A45C', letterSpacing: '0.1em' }}
              >
                院校探索
              </p>
              <h2
                className="font-display font-normal"
                style={{
                  color: '#2C2420',
                  fontSize: 'clamp(36px, 5vw, 64px)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                发现适合你的梦校
              </h2>
            </div>
          </div>

          {/* Filter pills */}
          <div
            className="flex flex-wrap gap-2 mb-8 sticky top-16 z-[900] py-4"
            style={{
              background: 'linear-gradient(to bottom, #FAF7F2 80%, transparent)',
            }}
          >
            {regionPills.map((key) => {
              const isActive = activeRegion === key;
              const label = key === 'all' ? '全部' : REGION_NAME_MAP[key] || key;
              return (
                <button
                  key={key}
                  onClick={() => { setActiveRegion(key); setVisibleCount(12); }}
                  className="text-sm font-medium rounded-full transition-all duration-200"
                  style={{
                    padding: '8px 18px',
                    backgroundColor: isActive ? '#C8A45C' : '#F0EBE3',
                    color: isActive ? '#FAF7F2' : '#6B6560',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* University grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div
                  className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                  style={{ borderColor: '#C8A45C', borderTopColor: 'transparent' }}
                />
                <p style={{ color: '#6B6560' }}>加载中...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7">
                {filteredUniversities.slice(0, visibleCount).map((uni) => {
                  const regionColor = REGIONS.find((r) => r.key === uni.region)?.color || '#C8A45C';
                  const qsRank = uni.ranking?.qs;
                  return (
                    <div
                      key={uni.id}
                      className="uni-card rounded-xl overflow-hidden transition-all duration-300 cursor-pointer group"
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E8E2D9',
                        boxShadow: '0 2px 8px rgba(44, 36, 32, 0.04), 0 0 1px rgba(44, 36, 32, 0.08)',
                        transition: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      onClick={() => setSelectedUniversityId(uni.id)}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget;
                        el.style.borderColor = '#C8A45C';
                        el.style.transform = 'translateY(-6px)';
                        el.style.boxShadow = '0 20px 60px rgba(44, 36, 32, 0.12), 0 8px 20px rgba(44, 36, 32, 0.06)';
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget;
                        el.style.borderColor = '#E8E2D9';
                        el.style.transform = 'translateY(0)';
                        el.style.boxShadow = '0 2px 8px rgba(44, 36, 32, 0.04), 0 0 1px rgba(44, 36, 32, 0.08)';
                      }}
                    >
                      {/* Image area with gradient */}
                      <div
                        className="relative overflow-hidden"
                        style={{ height: 180 }}
                      >
                        <div
                          className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]"
                          style={{
                            background: `linear-gradient(135deg, ${regionColor}20 0%, ${regionColor}40 50%, #FFFFFF 100%)`,
                          }}
                        />
                        {/* University name watermark */}
                        <div
                          className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none"
                        >
                          <span
                            className="font-display font-bold text-center px-4"
                            style={{ fontSize: 28, color: '#2C2420', lineHeight: 1.1 }}
                          >
                            {uni.name_en}
                          </span>
                        </div>
                        <div
                          className="absolute inset-0"
                          style={{
                            background: 'linear-gradient(to top, #FFFFFF 0%, transparent 40%)',
                          }}
                        />
                        {/* Region badge */}
                        <div
                          className="absolute top-3 left-3 text-[11px] font-medium px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: `${regionColor}30`,
                            color: regionColor,
                          }}
                        >
                          {REGION_NAME_MAP[uni.region] || uni.region}
                        </div>
                        {/* Bookmark button */}
                        <button
                          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
                          style={{ backgroundColor: 'rgba(44, 36, 32, 0.06)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6560" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </button>
                      </div>

                      {/* Content area */}
                      <div style={{ padding: 20 }}>
                        <div className="flex items-start justify-between mb-1">
                          <h3
                            className="font-body-cn text-lg font-medium truncate flex-1"
                            style={{ color: '#2C2420' }}
                          >
                            {uni.name}
                          </h3>
                          {qsRank && (
                            <span
                              className="font-mono-data text-lg font-normal ml-2 flex-shrink-0"
                              style={{ color: '#C8A45C' }}
                            >
                              #{qsRank}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-xs uppercase truncate mb-3"
                          style={{ color: '#6B6560', letterSpacing: '0.04em' }}
                        >
                          {uni.name_en}
                        </p>

                        {/* Quick stats */}
                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                          {uni.admission?.a_level && (
                            <span className="text-[11px] truncate" style={{ color: '#6B6560', maxWidth: 120 }}>
                              {uni.admission.a_level}
                            </span>
                          )}
                          {uni.admission?.acceptance_rate && (
                            <span className="text-[11px]" style={{ color: '#6B6560' }}>
                              录取 {typeof uni.admission.acceptance_rate === 'string'
                                ? uni.admission.acceptance_rate
                                : `${(uni.admission.acceptance_rate * 100).toFixed(1)}%`}
                            </span>
                          )}
                          {uni.tuition?.amount && (
                            <span className="text-[11px]" style={{ color: '#6B6560' }}>
                              {uni.tuition.currency === 'GBP' ? '£'
                                : uni.tuition.currency === 'EUR' ? '€'
                                : uni.tuition.currency === 'CAD' ? 'C$'
                                : uni.tuition.currency === 'AUD' ? 'A$'
                                : uni.tuition.currency === 'CHF' ? 'CHF '
                                : uni.tuition.currency === 'HKD' ? 'HK$'
                                : uni.tuition.currency === 'SGD' ? 'S$'
                                : uni.tuition.currency === 'SEK' ? 'SEK '
                                : uni.tuition.currency === 'DKK' ? 'DKK '
                                : uni.tuition.currency === 'NOK' ? 'NOK '
                                : '$'}{uni.tuition.amount.toLocaleString()}/年
                            </span>
                          )}
                        </div>

                        {/* Major tags */}
                        <div className="flex flex-wrap gap-1.5">
                          {(uni.majors || []).slice(0, 3).map((major) => (
                            <span
                              key={major}
                              className="text-[11px] px-2.5 py-1 rounded-md"
                              style={{ backgroundColor: '#F0EBE3', color: '#6B6560' }}
                            >
                              {major}
                            </span>
                          ))}
                        </div>

                        {/* Art school indicator */}
                        {uni.is_art_school && (
                          <div
                            className="mt-3 text-[11px] font-medium inline-block px-2 py-0.5 rounded"
                            style={{ backgroundColor: '#8B233230', color: '#8B2332' }}
                          >
                            作品集
                          </div>
                        )}

                        {/* Compare button */}
                        <div className="mt-3">
                          <CompareButton universityId={uni.id} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Load more */}
              {visibleCount < filteredUniversities.length && (
                <button
                  className="w-full mt-10 rounded-xl transition-all duration-200 font-medium"
                  style={{
                    backgroundColor: '#F0EBE3',
                    color: '#2C2420',
                    padding: 16,
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#C8A45C';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                  onClick={() => setVisibleCount((c) => c + 8)}
                >
                  加载更多 ({filteredUniversities.length - visibleCount} 所 remaining)
                </button>
              )}
            </>
          )}
        </div>
      </section>

      {/* ═══════════════ ART SCHOOLS SPOTLIGHT ═══════════════ */}
      <section
        id="art-schools"
        ref={artRef}
        className="relative"
        style={{
          padding: 'clamp(80px, 10vh, 160px) max(24px, 2vw)',
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E8E2D9',
          borderBottom: '1px solid #E8E2D9',
        }}
      >
        {/* Left accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 hidden md:block"
          style={{ backgroundColor: '#8B2332' }}
        />

        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <div>
              <p
                className="text-xs font-medium uppercase tracking-widest mb-3"
                style={{ color: '#8B2332', letterSpacing: '0.1em' }}
              >
                特别推荐
              </p>
              <h2
                className="font-display font-normal mb-4"
                style={{
                  color: '#2C2420',
                  fontSize: 'clamp(28px, 3.5vw, 40px)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                作品集导向的艺术名校
              </h2>
              <p
                className="text-[17px] leading-relaxed mb-4"
                style={{ color: '#6B6560', maxWidth: 640 }}
              >
                A-Level成绩不是唯一路径。这15所全球顶尖艺术院校更看重你的创意作品集——录取决策中作品集权重高达60-80%。
              </p>
              <p
                className="text-[15px] mb-6"
                style={{ color: '#6B6560' }}
              >
                包括RISD、Parsons、ArtCenter、中央圣马丁、RCA等
              </p>
              <button
                className="font-medium rounded-lg transition-all duration-200 hover:brightness-115"
                style={{
                  backgroundColor: '#8B2332',
                  color: '#2C2420',
                  padding: '12px 28px',
                }}
              >
                查看艺术院校 →
              </button>
            </div>

            {/* Right mini grid */}
            <div className="grid grid-cols-3 gap-3">
              {topArtSchools.length > 0
                ? topArtSchools.map((school) => (
                    <div
                      key={school.id}
                      className="rounded-lg flex flex-col items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105"
                      style={{
                        backgroundColor: '#F0EBE3',
                        height: 90,
                        border: '1px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#8B2332';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <span
                        className="font-mono-data text-lg font-medium"
                        style={{ color: '#C8A45C' }}
                      >
                        {school.name_en.split(' ').map((w) => w[0]).join('').slice(0, 4)}
                      </span>
                      <span
                        className="text-[11px] mt-1 text-center px-2 truncate max-w-full"
                        style={{ color: '#6B6560' }}
                      >
                        {school.name}
                      </span>
                    </div>
                  ))
                : ART_SCHOOL_ABBRS.map((s) => (
                    <div
                      key={s.abbr}
                      className="rounded-lg flex flex-col items-center justify-center transition-all duration-200 cursor-pointer hover:scale-105"
                      style={{
                        backgroundColor: '#F0EBE3',
                        height: 90,
                        border: '1px solid transparent',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#8B2332';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <span
                        className="font-mono-data text-lg font-medium"
                        style={{ color: '#C8A45C' }}
                      >
                        {s.abbr}
                      </span>
                      <span
                        className="text-[11px] mt-1 text-center px-2 truncate max-w-full"
                        style={{ color: '#6B6560' }}
                      >
                        {s.name}
                      </span>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ QUICK COMPARISON CTA ═══════════════ */}
      <section
        id="compare"
        ref={ctaRef}
        className="text-center"
        style={{
          padding: '100px max(24px, 2vw)',
          backgroundColor: '#FAF7F2',
          position: 'relative',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at center, #F5F0E8 0%, #FAF7F2 70%)',
          }}
        />
        <div className="relative max-w-[600px] mx-auto">
          <h2
            className="cta-animate font-display font-normal mb-4"
            style={{
              color: '#2C2420',
              fontSize: 'clamp(28px, 3.5vw, 40px)',
              letterSpacing: '-0.02em',
            }}
          >
            难以抉择？
          </h2>
          <p
            className="cta-animate text-[17px] leading-relaxed mb-8"
            style={{ color: '#6B6560' }}
          >
            同时对比最多4所院校，从录取要求到职业前景一目了然
          </p>
          <div className="cta-animate">
            <button
              onClick={() => setDrawerOpen(true)}
              className="font-medium rounded-xl transition-all duration-200 hover:scale-[1.03] hover:brightness-110 inline-flex items-center gap-2"
              style={{
                backgroundColor: '#C8A45C',
                color: '#FAF7F2',
                padding: '16px 40px',
                fontSize: 18,
                animation: 'pulse-glow 3s ease-in-out infinite',
              }}
            >
              <Scale size={18} />
              开始对比
              {compareIds.length > 0 && (
                <span
                  className="text-xs font-bold rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: '#FAF7F2',
                    color: '#C8A45C',
                    width: 22,
                    height: 22,
                  }}
                >
                  {compareIds.length}
                </span>
              )}
            </button>
          </div>
          <a
            href="#"
            className="cta-animate inline-block mt-4 text-[15px] transition-colors duration-200 hover:text-accent-gold"
            style={{ color: '#6B6560' }}
          >
            了解如何使用 →
          </a>
        </div>
      </section>

      {/* Compare Drawer */}
      <CompareDrawer />

      {/* University Detail Modal */}
      <AnimatePresence>
        {selectedUniversityId && (
          <UniversityDetailModal
            universityId={selectedUniversityId}
            onClose={() => setSelectedUniversityId(null)}
            bookmarks={new Set()}
            onToggleBookmark={() => {}}
            onNavigate={(id) => setSelectedUniversityId(id)}
            universityIds={filteredUniversities.map((u) => u.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  return (
    <HomeContent />
  );
}
