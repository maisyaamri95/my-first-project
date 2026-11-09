import { useState, type FormEvent } from 'react';
import { useApp } from '../data/AppContext';
import { useLoad } from '../data/useLoad';
import { useToast } from '../components/Toast';
import { Icon } from '../components/Icon';
import { Chip, ConfirmButton, Empty } from '../components/ui';
import { dueLabel, todayStr } from '../lib/dates';
import type { Task } from '../data/types';

function sortOpen(a: Task, b: Task) {
  if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
  if (a.due && !b.due) return -1;
  if (b.due && !a.due) return 1;
  return b.createdAt.localeCompare(a.createdAt);
}

export default function TasksPage() {
  const { repo, household } = useApp();
  const toast = useToast();
  const hid = household?.id;
  const { data, setData, error, reload } = useLoad(() => (hid ? repo.listTasks(hid) : Promise.resolve([])), [hid]);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [showDone, setShowDone] = useState(false);
  const today = todayStr();

  const tasks = data ?? [];
  const open = tasks.filter(t => !t.done).sort(sortOpen);
  const done = tasks.filter(t => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const overdue = open.filter(t => t.due && t.due < today).length;
  const dueToday = open.filter(t => t.due === today).length;

  let summary = 'Memuatkan…';
  if (error && !data) summary = 'Senarai tidak dapat dimuatkan.';
  else if (data) {
    if (!tasks.length) summary = 'Tiada tugas lagi.';
    else if (!open.length) summary = 'Semua tugas sudah selesai.';
    else summary = [`${open.length} belum siap`, overdue ? `${overdue} lewat tarikh` : '', dueToday ? `${dueToday} untuk hari ini` : ''].filter(Boolean).join(' · ');
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || !hid) return;
    setTitle(''); setDue('');
    try {
      const created = await repo.addTask({ householdId: hid, title: t, due: due || null });
      setData(prev => [...(prev ?? []), created]);
    } catch (err) { setTitle(t); toast.error(err); }
  }

  async function toggle(t: Task) {
    const patch = { done: !t.done, doneAt: t.done ? null : new Date().toISOString() };
    setData(prev => prev?.map(x => (x.id === t.id ? { ...x, ...patch } : x)));
    try { await repo.updateTask(t.id, patch); } catch (err) { toast.error(err); reload(); }
  }

  async function remove(t: Task) {
    setData(prev => prev?.filter(x => x.id !== t.id));
    try {
      await repo.deleteTask(t.id);
      toast.show('Tugas dipadam.', async () => {
        const back = await repo.addTask({ id: t.id, householdId: t.householdId, title: t.title, due: t.due, done: t.done, doneAt: t.doneAt, createdAt: t.createdAt });
        setData(prev => [...(prev ?? []), back]);
      });
    } catch (err) { toast.error(err); reload(); }
  }

  async function clearDone() {
    const ids = done.map(t => t.id);
    setData(prev => prev?.filter(x => !x.done));
    try { for (const id of ids) await repo.deleteTask(id); toast.show(`${ids.length} tugas selesai dipadam.`); }
    catch (err) { toast.error(err); reload(); }
  }

  const row = (t: Task) => {
    const d = t.due && !t.done ? dueLabel(t.due, today) : null;
    return (
      <li key={t.id} className={`task${t.done ? ' is-done' : ''}`}>
        <button type="button" className="check" aria-pressed={t.done} onClick={() => toggle(t)}
          aria-label={(t.done ? 'Tandakan belum siap: ' : 'Tandakan selesai: ') + t.title}>
          <i><Icon name="check" size={14} stroke={3} /></i>
        </button>
        <div className="t-body">
          <div className="t-title">{t.title}</div>
          {d && <div className="meta"><Chip tone={d.tone === 'overdue' ? 'overdue' : d.tone === 'today' ? 'today' : ''}>{d.text}</Chip></div>}
        </div>
        <button type="button" className="del" aria-label={`Padam tugas: ${t.title}`} onClick={() => remove(t)}><Icon name="x" /></button>
      </li>
    );
  };

  return (
    <section aria-labelledby="h-tugas">
      <div className="hero">
        <h1 id="h-tugas">Tugas</h1>
        <p>{summary}</p>
      </div>

      <form className="card add-task" onSubmit={add} autoComplete="off">
        <label htmlFor="taskTitle" className="sr">Tugas baru</label>
        <input id="taskTitle" className="field" placeholder="Tambah tugas, cth: Bayar bil air" maxLength={200} enterKeyHint="done"
          value={title} onChange={e => setTitle(e.target.value)} />
        <div className="add-row">
          <div className="grow">
            <label htmlFor="taskDue" className="lbl">Tarikh akhir (pilihan)</label>
            <div className="due-in">
              <input id="taskDue" className="field" type="date" value={due} onChange={e => setDue(e.target.value)} />
              {due && <button type="button" className="due-clear" aria-label="Kosongkan tarikh" onClick={() => setDue('')}><Icon name="x" size={16} stroke={2.2} /></button>}
            </div>
          </div>
          <button className="btn primary" type="submit">Tambah</button>
        </div>
      </form>

      {open.length > 0 && <ul className="list" aria-label="Tugas belum siap">{open.map(row)}</ul>}
      {!data && !error && <Empty>Memuatkan senarai…</Empty>}
      {error && !data && <Empty title="Tak dapat muatkan tugas">Semak sambungan internet, kemudian <button type="button" className="link" onClick={reload}>cuba lagi</button>.</Empty>}
      {data && !tasks.length && <Empty title="Belum ada tugas">Tulis tugas pertama di atas, contohnya “Bayar bil air”, kemudian tekan Tambah.</Empty>}
      {data && tasks.length > 0 && !open.length && <Empty title="Tiada tugas tertunggak">Tugas yang sudah selesai ada di bawah.</Empty>}

      {done.length > 0 && (
        <>
          <div className="done-head">
            <button type="button" className="toggle" aria-expanded={showDone} onClick={() => setShowDone(v => !v)}>
              <Icon name="chev" size={16} stroke={2.4} />Selesai ({done.length})
            </button>
            <ConfirmButton label="Padam semua yang selesai" confirmLabel="Tekan sekali lagi untuk padam" onConfirm={clearDone} />
          </div>
          {showDone && <ul className="list" aria-label="Tugas selesai">{done.map(row)}</ul>}
        </>
      )}
    </section>
  );
}
