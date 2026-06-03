import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { label: '院校浏览', href: '/', title: '按地区筛选、查看院校卡片与详情' },
  { label: '生活成本', href: '/living-cost', title: '各留学城市生活成本指数与预算参考' },
  { label: '薪资就业', href: '/career', title: '毕业生薪资、就业率与专业方向参考' },
  { label: '申请指南', href: '/guide', title: '分国家/地区的申请流程与要点' },
] as const;

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/' || location.pathname === '/explore';
    }
    return location.pathname === href;
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-md px-4 sm:px-6 lg:px-8"
        aria-label="站点主导航"
      >
        <Link
          to="/"
          className="flex items-center gap-2 no-underline shrink-0"
          onClick={() => setMobileOpen(false)}
        >
          <span className="font-serif text-lg font-semibold tracking-tight text-foreground">
            XFA 院校探索
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6" role="list">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              title={link.title}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={cn(
                'relative text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {link.label}
              <span
                className={cn(
                  'absolute -bottom-0.5 left-0 h-0.5 bg-primary transition-all duration-200',
                  isActive(link.href) ? 'w-full' : 'w-0'
                )}
              />
            </Link>
          ))}
        </div>

        <button
          type="button"
          className="p-2 rounded-md text-muted-foreground hover:bg-muted md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {mobileOpen && (
        <div
          id="mobile-nav-panel"
          className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-background/98 backdrop-blur-sm md:hidden pt-16"
          role="dialog"
          aria-modal="true"
          aria-label="站点导航"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              title={link.title}
              onClick={() => setMobileOpen(false)}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={cn(
                'font-serif text-2xl transition-colors text-center',
                isActive(link.href) ? 'text-primary' : 'text-foreground'
              )}
            >
              {link.label}
              <span className="block text-xs font-sans text-muted-foreground mt-1 max-w-[16rem]">
                {link.title}
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
