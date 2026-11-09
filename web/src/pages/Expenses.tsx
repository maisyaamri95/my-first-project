import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useApp } from '../data/AppContext';
import { useLoad } from '../data/useLoad';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Empty, MoneyInput, Paywall } from '../components/ui';
import { CATEGORIES, CATEGORY, type CategoryId } from '../lib/categories';
import { dayHeading, daysLeftInMonth, isYmd, monthLabel, monthOf, monthRange, shiftMonth, todayStr } from '../lib/dates';
import { fmtRM, fmtSen, parseAmount, toSen } from '../lib/money';
import { isHistoryLocked } from '../lib/premium';
import { FREE_HISTORY_MONTHS } from '../config';
import type { Expense } from '../data/types';

const catStyle = (id: CategoryId) => ({ '--c': `var(--c-${id})` }) as CSSProperties;

export default function ExpensesPage() {
  const { repo, household, members, premium, refresh } = useApp();
  const toast = useToast();
  const today = todayStr();
  const [month, setMonth] = useState(monthOf(today));
  const locked = isHistoryLocked(month, today, premium);
  const hid = household?.id;
  const [from, to] = monthRange(month);
  const { data, setData, error, reload } = useLoad(
    () => (hid && !locked ? repo.listExpenses(hid, from, to) : Promise.resolve([] as Expense[])), [hid, from, to, locked]);

  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [cat, setCat] = useState<CategoryId>('makan');
  const [date, setDate] = useState(today);
  const [formErr, setFormErr] = useState('');
  const [editBudget, setEditBudget] = useState(false);
  const [budgetText, setBudgetText] = useState('');
  const [budgetErr, setBudgetErr] = useState('');

  const list = useMemo(() => [...(data ?? [])].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : b.createdAt.localeCompare(a.createdAt))), [data]);
  const totalSen = list.reduce((s, e) => s + toSen(e.amount), 0);
  const byCat = CATEGORIES.map(c => ({ ...c, sen: list.filter(e => e.category === c.id).reduce((s, e) => s + toSen(e.amount), 0) }))
    .filter(c => c.sen > 0).sort((a, b) => b.sen - a.sen);
  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const e of list) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return [...m.entries()];
  }, [list]);
  const shared = members.length > 1;
  const nameOf = (uid: string | null) => members.find(m => m.userId === uid)?.displayName || 'Ahli';

  const budget = household?.monthlyBudget ?? 0;
  const isCurrent = month === monthOf(today);

  async function add(e: FormEvent) {
    e.preventDefault();
    setFormErr('');
    const amt = parseAmount(amount);
    if (!(amt > 0)) { setFormErr('Masukkan jumlah dalam ringgit, contohnya 12.50'); return; }
    if (!hid) return;
    const d = isYmd(date) ? date : today;
    const prev = { amount, label };
    setAmount(''); setLabel('');
    try {
      const created = await repo.addExpense({ householdId: hid, label: label.trim(), amount: amt, category: cat, date: d });
      if (monthOf(d) === month) setData(p => [...(p ?? []), created]);
      toast.show(monthOf(d) === month ? `RM ${fmtRM(amt)} disimpan.` : `Disimpan dalam ${monthLabel(monthOf(d))}.`);
    } catch (err) { setAmount(prev.amount); setLabel(prev.label); toast.error(err); }
  }

  async function remove(x: Expense) {
    setData(p => p?.filter(e => e.id !== x.id));
    try {
      await repo.deleteExpense(x.id);
      toast.show(`RM ${fmtRM(x.amount)} dipadam.`, async () => {
        const back = await repo.addExpense({ id: x.id, householdId: x.householdId, label: x.label, amount: x.amount, category: x.category, date: x.date, createdAt: x.createdAt });
        setData(p => [...(p ?? []), back]);
      });
    } catch (err) { toast.error(err); reload(); }
  }

  async function saveBudget(e: FormEvent) {
    e.preventDefault();
    const v = parseAmount(budgetText);
    if (!(v > 0)) { setBudgetErr('Masukkan bajet dalam ringgit, contohnya 1500'); return; }
    if (!hid) return;
    try { await repo.updateHousehold(hid, { monthlyBudget: v }); await refresh(); setEditBudget(false); toast.show('Bajet disimpan.'); }
    catch (err) { toast.error(err); }
  }
  async function removeBudget() {
    if (!hid) return;
    try { await repo.updateHousehold(hid, { monthlyBudget: null }); await refresh(); setEditBudget(false); toast.show('Bajet dibuang.'); }
    catch (err) { toast.error(err); }
  }

  let budgetBlock = null;
  if (editBudget) {
    budgetBlock = (
      <form className="b-form" onSubmit={saveBudget} autoComplete="off">
        <label htmlFor="budgetInput" className="lbl">Bajet sebulan{shared ? ' (dikongsi dengan keluarga)' : ''}</label>
        <div className="row">
          <MoneyInput id="budgetInput" value={budgetText} onChange={v => { setBudgetText(v); setBudgetErr(''); }} placeholder="1500.00" autoFocus />
          <button type="submit" className="btn primary">Simpan</button>
          <button type="button" className="btn ghost" onClick={() => setEditBudget(false)}>Batal</button>
        </div>
        {budgetErr && <div className="err">{budgetErr}</div>}
        {budget > 0 && <div><button type="button" className="link danger" onClick={removeBudget}>Buang bajet</button></div>}
      </form>
    );
  } else if (budget > 0) {
    const bSen = Math.round(budget * 100);
    const used = totalSen / bSen;
    const left = bSen - totalSen;
    budgetBlock = (
      <div>
        <div className={`bar${used > 1 ? ' over' : used >= 0.8 ? ' warn' : ''}`}><span style={{ width: `${Math.min(100, used * 100).toFixed(1)}%` }} /></div>
        <div className={`b-text${left < 0 ? ' over' : ''}`}>
          {left >= 0 ? `Baki RM ${fmtSen(left)} daripada bajet RM ${fmtRM(budget)}` : `Melebihi bajet sebanyak RM ${fmtSen(-left)}`}
        </div>
        <div className="b-sub">
          {left >= 0 && isCurrent ? `Lebih kurang RM ${fmtSen(left / daysLeftInMonth(today))} sehari untuk ${daysLeftInMonth(today)} hari lagi`
            : left >= 0 ? `${Math.round(used * 100)}% bajet digunakan` : `Bajet bulanan RM ${fmtRM(budget)}`}
        </div>
        <button type="button" className="link" onClick={() => { setBudgetText(String(budget)); setBudgetErr(''); setEditBudget(true); }}>Ubah bajet</button>
      </div>
    );
  } else {
    budgetBlock = <button type="button" className="link" onClick={() => { setBudgetText(''); setEditBudget(true); }}>+ Tetapkan bajet bulanan</button>;
  }

  return (
    <section aria-labelledby="monthLabel">
      <div className="month">
        <button type="button" className="mbtn" aria-label="Bulan sebelum" onClick={() => setMonth(m => shiftMonth(m, -1))}><Icon name="left" stroke={2.2} /></button>
        <h1 id="monthLabel">{monthLabel(month)}</h1>
        <button type="button" className="mbtn" aria-label="Bulan seterusnya" disabled={isCurrent} onClick={() => setMonth(m => shiftMonth(m, 1))}><Icon name="right" stroke={2.2} /></button>
      </div>

      {locked ? (
        <Paywall title={`Sejarah lebih ${FREE_HISTORY_MONTHS} bulan untuk Premium`} points={[
          `Pelan percuma menunjukkan ${FREE_HISTORY_MONTHS} bulan terkini.`,
          'Premium membuka semua sejarah belanja, eksport ke Excel dan bajet keluarga.',
        ]} />
      ) : (
        <>
          <div className="card summary">
            <div className="lbl">Jumlah belanja{shared ? ` · ${household?.name}` : ''}</div>
            <div className="total"><span className="cur">RM</span><span>{fmtSen(totalSen)}</span></div>
            <div className="count">{!data ? 'Memuatkan…' : list.length ? `${list.length} rekod bulan ini` : 'Belum ada rekod bulan ini'}</div>
            <div className="budget">{budgetBlock}</div>
            {byCat.length > 0 && (
              <div className="split-wrap">
                <div className="lbl">Ikut kategori</div>
                <div className="split" aria-hidden="true">{byCat.map(c => <span key={c.id} style={{ ...catStyle(c.id), flex: `${c.sen} 1 0` }} />)}</div>
                <ul className="legend">
                  {byCat.map(c => (
                    <li key={c.id} style={catStyle(c.id)}>
                      <span className="sw" /><span className="nm">{c.name}</span><span className="amt">RM {fmtSen(c.sen)}</span>
                      <span className="pct">{Math.round((c.sen / totalSen) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <form className="card add-exp" onSubmit={add} autoComplete="off" noValidate>
            <div className="lbl">Rekod belanja</div>
            <label htmlFor="expAmt" className="sr">Jumlah dalam ringgit</label>
            <MoneyInput id="expAmt" big value={amount} onChange={v => { setAmount(v); setFormErr(''); }} />
            <label htmlFor="expLabel" className="sr">Untuk apa</label>
            <input id="expLabel" className="field" placeholder="Untuk apa? cth: Nasi lemak" maxLength={120} enterKeyHint="done"
              value={label} onChange={e => setLabel(e.target.value)} />
            <fieldset className="cats">
              <legend className="sr">Kategori</legend>
              {CATEGORIES.map(c => (
                <div className="cat" key={c.id} style={catStyle(c.id)}>
                  <input type="radio" name="cat" id={`cat-${c.id}`} value={c.id} checked={cat === c.id} onChange={() => setCat(c.id)} />
                  <label htmlFor={`cat-${c.id}`}><Icon name={c.id} size={16} stroke={2} /><span>{c.short}</span></label>
                </div>
              ))}
            </fieldset>
            <div className="add-row">
              <div className="grow">
                <label htmlFor="expDate" className="lbl">Tarikh</label>
                <input id="expDate" className="field" type="date" value={date} max={today} onChange={e => setDate(e.target.value)} />
              </div>
              <button className="btn primary" type="submit">Simpan</button>
            </div>
            {formErr && <div className="err" role="alert">{formErr}</div>}
          </form>

          {groups.map(([d, items]) => (
            <section className="day" key={d}>
              <div className="day-h"><span>{dayHeading(d, today)}</span><span className="sum">RM {fmtSen(items.reduce((s, e) => s + toSen(e.amount), 0))}</span></div>
              <ul className="list">
                {items.map(x => (
                  <li className="exp" key={x.id} style={catStyle(x.category)}>
                    <span className="ico"><Icon name={x.category} size={19} stroke={2} /></span>
                    <div className="e-body">
                      <div className="e-label">{x.label || CATEGORY[x.category].name}</div>
                      <div className="e-meta">{CATEGORY[x.category].name}{shared && <span>· {nameOf(x.createdBy)}</span>}</div>
                    </div>
                    <div className="e-amt">RM {fmtRM(x.amount)}</div>
                    <button type="button" className="del" aria-label={`Padam belanja: ${x.label || CATEGORY[x.category].name}, RM ${fmtRM(x.amount)}`} onClick={() => remove(x)}><Icon name="x" /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {!data && !error && <Empty>Memuatkan rekod…</Empty>}
          {error && !data && <Empty title="Tak dapat muatkan rekod">Semak sambungan internet, kemudian <button type="button" className="link" onClick={reload}>cuba lagi</button>.</Empty>}
          {data && !list.length && <Empty title={`Tiada belanja untuk ${monthLabel(month).split(' ')[0]}`}>Masukkan jumlah dan pilih kategori di atas, kemudian tekan Simpan.</Empty>}
        </>
      )}
    </section>
  );
}
