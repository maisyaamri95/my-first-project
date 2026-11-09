import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../data/AppContext';
import { errorMessage } from '../lib/errors';
import { Icon } from '../components/Icon';
import { APP_NAME, APP_TAGLINE } from '../config';

type Mode = 'masuk' | 'daftar' | 'lupa';

export default function LoginPage() {
  const { repo, user, ready } = useApp();
  const navigate = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/tugas';
  const [mode, setMode] = useState<Mode>('masuk');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to={from} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const em = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) { setMsg({ kind: 'err', text: 'Masukkan alamat emel yang sah.' }); return; }
    if (mode !== 'lupa' && pw.length < 8) { setMsg({ kind: 'err', text: 'Kata laluan mesti sekurang-kurangnya 8 aksara.' }); return; }
    setBusy(true);
    try {
      if (mode === 'masuk') { await repo.signIn(em, pw); navigate(from, { replace: true }); }
      else if (mode === 'daftar') {
        const { needsConfirm } = await repo.signUp(em, pw);
        if (needsConfirm) { setMsg({ kind: 'ok', text: `Kami hantar emel pengesahan ke ${em}. Tekan pautan dalam emel itu, kemudian log masuk di sini.` }); setMode('masuk'); }
        else navigate(from, { replace: true });
      } else {
        await repo.sendReset(em);
        setMsg({ kind: 'ok', text: `Jika ${em} berdaftar, pautan untuk set semula kata laluan telah dihantar. Semak peti masuk dan folder spam.` });
      }
    } catch (err) { setMsg({ kind: 'err', text: errorMessage(err) }); }
    finally { setBusy(false); }
  }

  return (
    <div className="page-solo login">
      <div className="login-brand">
        <span className="mark big"><Icon name="check" size={26} stroke={2.6} /></span>
        <h1>{APP_NAME}</h1>
        <p>{APP_TAGLINE}</p>
      </div>

      {repo.kind === 'demo' && (
        <div className="card stack demo-card">
          <b>Mod demo</b>
          <p className="muted small">Pangkalan data belum disambung. Anda boleh cuba semua ciri; data disimpan dalam pelayar ini sahaja.</p>
          <button type="button" className="btn primary wide" onClick={async () => { await repo.signIn('', ''); navigate(from, { replace: true }); }}>Masuk mod demo</button>
        </div>
      )}

      {repo.kind === 'cloud' && (
        <form className="card stack" onSubmit={submit} noValidate>
          {mode !== 'lupa' && (
            <div className="seg" role="tablist">
              <button type="button" role="tab" className="seg-btn" aria-selected={mode === 'masuk'} onClick={() => { setMode('masuk'); setMsg(null); }}>Log masuk</button>
              <button type="button" role="tab" className="seg-btn" aria-selected={mode === 'daftar'} onClick={() => { setMode('daftar'); setMsg(null); }}>Daftar</button>
            </div>
          )}
          {mode === 'lupa' && <b>Set semula kata laluan</b>}
          <label htmlFor="email" className="lbl">Emel</label>
          <input id="email" className="field" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} />
          {mode !== 'lupa' && (
            <>
              <label htmlFor="pw" className="lbl">Kata laluan</label>
              <input id="pw" className="field" type="password" autoComplete={mode === 'daftar' ? 'new-password' : 'current-password'}
                placeholder={mode === 'daftar' ? 'Sekurang-kurangnya 8 aksara' : ''} value={pw} onChange={e => setPw(e.target.value)} />
            </>
          )}
          {msg && <div className={msg.kind === 'err' ? 'err' : 'notice ok'} role="alert">{msg.text}</div>}
          <button type="submit" className="btn primary wide" disabled={busy}>
            {busy ? 'Sebentar…' : mode === 'masuk' ? 'Log masuk' : mode === 'daftar' ? 'Daftar percuma' : 'Hantar pautan'}
          </button>
          {mode === 'masuk' && <button type="button" className="link" onClick={() => { setMode('lupa'); setMsg(null); }}>Lupa kata laluan?</button>}
          {mode === 'lupa' && <button type="button" className="link" onClick={() => { setMode('masuk'); setMsg(null); }}>Kembali ke log masuk</button>}
          {mode === 'daftar' && <p className="muted small">Dengan mendaftar, anda bersetuju dengan <Link to="/terma">Terma</Link> dan <Link to="/privasi">Polisi Privasi</Link>.</p>}
        </form>
      )}

      <p className="muted small center"><Link to="/premium">Lihat pelan Premium</Link> · <Link to="/privasi">Privasi</Link> · <Link to="/terma">Terma</Link></p>
    </div>
  );
}

/** Dipaparkan bila pengguna buka pautan "set semula kata laluan" dari emel. */
export function SetPassword() {
  const { repo, setRecovery } = useApp();
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { setMsg('Kata laluan mesti sekurang-kurangnya 8 aksara.'); return; }
    setBusy(true);
    try { await repo.updatePassword(pw); setRecovery(false); }
    catch (err) { setMsg(errorMessage(err)); }
    finally { setBusy(false); }
  }
  return (
    <div className="page-solo login">
      <form className="card stack" onSubmit={submit}>
        <b>Tetapkan kata laluan baharu</b>
        <label htmlFor="npw" className="lbl">Kata laluan baharu</label>
        <input id="npw" className="field" type="password" autoComplete="new-password" value={pw} onChange={e => setPw(e.target.value)} />
        {msg && <div className="err" role="alert">{msg}</div>}
        <button type="submit" className="btn primary wide" disabled={busy}>Simpan kata laluan</button>
      </form>
    </div>
  );
}
