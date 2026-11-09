import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';

const TABS = [
  { to: '/tugas', label: 'Tugas', icon: 'tugas' },
  { to: '/belanja', label: 'Belanja', icon: 'belanja' },
  { to: '/cukai', label: 'Cukai', icon: 'cukai' },
  { to: '/akaun', label: 'Akaun', icon: 'akaun' },
];

export function TabBar({ badge }: { badge?: number }) {
  return (
    <nav className="tabs" aria-label="Bahagian utama">
      <div className="tabs-in">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} className="tab">
            <Icon name={t.icon} size={24} stroke={1.8} />
            {t.label}
            {t.to === '/tugas' && !!badge && <span className="badge">{badge}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
