import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../data/AppContext';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { ConfirmButton } from '../components/ui';
import { describeSubscription, subscriptionIsActive } from '../lib/subscription';
import { toCsv } from '../lib/csv';
import { CATEGORY } from '../lib/categories';
import { reliefYear } from '../lib/taxRelief';
import { parseYmd, todayStr } from '../lib/dates';
import { AppError } from '../lib/errors';
import { openPortal } from '../lib/billing';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export default function AccountPage() {
  const app = useApp();
  const { repo, user, profile, households, household, members, premium, subscription, refresh, switchHousehold } = app;
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [famName, setFamName] = useState('Keluarga');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(profile?.displayName ?? ''), [profile?.displayName]);

  const ownSub = subscriptionIsActive(subscription);
  const isOwner = household?.ownerId === user?.id;
  const year = parseYmd(todayStr()).getFullYear();

  // Kembali dari Stripe: tunggu webhook mengaktifkan Premium (biasanya beberapa saat).
  useEffect(() => {
    if (params.get('bayar') !== 'berjaya') return;
    toast.show('Terima kasih! Premium sedang diaktifkan…');
    let n = 0;
    const t = window.setInterval(async () => {
      n++;
      await refresh().catch(() => {});
      if (n >= 10) window.clearInterval(t);
    }, 2000);
    setParams({}, { replace: true });
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try { await fn(); if (ok) toast.show(ok); } catch (e) { toast.error(e); } finally { setBusy(false); }
  }

  const saveName = (e: FormEvent) => { e.preventDefault(); run(async () => { await repo.updateProfile({ displayName: name.trim() }); await refresh(); }, 'Nama disimpan.'); };
  const createFamily = (e: FormEvent) => { e.preventDefault(); run(async () => { await repo.createHousehold(famName); await refresh(); }, 'Ruang keluarga dicipta. Jana kod jemputan untuk ajak ahli keluarga.'); };
  const join = (e: FormEvent) => {
    e.preventDefault();
    const c = code.replace(/\s/g, '').toUpperCase();
    if (c.length !== 8) { toast.show('Kod jemputan ada 8 aksara.'); return; }
    run(async () => { await repo.joinHousehold(c); setCode(''); await refresh(); }, 'Anda sudah menyertai ruang keluarga.');
  };
  const changePw = (e: FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { toast.show('Kata laluan mesti sekurang-kurangnya 8 aksara.'); return; }
    run(async () => { await repo.updatePassword(pw); setPw(''); }, 'Kata laluan ditukar.');
  };
  async function copyCode(c: string) {
    try { await navigator.clipboard.writeText(c); toast.show('Kod disalin.'); } catch { toast.show(`Kod: ${c}`); }
  }

  async function exportExpenses() {
    if (!household) return;
    await run(async () => {
      if (!premium) throw new AppError('premium_required');
      const rows = await repo.listExpenses(household.id, `${year}-01-01`, `${year + 1}-01-01`);
      rows.sort((a, b) => a.date.localeCompare(b.date));
      download(`belanja-${year}.csv`, toCsv([['Tarikh', 'Keterangan', 'Kategori', 'Jumlah (RM)'],
        ...rows.map(r => [r.date, r.label, CATEGORY[r.category].name, r.amount.toFixed(2)])]));
    });
  }
  async function exportTax() {
    await run(async () => {
      if (!premium) throw new AppError('premium_required');
      const def = reliefYear(year);
      const rows = await repo.listClaims(year);
      rows.sort((a, b) => a.date.localeCompare(b.date));
      download(`pelepasan-cukai-TT${year}.csv`, toCsv([['Tarikh', 'Kategori pelepasan', 'Nota', 'Jumlah (RM)', 'Ada gambar resit'],
        ...rows.map(r => [r.date, def.categories.find(c => c.code === r.category)?.name ?? r.category, r.note, r.amount.toFixed(2), r.receiptPath ? 'Ya' : 'Tidak'])]));
    });
  }

  return (
    <section aria-labelledby="h-akaun">
      <div className="hero">
        <h1 id="h-akaun">Akaun</h1>
        <p>{user?.email}</p>
      </div>

      {/* Langganan */}
      <div className="card stack">
        <div className="lbl">Langganan</div>
        <div className="plan-line">
          <span className={`plan-badge${premium ? ' on' : ''}`}><Icon name="star" size={14} stroke={2.2} />{premium ? 'Premium' : 'Percuma'}</span>
          <span className="muted">{ownSub ? describeSubscription(subscription) : premium ? 'Melalui ruang keluarga' : 'Ciri asas'}</span>
        </div>
        {!premium && <Link className="btn primary" to="/premium">Naik taraf ke Premium</Link>}
        {ownSub && subscription?.stripe_customer_id && (
          <button type="button" className="btn ghost" disabled={busy} onClick={() => run(() => openPortal(repo))}>Urus langganan & resit bayaran</button>
        )}
        {repo.kind === 'demo' && (
          <label className="switch">
            <input type="checkbox" checked={premium} onChange={e => run(async () => { await repo.setDemoPremium?.(e.target.checked); await refresh(); })} />
            <span>Premium (mod demo, tanpa bayaran)</span>
          </label>
        )}
      </div>

      {/* Ruang & keluarga */}
      <div className="card stack">
        <div className="lbl">Ruang & keluarga</div>
        <p className="muted">Tugas, belanja dan bajet disimpan dalam satu ruang. Ruang keluarga dikongsi dengan ahli yang anda jemput. Rekod cukai sentiasa peribadi.</p>
        {households.length > 1 && (
          <div className="seg" role="radiogroup" aria-label="Ruang aktif">
            {households.map(h => (
              <button key={h.id} type="button" role="radio" aria-checked={h.id === household?.id} className="seg-btn"
                onClick={() => run(() => switchHousehold(h.id))}>{h.isPersonal ? 'Peribadi' : h.name}</button>
            ))}
          </div>
        )}

        {household && !household.isPersonal && (
          <div className="sub">
            <div className="sub-h"><Icon name="users" size={18} /> <b>{household.name}</b><span className="muted"> · {members.length} ahli</span></div>
            <ul className="members">
              {members.map(m => (
                <li key={m.userId}>
                  <span>{m.displayName || 'Ahli'}{m.userId === user?.id ? ' (anda)' : ''}</span>
                  <span className="muted">{m.role === 'owner' ? 'Pemilik' : 'Ahli'}</span>
                  {isOwner && m.role !== 'owner' && (
                    <ConfirmButton label="Buang" confirmLabel="Pasti?" onConfirm={() => run(async () => { await repo.removeMember(household.id, m.userId); await refresh(); }, 'Ahli dibuang.')} />
                  )}
                </li>
              ))}
            </ul>
            {isOwner && (
              household.inviteCode ? (
                <div className="invite">
                  <div className="lbl">Kod jemputan</div>
                  <div className="code-row">
                    <code className="code">{household.inviteCode}</code>
                    <button type="button" className="btn ghost small" onClick={() => copyCode(household.inviteCode!)}><Icon name="copy" size={16} /> Salin</button>
                  </div>
                  <p className="muted small">Ahli keluarga masukkan kod ini di Akaun → “Sertai ruang keluarga”. Maksimum 6 orang.</p>
                  <div className="row-links">
                    <button type="button" className="link" disabled={busy} onClick={() => run(async () => { await repo.createInvite(household.id); await refresh(); }, 'Kod baharu dijana. Kod lama tidak sah lagi.')}>Jana kod baharu</button>
                    <button type="button" className="link danger" disabled={busy} onClick={() => run(async () => { await repo.clearInvite(household.id); await refresh(); }, 'Kod jemputan dimatikan.')}>Matikan kod</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="btn primary" disabled={busy || !ownSub} onClick={() => run(async () => { await repo.createInvite(household.id); await refresh(); })}>
                  Jana kod jemputan
                </button>
              )
            )}
            {isOwner
              ? <ConfirmButton label="Padam ruang ini dan semua datanya" confirmLabel="Tekan sekali lagi: semua tugas & belanja ruang ini akan dipadam"
                  onConfirm={() => run(async () => { await repo.deleteHousehold(household.id); await refresh(); }, 'Ruang dipadam.')} />
              : <ConfirmButton label="Keluar dari ruang ini" confirmLabel="Tekan sekali lagi untuk keluar"
                  onConfirm={() => run(async () => { await repo.leaveHousehold(household.id); await refresh(); }, 'Anda sudah keluar.')} />}
          </div>
        )}

        {ownSub ? (
          <form className="inline-form" onSubmit={createFamily}>
            <label htmlFor="famName" className="lbl">Cipta ruang keluarga</label>
            <div className="row">
              <input id="famName" className="field" maxLength={60} value={famName} onChange={e => setFamName(e.target.value)} />
              <button type="submit" className="btn ghost" disabled={busy}>Cipta</button>
            </div>
          </form>
        ) : !premium && (
          <p className="muted small"><Icon name="lock" size={14} stroke={2.2} /> Cipta ruang keluarga dan jemput pasangan dengan <Link to="/premium">Premium</Link>.</p>
        )}

        <form className="inline-form" onSubmit={join}>
          <label htmlFor="joinCode" className="lbl">Sertai ruang keluarga</label>
          <div className="row">
            <input id="joinCode" className="field mono" placeholder="Kod 8 aksara" maxLength={12} autoCapitalize="characters" autoComplete="off"
              value={code} onChange={e => setCode(e.target.value)} />
            <button type="submit" className="btn ghost" disabled={busy}>Sertai</button>
          </div>
        </form>
      </div>

      {/* Profil */}
      <form className="card stack" onSubmit={saveName}>
        <label htmlFor="dispName" className="lbl">Nama paparan</label>
        <p className="muted small">Dipaparkan kepada ahli ruang keluarga anda.</p>
        <div className="row">
          <input id="dispName" className="field" maxLength={60} value={name} onChange={e => setName(e.target.value)} />
          <button type="submit" className="btn ghost" disabled={busy}>Simpan</button>
        </div>
      </form>

      {/* Eksport */}
      <div className="card stack">
        <div className="lbl">Eksport data {year}</div>
        <p className="muted small">Fail CSV boleh dibuka dalam Excel, Numbers atau Google Sheets.{!premium && ' Ciri Premium.'}</p>
        <div className="row wrap">
          <button type="button" className="btn ghost" disabled={busy} onClick={exportExpenses}><Icon name="download" size={16} /> Belanja</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={exportTax}><Icon name="download" size={16} /> Rekod cukai</button>
        </div>
      </div>

      {/* Keselamatan */}
      {repo.kind === 'cloud' && (
        <form className="card stack" onSubmit={changePw}>
          <label htmlFor="newPw" className="lbl">Tukar kata laluan</label>
          <div className="row">
            <input id="newPw" className="field" type="password" autoComplete="new-password" placeholder="Sekurang-kurangnya 8 aksara" value={pw} onChange={e => setPw(e.target.value)} />
            <button type="submit" className="btn ghost" disabled={busy}>Tukar</button>
          </div>
        </form>
      )}

      <div className="card stack">
        <div className="lbl">Maklumat</div>
        <div className="row-links">
          <Link to="/privasi">Polisi Privasi</Link><Link to="/terma">Terma Penggunaan</Link><Link to="/bayaran-balik">Polisi Bayaran Balik</Link>
        </div>
        <button type="button" className="btn ghost" onClick={() => run(async () => { await repo.signOut(); navigate('/masuk'); })}>Log keluar</button>
        <ConfirmButton label="Padam akaun saya" confirmLabel="Tekan sekali lagi: akaun, data dan langganan akan dipadam untuk selamanya"
          onConfirm={() => run(async () => { await repo.deleteAccount(); navigate('/masuk'); }, 'Akaun anda telah dipadam.')} />
      </div>
    </section>
  );
}
