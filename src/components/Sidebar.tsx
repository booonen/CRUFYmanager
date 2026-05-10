import { NavLink } from 'react-router-dom';
import { t } from '../lang';
import { useIssueCount } from '../routes/Issues';

interface NavItem {
  to: string;
  labelKey: string;
  icon: string;
  end?: boolean;
  badge?: 'issues';
}

interface NavGroup {
  headingKey: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    headingKey: 'nav.section_overview',
    items: [{ to: '/dashboard', labelKey: 'nav.dashboard', icon: '◈' }],
  },
  {
    headingKey: 'nav.section_main',
    items: [
      { to: '/calendar', labelKey: 'nav.calendar', icon: '◰' },
      { to: '/competitions', labelKey: 'nav.competitions', icon: '◇' },
      { to: '/clubs', labelKey: 'nav.clubs', icon: '◎' },
      { to: '/players', labelKey: 'nav.players', icon: '◐' },
      { to: '/managers', labelKey: 'nav.managers', icon: '◑' },
    ],
  },
  {
    headingKey: 'nav.section_country',
    items: [
      { to: '/national-team', labelKey: 'nav.nationalTeam', icon: '✦' },
      { to: '/other-matches', labelKey: 'nav.otherMatches', icon: '◆' },
    ],
  },
  {
    headingKey: 'nav.section_records',
    items: [{ to: '/history', labelKey: 'nav.history', icon: '◍' }],
  },
  {
    headingKey: 'nav.section_world',
    items: [{ to: '/world', labelKey: 'nav.world', icon: '◌' }],
  },
  {
    headingKey: 'nav.section_system',
    items: [
      { to: '/issues', labelKey: 'nav.issues', icon: '◭', badge: 'issues' },
      { to: '/generator', labelKey: 'nav.generator', icon: '⚙' },
      { to: '/saves', labelKey: 'nav.saves', icon: '◉' },
    ],
  },
];

export function Sidebar() {
  const issueCount = useIssueCount();

  return (
    <nav className="sidebar">
      {NAV.map((group) => (
        <div key={group.headingKey} className="sidebar__section">
          <div className="sidebar__heading">{t(group.headingKey)}</div>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'nav-item nav-item--active' : 'nav-item'
              }
            >
              <span className="nav-item__icon">{item.icon}</span>
              <span>{t(item.labelKey)}</span>
              {item.badge === 'issues' && issueCount > 0 ? (
                <span className="nav-item__badge mono">{issueCount}</span>
              ) : null}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
