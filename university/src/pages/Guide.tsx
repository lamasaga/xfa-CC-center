import { useState, useEffect, useMemo } from 'react';
import { useData } from '@/context/DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, FileText, Palette, Calendar, Languages, TrendingUp,
  ChevronDown, Check, BookOpen, Globe, GraduationCap,
  Building2, MapPin, Plane, Award, Clock, Lightbulb,
  type LucideIcon,
} from 'lucide-react';

/* ── types ── */
interface RegionInfo {
  key: string;
  name: string;
  flag: string;
  color: string;
  count: number;
  aLevelRole: string;
  applicationSystem: string;
  keyDeadlines: string;
  specialRequirements: string[];
  acceptanceRate: string;
  aLevelRequirements: string;
  advantages: string[];
  cta: string;
}

interface ChecklistGroup {
  title: string;
  items: string[];
}

/* ── region data ── */
const REGIONS: RegionInfo[] = [
  {
    key: 'us',
    name: '美国',
    flag: 'US',
    color: '#3B6EA5',
    count: 30,
    aLevelRole: '重要但非唯一。顶尖大学（HYPSM）要求A*A*A-A*A*A*，配合SAT/ACT',
    applicationSystem: 'Common App / Coalition / UC系统（独立）',
    keyDeadlines: 'EA/ED 11月1日, RD 1月1-5日',
    specialRequirements: ['推荐信2-3封', '活动列表', '文书（多篇）', '面试（部分）'],
    acceptanceRate: '3-7%（顶尖），7-15%（中上）',
    aLevelRequirements: 'A*A*A-A*AA（视学校而定）',
    advantages: ['最高薪资水平', '最强科研资源', '最多顶尖公司', '灵活选课制度'],
    cta: '查看美国院校',
  },
  {
    key: 'uk',
    name: '英国',
    flag: 'GB',
    color: '#8B2332',
    count: 20,
    aLevelRole: '核心录取依据。通过UCAS系统申请，A-Level预测成绩和最终成绩决定录取',
    applicationSystem: 'UCAS（最多5个选择）',
    keyDeadlines: '10月15日（牛剑/医学）, 1月31日（大部分）',
    specialRequirements: ['个人陈述1篇', '推荐信1封', '入学考试（MAT, STEP, TSA, LNAT等）'],
    acceptanceRate: '6-20%（视学校和专业）',
    aLevelRequirements: 'A*A*A-AAA（视专业而定）',
    advantages: ['学制短（3年本科）', '学术传统深厚', '欧洲旅行便利', '国际学生友好'],
    cta: '查看英国院校',
  },
  {
    key: 'canada',
    name: '加拿大',
    flag: 'CA',
    color: '#C2553A',
    count: 5,
    aLevelRole: '主要录取依据。加拿大大学高度重视A-Level成绩',
    applicationSystem: '各校独立申请（OUAC for Ontario）',
    keyDeadlines: '滚动录取，建议12月-1月提交',
    specialRequirements: ['语言成绩（雅思/托福）', '部分需要文书'],
    acceptanceRate: '20-50%（视学校）',
    aLevelRequirements: 'BBB-A*AA',
    advantages: ['移民政策友好', '学费相对便宜', '社会安全稳定', '工签政策好'],
    cta: '查看加拿大院校',
  },
  {
    key: 'australia',
    name: '澳大利亚',
    flag: 'AU',
    color: '#4A7C6F',
    count: 10,
    aLevelRole: '直接录取依据。A-Level成绩换算为ATAR等效分数',
    applicationSystem: '各校独立或通过UAC/VTAC',
    keyDeadlines: 'S1: 12月截止, S2: 5月截止',
    specialRequirements: ['语言成绩', '部分专业需要作品集/面试'],
    acceptanceRate: '30-80%（视学校）',
    aLevelRequirements: 'CCC-AAA',
    advantages: ['气候宜人', '录取灵活', '工作签证友好', '生活质量高'],
    cta: '查看澳大利亚院校',
  },
  {
    key: 'europe',
    name: '欧洲大陆',
    flag: 'EU',
    color: '#6B4C8A',
    count: 20,
    aLevelRole: '英国体系认可度高。ETH Zurich、EPFL等顶级理工院校重视数学和科学A-Level成绩',
    applicationSystem: '各国各异（Studielink荷兰、Uni-Assist德国等）',
    keyDeadlines: '1月-3月（多数）',
    specialRequirements: ['部分需要当地语言证明', '部分英语授课'],
    acceptanceRate: '10-30%（视学校）',
    aLevelRequirements: 'AAA-A*A*A（顶尖理工）',
    advantages: ['学费极低或免费', '英语项目增多', '欧洲文化体验', '科研实力强'],
    cta: '查看欧洲院校',
  },
  {
    key: 'hongkong',
    name: '香港',
    flag: 'HK',
    color: '#C8553D',
    count: 4,
    aLevelRole: '核心录取依据。港大、港中文等高度认可A-Level',
    applicationSystem: '各校独立（JUPAS local, Non-JUPAS international）',
    keyDeadlines: '11月-1月（早轮）, 1-3月（主轮）',
    specialRequirements: ['面试（部分专业）', '语言成绩'],
    acceptanceRate: '10-25%',
    aLevelRequirements: 'AAA-A*A*A',
    advantages: ['离家近', '费用相对较低', '亚洲金融中心', '就业机会好'],
    cta: '查看香港院校',
  },
  {
    key: 'singapore',
    name: '新加坡',
    flag: 'SG',
    color: '#D4943A',
    count: 2,
    aLevelRole: 'NUS和NTU均高度认可A-Level成绩',
    applicationSystem: '各校独立在线申请',
    keyDeadlines: '10月-3月',
    specialRequirements: ['面试', '部分专业需要入学测试'],
    acceptanceRate: '10-20%',
    aLevelRequirements: 'AAA-A*A*A*',
    advantages: ['亚洲顶尖教育', '英语环境', '就业前景好', '地理位置优越'],
    cta: '查看新加坡院校',
  },
  {
    key: 'art',
    name: '艺术院校',
    flag: 'ART',
    color: '#C8A45C',
    count: 15,
    aLevelRole: '次要。作品集占录取权重的60-80%',
    applicationSystem: '各校独立 + UCAS（英国艺术类）',
    keyDeadlines: '1月-3月（多数），部分滚动',
    specialRequirements: ['作品集（15-20件作品）', '个人陈述', '推荐信'],
    acceptanceRate: '15-40%（视专业）',
    aLevelRequirements: 'CCC-BBB',
    advantages: ['专业艺术教育', '行业资源丰富', '创意氛围浓厚', '国际视野开阔'],
    cta: '查看艺术院校',
  },
];

/* ── timeline data ── */
const TIMELINE_PHASES = [
  {
    phase: '准备期',
    time: 'AS年级 (Year 12)',
    tasks: ['确定目标国家/地区和专业方向', '准备SAT/ACT（美国为主）', '开始雅思/托福备考', '艺术生开始准备作品集'],
    color: '#3B6EA5',
  },
  {
    phase: '冲刺期',
    time: 'A2上学期 (Sep-Dec)',
    tasks: ['完成文书撰写', '准备推荐信', '提交EA/ED申请（美国）', '完善作品集（艺术生）'],
    color: '#8B2332',
  },
  {
    phase: '提交期',
    time: 'A2冬季 (Dec-Jan)',
    tasks: ['提交RD申请（美国）', '提交UCAS申请（英国）', '提交作品集', '确认所有材料已送达'],
    color: '#C2553A',
  },
  {
    phase: '等待期',
    time: 'A2春季 (Feb-Apr)',
    tasks: ['参加面试', '等待录取结果', '申请奖学金', '比较录取offer'],
    color: '#D4943A',
  },
  {
    phase: '决定期',
    time: 'A2夏季 (May-Jul)',
    tasks: ['参加A-Level考试', '收到最终成绩', '确认入读院校', '办理签证和住宿'],
    color: '#4A7C6F',
  },
];

/* ── strategy cards ── */
const STRATEGY_CARDS: { icon: LucideIcon; title: string; content: string; color: string }[] = [
  {
    icon: Target,
    title: '冲刺校与保底校搭配',
    content: '建议按 2:3:2 比例选择冲刺校（录取率<10%）、匹配校（10-30%）、保底校（>30%），分散风险。每个地区至少申请1所保底校。',
    color: '#C8A45C',
  },
  {
    icon: FileText,
    title: '文书准备要点',
    content: '美国重视个人故事和成长经历，英国重视学术热情和专业契合度。避免一篇通用文书投所有学校，针对不同院校定制内容。',
    color: '#3B6EA5',
  },
  {
    icon: Palette,
    title: '作品集准备（艺术生）',
    content: '提前12-18个月开始准备，展现创作过程而不仅是成品，体现个人风格和思考深度。注意每个学校的格式要求和主题偏好。',
    color: '#8B2332',
  },
  {
    icon: Calendar,
    title: '多地区混申策略',
    content: '可以同时申请美+英+加/澳，但需注意各系统截止日期不同，合理分配精力。建议最多申请8-10所院校。',
    color: '#4A7C6F',
  },
  {
    icon: Languages,
    title: '语言考试规划',
    content: '雅思/托福有效期2年，建议AS年级首考，A2上学期出分，预留重考时间。目标美国Top 30建议托福105+或雅思7.5+。',
    color: '#6B4C8A',
  },
  {
    icon: TrendingUp,
    title: 'A-Level选课建议',
    content: '目标理工科：数学+进阶数学+物理；目标商科：数学+经济+进阶数学；目标文科：根据专业方向选择。避免选择与专业无关的"软科目"。',
    color: '#C2553A',
  },
];

/* ── checklist data ── */
const CHECKLIST_GROUPS: ChecklistGroup[] = [
  {
    title: '通用准备',
    items: [
      '确定目标国家/地区和专业方向',
      '研究各院校A-Level要求和录取数据',
      '准备语言考试（雅思/托福）',
      '准备SAT/ACT（美国为主）',
      '联系推荐人（老师/导师）',
      '准备成绩单和在读证明',
    ],
  },
  {
    title: '文书材料',
    items: [
      '撰写美国Common App主文书',
      '撰写美国各校补充文书',
      '撰写英国UCAS个人陈述',
      '准备活动列表/简历',
      '准备奖学金申请材料',
    ],
  },
  {
    title: '申请提交',
    items: [
      '提交EA/ED申请（美国）',
      '提交UCAS申请（英国）',
      '提交RD申请（美国）',
      '提交作品集（艺术生）',
      '确认所有材料已送达',
    ],
  },
  {
    title: '录取后',
    items: [
      '比较录取结果和奖学金',
      '确认入读院校并缴纳押金',
      '申请学生签证',
      '安排住宿',
      '准备行前事项',
    ],
  },
];

const STORAGE_KEY = 'uniguide_checklist_state';

/* ── animations ── */
const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
};

export default function Guide() {
  const { universities, loading } = useData();
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [expandedChecklist, setExpandedChecklist] = useState<string[]>(['通用准备']);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  /* load from localStorage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as string[];
        setCheckedItems(new Set(parsed));
      }
    } catch { /* ignore */ }
  }, []);

  /* save to localStorage */
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...checkedItems]));
  }, [checkedItems]);

  const toggleCheck = (item: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const toggleChecklistGroup = (title: string) => {
    setExpandedChecklist(prev => prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]);
  };

  const totalItems = useMemo(() => CHECKLIST_GROUPS.reduce((s, g) => s + g.items.length, 0), []);
  const completedCount = checkedItems.size;
  const progress = totalItems > 0 ? (completedCount / totalItems) * 100 : 0;

  /* university counts by region from data */
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    universities.forEach(u => {
      const r = u.region;
      counts[r] = (counts[r] || 0) + 1;
    });
    return counts;
  }, [universities]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center" style={{ backgroundColor: '#FAF7F2' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#C8A45C', borderTopColor: 'transparent' }} />
          <p style={{ color: '#6B6560' }}>加载申请指南...</p>
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
          A-Level升学申请指南
        </h1>
        <p className="text-base md:text-lg max-w-2xl" style={{ color: '#6B6560', lineHeight: 1.7 }}>
          以A-Level成绩为核心，了解如何申请全球106所顶尖大学的完整策略、时间线规划与申请技巧。
        </p>
      </motion.div>

      <div className="max-w-[1400px] mx-auto px-6 md:px-10 pb-20 space-y-12">
        {/* ── Section 1: Quick Stats ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {[
            { number: 106, label: '所支持A-Level申请的院校', icon: Globe },
            { number: 8, label: '个申请目的地', icon: MapPin },
            { number: 15, label: '所作品集导向院校', icon: Palette },
          ].map((stat, i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              className="rounded-xl p-5 text-center"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
            >
              <stat.icon size={24} className="mx-auto mb-2" style={{ color: '#C8A45C' }} />
              <div className="text-2xl font-mono-data font-medium" style={{ color: '#C8A45C' }}>{stat.number}</div>
              <div className="text-xs uppercase tracking-wider mt-1" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Section 2: Regional Overview (Accordion) ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
        >
          <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>各地区的A-Level申请概览</h2>
          <div className="space-y-3">
            {REGIONS.map(region => {
              const isOpen = expandedRegion === region.key;
              const actualCount = regionCounts[region.name] || region.count;
              return (
                <motion.div
                  key={region.key}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="rounded-xl overflow-hidden transition-all duration-300"
                  style={{
                    backgroundColor: '#F5F0E8',
                    border: '1px solid #E8E2D9',
                    borderLeft: isOpen ? `3px solid ${region.color}` : '1px solid #E8E2D9',
                  }}
                >
                  {/* Header */}
                  <button
                    onClick={() => setExpandedRegion(isOpen ? null : region.key)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-bg-elevated"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: region.color }} />
                      <span className="font-medium" style={{ color: '#2C2420' }}>{region.name}</span>
                      <span className="text-xs" style={{ color: '#6B6560' }}>{actualCount} 所院校</span>
                    </div>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ChevronDown size={18} style={{ color: '#6B6560' }} />
                    </motion.div>
                  </button>

                  {/* Expanded content */}
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 pt-2 space-y-4" style={{ borderTop: '1px solid #E8E2D9' }}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="rounded-lg p-4" style={{ backgroundColor: '#FFFFFF' }}>
                              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>A-Level角色</div>
                              <div className="text-sm" style={{ color: '#2C2420', lineHeight: 1.7 }}>{region.aLevelRole}</div>
                            </div>
                            <div className="rounded-lg p-4" style={{ backgroundColor: '#FFFFFF' }}>
                              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>申请系统</div>
                              <div className="text-sm" style={{ color: '#2C2420', lineHeight: 1.7 }}>{region.applicationSystem}</div>
                            </div>
                            <div className="rounded-lg p-4" style={{ backgroundColor: '#FFFFFF' }}>
                              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>关键截止日期</div>
                              <div className="text-sm" style={{ color: '#2C2420', lineHeight: 1.7 }}>{region.keyDeadlines}</div>
                            </div>
                            <div className="rounded-lg p-4" style={{ backgroundColor: '#FFFFFF' }}>
                              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: '#6B6560', letterSpacing: '0.06em' }}>A-Level要求</div>
                              <div className="text-sm" style={{ color: '#2C2420', lineHeight: 1.7 }}>{region.aLevelRequirements}</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {region.specialRequirements.map(req => (
                              <span
                                key={req}
                                className="px-3 py-1 rounded-md text-xs"
                                style={{ backgroundColor: `${region.color}15`, color: region.color, border: `1px solid ${region.color}30` }}
                              >
                                {req}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div>
                                <span className="text-xs" style={{ color: '#6B6560' }}>录取率: </span>
                                <span className="text-sm" style={{ color: '#2C2420' }}>{region.acceptanceRate}</span>
                              </div>
                            </div>
                            <button
                              className="flex items-center gap-1 text-sm transition-colors hover:opacity-80"
                              style={{ color: region.color }}
                            >
                              {region.cta} <ChevronDown size={14} className="-rotate-90" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Section 3: Timeline ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <h2 className="font-display text-xl md:text-2xl font-medium mb-6" style={{ color: '#2C2420' }}>申请时间线</h2>
          <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}>
            {/* Desktop: horizontal timeline */}
            <div className="hidden md:block relative">
              {/* Connecting line */}
              <div className="absolute top-7 left-[10%] right-[10%] h-0.5" style={{ backgroundColor: '#E8E2D9' }} />
              <div className="grid grid-cols-5 gap-4 relative">
                {TIMELINE_PHASES.map((phase, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.15, duration: 0.5 }}
                    viewport={{ once: true }}
                    className="text-center"
                  >
                    {/* Node */}
                    <motion.div
                      className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 relative z-10"
                      style={{ backgroundColor: `${phase.color}20`, border: `2px solid ${phase.color}` }}
                      whileHover={{ scale: 1.1 }}
                    >
                      <span className="text-sm font-mono-data font-medium" style={{ color: phase.color }}>{i + 1}</span>
                    </motion.div>
                    {/* Label */}
                    <div className="text-sm font-medium mb-1" style={{ color: '#2C2420' }}>{phase.phase}</div>
                    <div className="text-xs mb-3" style={{ color: phase.color }}>{phase.time}</div>
                    <div className="text-left space-y-1.5 rounded-lg p-3" style={{ backgroundColor: '#F5F0E8' }}>
                      {phase.tasks.map((task, j) => (
                        <div key={j} className="flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: phase.color }} />
                          <span className="text-xs" style={{ color: '#6B6560', lineHeight: 1.5 }}>{task}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Mobile: vertical timeline */}
            <div className="md:hidden relative space-y-6">
              <div className="absolute left-5 top-0 bottom-0 w-0.5" style={{ backgroundColor: '#E8E2D9' }} />
              {TIMELINE_PHASES.map((phase, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  viewport={{ once: true }}
                  className="flex gap-4 relative"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 relative z-10"
                    style={{ backgroundColor: `${phase.color}20`, border: `2px solid ${phase.color}` }}
                  >
                    <span className="text-xs font-mono-data" style={{ color: phase.color }}>{i + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: '#2C2420' }}>{phase.phase}</div>
                    <div className="text-xs mb-2" style={{ color: phase.color }}>{phase.time}</div>
                    <div className="space-y-1">
                      {phase.tasks.map((task, j) => (
                        <div key={j} className="flex items-start gap-1.5">
                          <span className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: phase.color }} />
                          <span className="text-xs" style={{ color: '#6B6560' }}>{task}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* ── Section 4: Strategy Cards ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          <h2 className="font-display text-xl md:text-2xl font-medium mb-4" style={{ color: '#2C2420' }}>申请策略与建议</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {STRATEGY_CARDS.map((card, i) => (
              <motion.div
                key={i}
                variants={cardVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="rounded-xl p-5 transition-all duration-300 hover:-translate-y-1"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
              >
                <card.icon size={28} className="mb-3" style={{ color: card.color }} />
                <h3 className="text-base font-medium mb-2" style={{ color: '#2C2420' }}>{card.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#6B6560', lineHeight: 1.7 }}>{card.content}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── Section 5: Interactive Checklist ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl md:text-2xl font-medium" style={{ color: '#2C2420' }}>申请准备清单</h2>
            <span className="text-xs font-mono-data" style={{ color: '#6B6560' }}>
              {completedCount}/{totalItems}
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full mb-6" style={{ backgroundColor: '#F0EBE3' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: '#C8A45C' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            />
          </div>

          <div className="space-y-3">
            {CHECKLIST_GROUPS.map(group => {
              const isOpen = expandedChecklist.includes(group.title);
              const groupCompleted = group.items.filter(item => checkedItems.has(item)).length;
              const groupProgress = group.items.length > 0 ? (groupCompleted / group.items.length) * 100 : 0;

              return (
                <motion.div
                  key={group.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: '#F5F0E8', border: '1px solid #E8E2D9' }}
                >
                  {/* Group header */}
                  <button
                    onClick={() => toggleChecklistGroup(group.title)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <div className="flex items-center gap-3">
                      {group.title === '通用准备' && <BookOpen size={18} style={{ color: '#3B6EA5' }} />}
                      {group.title === '文书材料' && <FileText size={18} style={{ color: '#8B2332' }} />}
                      {group.title === '申请提交' && <Plane size={18} style={{ color: '#D4943A' }} />}
                      {group.title === '录取后' && <Award size={18} style={{ color: '#4A7C6F' }} />}
                      <span className="font-medium" style={{ color: '#2C2420' }}>{group.title}</span>
                      <span className="text-xs font-mono-data" style={{ color: '#6B6560' }}>
                        {groupCompleted}/{group.items.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Mini progress */}
                      <div className="w-16 h-1.5 rounded-full hidden sm:block" style={{ backgroundColor: '#F0EBE3' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ backgroundColor: groupProgress === 100 ? '#4A7C6F' : '#C8A45C', width: `${groupProgress}%` }}
                        />
                      </div>
                      <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <ChevronDown size={18} style={{ color: '#6B6560' }} />
                      </motion.div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 space-y-2" style={{ borderTop: '1px solid #E8E2D9' }}>
                          {group.items.map((item, j) => {
                            const isChecked = checkedItems.has(item);
                            return (
                              <motion.button
                                key={j}
                                onClick={() => toggleCheck(item)}
                                className="w-full flex items-center gap-3 py-2.5 text-left transition-colors rounded-lg px-2 hover:bg-bg-elevated"
                                whileTap={{ scale: 0.98 }}
                              >
                                <div
                                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all duration-200"
                                  style={{
                                    border: isChecked ? 'none' : '2px solid #E8E2D9',
                                    backgroundColor: isChecked ? '#C8A45C' : 'transparent',
                                  }}
                                >
                                  {isChecked && <Check size={12} style={{ color: '#FAF7F2' }} />}
                                </div>
                                <span
                                  className="text-sm transition-all duration-200"
                                  style={{
                                    color: isChecked ? '#6B6560' : '#6B6560',
                                    textDecoration: isChecked ? 'line-through' : 'none',
                                  }}
                                >
                                  {item}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ── Section 6: Additional Tips ── */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          className="rounded-xl p-6"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E2D9' }}
        >
          <div className="flex items-center gap-2 mb-6">
            <Lightbulb size={22} style={{ color: '#C8A45C' }} />
            <h2 className="font-display text-xl md:text-2xl font-medium" style={{ color: '#2C2420' }}>其他重要提醒</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: '#2C2420' }}>
                <GraduationCap size={16} style={{ color: '#3B6EA5' }} />
                推荐信策略
              </h3>
              <ul className="space-y-2">
                {[
                  '选择熟悉你学术能力的老师， preferably 与申请专业相关的科目老师',
                  '至少提前2个月联系推荐人，提供个人成绩单和简历',
                  '美国通常需要2-3封，英国通常1封即可',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#6B6560', lineHeight: 1.6 }}>
                    <span className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#3B6EA5' }} />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: '#2C2420' }}>
                <Building2 size={16} style={{ color: '#4A7C6F' }} />
                面试准备
              </h3>
              <ul className="space-y-2">
                {[
                  '英国牛剑和医学专业面试侧重学术思维和解题能力',
                  '美国面试更关注个人特质、兴趣和社区贡献',
                  '提前模拟练习，准备3-5个有深度的反问问题',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#6B6560', lineHeight: 1.6 }}>
                    <span className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#4A7C6F' }} />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: '#2C2420' }}>
                <Clock size={16} style={{ color: '#D4943A' }} />
                奖学金申请时间线
              </h3>
              <ul className="space-y-2">
                {[
                  '大部分奖学金截止日期与申请截止日期一致或更早',
                  '英国Chevening奖学金通常提前1年申请（8月开放）',
                  '美国部分学校Need-Blind政策自动考虑奖学金，无需额外申请',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#6B6560', lineHeight: 1.6 }}>
                    <span className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#D4943A' }} />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: '#2C2420' }}>
                <Target size={16} style={{ color: '#8B2332' }} />
                常见错误避免
              </h3>
              <ul className="space-y-2">
                {[
                  '不要等到最后一刻才提交申请，系统可能崩溃',
                  'UCAS个人陈述有4000字符限制，提前精简内容',
                  '不要忽视保底校的申请，确保至少有一个可靠选择',
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#6B6560', lineHeight: 1.6 }}>
                    <span className="w-1 h-1 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: '#8B2332' }} />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
