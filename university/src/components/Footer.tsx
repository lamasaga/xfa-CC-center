const QUICK_LINKS = [
  { label: '首页', href: '#hero' },
  { label: '院校探索', href: '#explore' },
  { label: '生活成本', href: '#living-cost' },
  { label: '职业前景', href: '#career' },
  { label: '申请指南', href: '#guide' },
];

const DATA_SOURCES = [
  { label: 'QS Rankings', href: 'https://www.topuniversities.com' },
  { label: 'US News', href: 'https://www.usnews.com' },
  { label: 'THE Rankings', href: 'https://www.timeshighereducation.com' },
  { label: 'Numbeo', href: 'https://www.numbeo.com' },
  { label: 'PayScale', href: 'https://www.payscale.com' },
  { label: 'HESA', href: 'https://www.hesa.ac.uk' },
  { label: 'NACE', href: 'https://www.naceweb.org' },
];

export default function Footer() {
  const handleClick = (href: string) => {
    if (href.startsWith('#')) {
      const el = document.getElementById(href.slice(1));
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <footer
      className="relative w-full"
      style={{
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E8E2D9',
      }}
    >
      {/* Subtle texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232C2420' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '30px 30px',
        }}
      />

      <div
        className="relative max-w-[1400px] mx-auto"
        style={{
          padding: '64px max(24px, 2vw) 32px',
        }}
      >
        {/* 4-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-0 mb-4">
              <span
                className="font-space text-lg font-bold tracking-tight"
                style={{ color: '#2C2420' }}
              >
                UniGuide
              </span>
              <span
                className="inline-block rounded-full ml-[2px]"
                style={{ width: 6, height: 6, backgroundColor: '#C8A45C' }}
              />
            </div>
            <p
              className="text-[15px] leading-relaxed"
              style={{ color: '#6B6560', maxWidth: 280 }}
            >
              全球留学择校指南，为A-Level学子提供数据驱动的院校选择工具。
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h4
              className="text-xs font-medium uppercase tracking-wider mb-4"
              style={{ color: '#6B6560', letterSpacing: '0.08em' }}
            >
              导航
            </h4>
            <ul className="space-y-0">
              {QUICK_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault();
                      handleClick(link.href);
                    }}
                    className="block text-[15px] py-[6px] transition-colors duration-200 hover:text-accent-gold"
                    style={{ color: '#6B6560', lineHeight: 2.2 }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Data sources */}
          <div>
            <h4
              className="text-xs font-medium uppercase tracking-wider mb-4"
              style={{ color: '#6B6560', letterSpacing: '0.08em' }}
            >
              数据来源
            </h4>
            <ul className="space-y-0">
              {DATA_SOURCES.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[15px] py-[6px] transition-colors duration-200 hover:text-accent-gold"
                    style={{ color: '#6B6560', lineHeight: 2.2 }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div>
            <h4
              className="text-xs font-medium uppercase tracking-wider mb-4"
              style={{ color: '#6B6560', letterSpacing: '0.08em' }}
            >
              关于
            </h4>
            <div className="space-y-2">
              <p className="text-[15px]" style={{ color: '#6B6560' }}>
                数据更新于 2025年1月
              </p>
              <p className="text-[15px]" style={{ color: '#6B6560' }}>
                涵盖106所院校 · 8个地区
              </p>
              <p className="text-[15px]" style={{ color: '#6B6560' }}>
                51个城市生活数据
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6"
          style={{ borderTop: '1px solid #E8E2D9' }}
        >
          <p
            className="text-center text-xs"
            style={{ color: '#6B6560', padding: '24px 0' }}
          >
            &copy; 2025 UniGuide. 仅供教育参考。
          </p>
        </div>
      </div>
    </footer>
  );
}
