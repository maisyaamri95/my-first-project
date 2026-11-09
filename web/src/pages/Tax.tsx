import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../data/AppContext';
import { useLoad } from '../data/useLoad';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { ConfirmButton, Empty, MoneyInput, Paywall } from '../components/ui';
import { isYmd, parseYmd, shortDate, todayStr } from '../lib/dates';
import { fmtRM, fmtSen, parseAmount } from '../lib/money';
import { RELIEF_YEARS, reliefYear, summarizeRelief, type ReliefRow } from '../lib/taxRelief';
import { compressImage } from '../lib/image';
import type { TaxClaim } from '../data/types';

export default function TaxPage() {
  const { repo, premium } = useApp();
  const toast = useToast();
  const today = todayStr();
  const thisYear = parseYmd(today).getFullYear();
  const years = useMemo(() => [...new Set([thisYear, ...RELIEF_YEARS.map(y => y.year)])].sort((a, b) => b - a), [thisYear]);
  const [year, setYear] = useState(thisYear);
  const def = reliefYear(year);
  const { data, setData, error, reload } = useLoad(() => repo.listClaims(year), [year]);
  const claims = data ?? [];
  const sum = summarizeRelief(claims, def);

  const [open, setOpen] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);

  // borang
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(def.categories[0].code);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setFormErr('');
    const amt = parseAmount(amount);
    if (!(amt > 0)) { setFormErr('Masukkan jumlah dalam ringgit, contohnya 250'); return; }
    const d = isYmd(date) ? date : today;
    if (parseYmd(d).getFullYear() !== year) { setFormErr(`Tarikh mesti dalam tahun ${year}.`); return; }
    setSaving(true);
    try {
      let receiptPath: string | null = null;
      if (photo) {
        const img = await compressImage(photo).catch(() => { throw new Error('photo'); });
        receiptPath = await repo.uploadReceipt(img);
      }
      const created = await repo.addClaim({ year, category, amount: amt, date: d, note: note.trim(), receiptPath });
      setData(p => [...(p ?? []), created]);
      setAmount(''); setNote(''); setPhoto(null);
      if (fileRef.current) fileRef.current.value = '';
      setOpen(category);
      toast.show(`RM ${fmtRM(amt)} direkod di bawah ${def.categories.find(c => c.code === category)?.name}.`);
    } catch (err) {
      if (err instanceof Error && err.message === 'photo') setFormErr('Gambar ini tidak dapat dibaca. Cuba gambar lain (JPEG atau PNG).');
      else toast.error(err);
    } finally { setSaving(false); }
  }

  async function remove(c: TaxClaim) {
    setData(p => p?.filter(x => x.id !== c.id));
    try { await repo.deleteClaim(c.id); toast.show('Rekod dipadam.'); } catch (err) { toast.error(err); reload(); }
  }

  async function showReceipt(path: string) {
    try { setViewing(await repo.receiptUrl(path)); } catch (err) { toast.error(err); }
  }

  const rowView = (r: ReliefRow) => {
    const pct = Math.min(100, (r.claimedSen / (r.category.limit * 100)) * 100);
    const mine = claims.filter(c => c.category === r.category.code).sort((a, b) => b.date.localeCompare(a.date));
    const expanded = open === r.category.code;
    return (
      <li key={r.category.code} className="relief">
        <button type="button" className="relief-head" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.category.code)}>
          <div className="relief-top">
            <span className="relief-name">{r.category.name}</span>
            <span className="relief-amt">{premium || r.claimedSen ? <>RM {fmtSen(r.claimedSen)} <small>/ {fmtRM(r.category.limit)}</small></> : <>Had RM {fmtRM(r.category.limit)}</>}</span>
          </div>
          {(premium || r.claimedSen > 0) && <div className={`bar thin${r.overSen ? ' over' : pct >= 100 ? ' full' : ''}`}><span style={{ width: `${pct}%` }} /></div>}
        </button>
        {expanded && (
          <div className="relief-body">
            <p className="covers">{r.category.covers}</p>
            {r.category.note && <p className="covers note"><Icon name="info" size={14} stroke={2.2} /> {r.category.note}</p>}
            {r.overSen > 0 && <p className="warnline">Melebihi had sebanyak RM {fmtSen(r.overSen)}. Hanya RM {fmtRM(r.category.limit)} boleh dituntut.</p>}
            {mine.length > 0 && (
              <ul className="claims">
                {mine.map(c => (
                  <li key={c.id}>
                    <div className="c-body">
                      <div className="c-note">{c.note || 'Tiada nota'}</div>
                      <div className="c-meta">{shortDate(c.date)}{c.receiptPath && <> · <button type="button" className="link small" onClick={() => showReceipt(c.receiptPath!)}>Lihat resit</button></>}</div>
                    </div>
                    <div className="c-amt">RM {fmtRM(c.amount)}</div>
                    {premium && <ConfirmButton className="del text" label="Padam" confirmLabel="Pasti?" onConfirm={() => remove(c)} />}
                  </li>
                ))}
              </ul>
            )}
            {premium && !mine.length && <p className="covers">Belum ada resit untuk kategori ini.</p>}
          </div>
        )}
      </li>
    );
  };

  return (
    <section aria-labelledby="h-cukai">
      <div className="hero">
        <h1 id="h-cukai">Pelepasan cukai</h1>
        <p>Simpan resit sepanjang tahun, siap untuk e-Filing LHDN.</p>
      </div>

      <div className="year-row">
        <label htmlFor="taxYear" className="lbl">Tahun taksiran</label>
        <select id="taxYear" className="field select" value={year} onChange={e => { setYear(Number(e.target.value)); setOpen(null); }}>
          {years.map(y => <option key={y} value={y}>TT {y}</option>)}
        </select>
      </div>
      {def.year !== year && <p className="notice warn">Senarai pelepasan TT {year} belum tersedia dalam app. Senarai TT {def.year} dipaparkan sebagai panduan.</p>}

      {!premium && (
        <Paywall title="Penjejak pelepasan cukai ialah ciri Premium" points={[
          'Rekod setiap resit ikut kategori pelepasan LHDN.',
          'Simpan gambar resit dengan selamat, sedia bila LHDN minta.',
          'Lihat baki had setiap kategori sepanjang tahun.',
        ]} />
      )}

      {premium && (
        <>
          <div className="card summary">
            <div className="lbl">Boleh dituntut · TT {year}</div>
            <div className="total"><span className="cur">RM</span><span>{fmtSen(sum.totalCountedSen)}</span></div>
            <div className="count">
              {!data ? 'Memuatkan…' : `${claims.length} resit direkod`}
              {sum.totalClaimedSen > sum.totalCountedSen && ` · RM ${fmtSen(sum.totalClaimedSen - sum.totalCountedSen)} melebihi had`}
            </div>
          </div>

          <form className="card add-exp" onSubmit={add} autoComplete="off" noValidate>
            <div className="lbl">Rekod resit</div>
            <label htmlFor="taxAmt" className="sr">Jumlah dalam ringgit</label>
            <MoneyInput id="taxAmt" big value={amount} onChange={v => { setAmount(v); setFormErr(''); }} />
            <label htmlFor="taxCat" className="lbl">Kategori pelepasan</label>
            <select id="taxCat" className="field select" value={category} onChange={e => setCategory(e.target.value)}>
              {def.categories.map(c => <option key={c.code} value={c.code}>{c.name} (had RM {fmtRM(c.limit)})</option>)}
            </select>
            <label htmlFor="taxNote" className="sr">Nota</label>
            <input id="taxNote" className="field" placeholder="Nota, cth: Yuran gim Januari" maxLength={200} value={note} onChange={e => setNote(e.target.value)} />
            <div className="add-row">
              <div className="grow">
                <label htmlFor="taxDate" className="lbl">Tarikh resit</label>
                <input id="taxDate" className="field" type="date" value={date} min={`${year}-01-01`} max={`${year}-12-31`} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="grow">
                <span className="lbl">Gambar resit</span>
                <label className={`photo-btn${photo ? ' has' : ''}`}>
                  <Icon name={photo ? 'check' : 'camera'} size={18} stroke={2} />
                  <span>{photo ? 'Gambar dipilih' : 'Tambah gambar'}</span>
                  <input ref={fileRef} type="file" accept="image/*" className="sr" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            </div>
            {formErr && <div className="err" role="alert">{formErr}</div>}
            <button className="btn primary wide" type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan resit'}</button>
          </form>
        </>
      )}

      <h2 className="sec-h">{premium ? 'Ikut kategori' : `Kategori pelepasan TT ${def.year}`}</h2>
      {error && !data && <Empty title="Tak dapat muatkan rekod">Semak sambungan internet, kemudian <button type="button" className="link" onClick={reload}>cuba lagi</button>.</Empty>}
      <ul className="list relief-list">{sum.rows.map(rowView)}</ul>

      <p className="disclaimer">
        App ini membantu anda menyimpan rekod sahaja dan bukan nasihat cukai. Had dan syarat pelepasan berubah setiap tahun.
        Sentiasa semak senarai rasmi di hasil.gov.my sebelum membuat tuntutan, dan simpan resit asal selama 7 tahun.
      </p>
      {!def.verified && repo.kind === 'demo' && (
        <p className="notice dev">Untuk pembangun: had TT {def.year} belum disahkan dengan LHDN. Semak dan tukar <code>verified</code> dalam <code>src/lib/taxRelief.ts</code> sebelum lancar.</p>
      )}

      {viewing && (
        <div className="modal" role="dialog" aria-label="Gambar resit" onClick={() => setViewing(null)}>
          <img src={viewing} alt="Gambar resit" />
          <button type="button" className="btn ghost" onClick={() => setViewing(null)}>Tutup</button>
        </div>
      )}
    </section>
  );
}
