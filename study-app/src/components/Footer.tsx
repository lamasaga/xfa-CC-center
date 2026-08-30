import { Link } from 'react-router-dom';

const QUICK_LINKS = [
  { label: '院校浏览', href: '/' },
  { label: '生活成本', href: '/living-cost' },
  { label: '薪资就业', href: '/career' },
  { label: '申请指南', href: '/guide' },
];

const DATA_SOURCES = [
  { label: 'QS Rankings', href: 'https://www.topuniversities.com' },
  { label: 'US News', href: 'https://www.usnews.com' },
  { label: 'THE Rankings', href: 'https://www.timeshighereducation.com' },
  { label: 'Numbeo', href: 'https://www.numbeo.com' },
];

export default function Footer() {
  return (
    <footer className="w-full border-t border-border bg-card">
      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <p className="font-serif text-lg font-semibold text-foreground">XFA 院校探索</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-3 max-w-xs">
              与升学指导中心配套的院校浏览工具，供学生与家长查阅全球院校信息。
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              导航
            </h4>
            <ul className="space-y-2">
              {QUICK_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              数据来源
            </h4>
            <ul className="space-y-2">
              {DATA_SOURCES.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
              申请难度天梯
            </h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              我们将全球院校按申请难度划分为五个等级，从「爬藤难度」到「稳健申请」，每个等级对应明确的学术成绩、语言能力、竞赛经历、课外活动及面试要求。通过天梯，你可以快速定位目标院校所处的难度档位，了解不同层级的真实申请门槛，从而制定更清晰的升学规划与备考策略。
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-10 pt-6 border-t border-border">
          &copy; {new Date().getFullYear()} XFA 升学指导中心
        </p>
      </div>
    </footer>
  );
}
