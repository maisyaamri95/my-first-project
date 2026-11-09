import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

/** Butang yang perlu ditekan dua kali (pelayar dalam app tidak memaparkan confirm()). */
export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'link danger', disabled }: {
  label: string; confirmLabel: string; onConfirm: () => unknown; className?: string; disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const t = useRef<number>();
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => {
      if (!armed) { setArmed(true); t.current = window.setTimeout(() => setArmed(false), 4000); return; }
      window.clearTimeout(t.current); setArmed(false); onConfirm();
    }}>{armed ? confirmLabel : label}</button>
  );
}

export function Empty({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="empty">{title && <b>{title}</b>}{children}</div>;
}

export function Chip({ tone = '', children }: { tone?: '' | 'overdue' | 'today' | 'eg' | 'pro'; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

/** Kad untuk ciri Premium bila pengguna masih percuma. */
export function Paywall({ title, points, compact }: { title: string; points?: string[]; compact?: boolean }) {
  return (
    <div className={`paywall card${compact ? ' compact' : ''}`}>
      <div className="pw-head"><span className="pw-ico"><Icon name="lock" size={18} stroke={2.2} /></span><b>{title}</b></div>
      {points && <ul>{points.map(p => <li key={p}>{p}</li>)}</ul>}
      <Link className="btn primary" to="/premium">Lihat pelan Premium</Link>
    </div>
  );
}

export function MoneyInput({ id, value, onChange, placeholder = '0.00', big, autoFocus }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; big?: boolean; autoFocus?: boolean;
}) {
  return (
    <div className={`money${big ? ' big' : ''}`}>
      <span className="cur">RM</span>
      <input id={id} inputMode="decimal" autoComplete="off" placeholder={placeholder} value={value} autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}
