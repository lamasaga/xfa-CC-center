import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Heart, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: '首页', href: '/' },
  { label: '院校探索', href: '/explore' },
  { label: '生活成本', href: '/living-cost' },
  { label: '职业前景', href: '/career' },
  { label: '申请指南', href: '/guide' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [savedCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname === href;
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-[1000] h-16 flex items-center justify-between transition-all duration-300"
        style={{
          backgroundColor: scrolled ? 'rgba(250, 247, 242, 0.92)' : 'rgba(250, 247, 242, 0.6)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #E8E2D9',
          padding: '0 max(24px, 2vw)',
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-0 no-underline"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <span
            className="font-space text-lg font-bold tracking-tight"
            style={{ color: '#2C2420' }}
          >
            UniGuide
          </span>
          <span
            className="inline-block rounded-full ml-[2px]"
            style={{
              width: 6,
              height: 6,
              backgroundColor: '#C8A45C',
            }}
          />
        </Link>

        {/* Center nav links - desktop */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              onClick={() => setMobileOpen(false)}
              className="relative text-[15px] font-body-cn transition-colors duration-300 hover:text-accent-gold group"
              style={{ color: isActive(link.href) ? '#C8A45C' : '#6B6560' }}
            >
              {link.label}
              <span
                className="absolute bottom-[-2px] left-0 h-[1px] bg-accent-gold transition-all duration-300"
                style={{ width: isActive(link.href) ? '100%' : '0%' }}
              />
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-lg transition-colors duration-200 hover:bg-bg-elevated"
            aria-label="搜索"
          >
            <Search size={20} style={{ color: '#6B6560' }} className="hover:text-text-primary transition-colors" />
          </button>
          <button
            className="p-2 rounded-lg transition-colors duration-200 hover:bg-bg-elevated relative"
            aria-label="收藏"
          >
            <Heart size={20} style={{ color: '#6B6560' }} className="hover:text-text-primary transition-colors" />
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent-crimson text-text-primary text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {savedCount}
              </span>
            )}
          </button>

          {/* Mobile hamburger */}
          <button
            className="p-2 rounded-lg transition-colors duration-200 hover:bg-bg-elevated md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="菜单"
          >
            {mobileOpen ? (
              <X size={20} style={{ color: '#6B6560' }} />
            ) : (
              <Menu size={20} style={{ color: '#6B6560' }} />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[999] flex flex-col items-center justify-center gap-8 md:hidden"
          style={{ backgroundColor: '#FAF7F2' }}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              onClick={() => setMobileOpen(false)}
              className="font-space text-4xl font-normal transition-colors duration-300 hover:text-accent-gold"
              style={{
                color: isActive(link.href) ? '#C8A45C' : '#2C2420',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
