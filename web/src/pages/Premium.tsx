import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../data/AppContext';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { PLANS, PLAN_ORDER, type PlanId } from '../lib/plans';
import { fmtRM } from '../lib/money';
import { startCheckout } from '../lib/billing';
import { FREE_HISTORY_MONTHS } from '../config';

const FEATURES: [string, boolean, boolean][] = [
  ['Senarai tugas tanpa had', true, true],
  ['Rekod belanja & bajet bulanan', true, true],
  [`Sejarah belanja`, true, true],
  ['Penjejak pelepasan cukai LHDN', false, true],
  ['Simpan gambar resit', false, true],
  ['Ruang keluarga: kongsi bajet dengan pasangan', false, true],
  ['Eksport ke Excel (CSV)', false, true],
];

export default function PremiumPage() {
  const { repo, user, premium, refresh } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<PlanId | null>(null);

  async function choose(plan: PlanId) {
    if (!user) { navigate('/masuk', { state: { from: '/premium' } }); return; }
    setBusy(plan);
    try {
      if (repo.kind === 'demo') {
        await repo.setDemoPremium?.(true);
        await refresh();
        toast.show('Mod demo: Premium dihidupkan tanpa bayaran.');
        navigate('/akaun');
        return;
      }
      await startCheckout(repo, plan);
    } catch (e) { toast.error(e); setBusy(null); }
  }

  return (
    <div className="page-solo">
      <div className="solo-top"><Link to={user ? '/akaun' : '/masuk'} className="back"><Icon name="left" size={18} stroke={2.2} /> Kembali</Link></div>
      <div className="hero">
        <span className="plan-badge on big"><Icon name="star" size={16} stroke={2.2} />Premium</span>
        <h1>Urus duit keluarga dengan lebih tenang</h1>
        <p>Satu langganan untuk seisi rumah. Ahli ruang keluarga anda turut mendapat Premium.</p>
      </div>

      {premium && <p className="notice ok">Anda sudah Premium. Terima kasih kerana menyokong app ini.</p>}

      <div className="plans">
        {PLAN_ORDER.map(id => {
          const p = PLANS[id];
          return (
            <div key={id} className={`plan card${id === 'yearly' ? ' best' : ''}`}>
              {id === 'yearly' && <span className="ribbon">Paling jimat</span>}
              <div className="plan-name">{p.name}</div>
              <div className="plan-price"><span className="cur">RM</span>{fmtRM(p.price)}<span className="per">/ {p.per}</span></div>
              <div className="muted small">{p.note}</div>
              <button type="button" className={`btn ${id === 'yearly' ? 'primary' : 'ghost'} wide`} disabled={!!busy || premium} onClick={() => choose(id)}>
                {busy === id ? 'Membuka pembayaran…' : `Pilih ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card compare">
        <div className="cmp-row head"><span /><span>Percuma</span><span>Premium</span></div>
        {FEATURES.map(([f, free, pro]) => (
          <div className="cmp-row" key={f}>
            <span>{f === 'Sejarah belanja' ? `Sejarah belanja (${FREE_HISTORY_MONTHS} bulan / tanpa had)` : f}</span>
            <span>{free ? <Icon name="check" size={18} stroke={2.6} className="yes" /> : <span className="no">–</span>}</span>
            <span>{pro ? <Icon name="check" size={18} stroke={2.6} className="yes" /> : <span className="no">–</span>}</span>
          </div>
        ))}
      </div>

      <p className="muted small center">
        Bayaran diproses dengan selamat oleh Stripe. Langganan diperbaharui secara automatik dan boleh dibatalkan bila-bila masa di Akaun.
        Lihat <Link to="/terma">Terma</Link> dan <Link to="/bayaran-balik">Polisi Bayaran Balik</Link>.
      </p>
    </div>
  );
}
