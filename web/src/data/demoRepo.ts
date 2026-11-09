/**
 * Mod demo: semua data disimpan dalam pelayar ini sahaja. Digunakan bila Supabase belum disambung
 * (VITE_SUPABASE_URL kosong), supaya app boleh dicuba dan diuji sebelum akaun Supabase wujud.
 */
import { AppError } from '../lib/errors';
import { todayStr, ymd, parseYmd } from '../lib/dates';
import type { SubscriptionRow } from '../lib/subscription';
import type { AuthUser, Expense, Household, Member, NewClaim, NewExpense, NewTask, Profile, Repo, Task, TaxClaim } from './types';

const KEY = 'tb-demo-v1';
const USER: AuthUser = { id: 'demo-user', email: 'demo@contoh.my' };

interface Store {
  signedIn: boolean;
  premium: boolean;
  profile: Profile;
  households: Household[];
  members: Record<string, Member[]>;
  tasks: Task[];
  expenses: Expense[];
  claims: TaxClaim[];
  receipts: Record<string, string>; // path -> data URL
}

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
const daysAgo = (n: number) => { const d = parseYmd(todayStr()); d.setDate(d.getDate() - n); return ymd(d); };
const nowIso = () => new Date().toISOString();

function seed(): Store {
  const hid = 'demo-personal';
  const t = (title: string, due: number | null, done = false): Task => ({
    id: uuid(), householdId: hid, title, due: due == null ? null : daysAgo(-due), done, doneAt: done ? nowIso() : null, createdAt: nowIso(), createdBy: USER.id,
  });
  const e = (label: string, amount: number, category: Expense['category'], ago: number): Expense => ({
    id: uuid(), householdId: hid, label, amount, category, date: daysAgo(ago), createdAt: nowIso(), createdBy: USER.id,
  });
  const year = parseYmd(todayStr()).getFullYear();
  const c = (category: string, amount: number, ago: number, note: string): TaxClaim => ({
    id: uuid(), year, category, amount, date: daysAgo(ago), note, receiptPath: null, createdAt: nowIso(),
  });
  return {
    signedIn: false,
    premium: false,
    profile: { id: USER.id, displayName: 'Pengguna Demo', activeHouseholdId: hid },
    households: [{ id: hid, name: 'Peribadi', ownerId: USER.id, isPersonal: true, monthlyBudget: 1500, inviteCode: null }],
    members: { [hid]: [{ userId: USER.id, role: 'owner', displayName: 'Pengguna Demo' }] },
    tasks: [t('Bayar bil elektrik', -2), t('Beli barang dapur untuk minggu ini', 0), t('Hantar kereta servis', 3), t('Telefon mak', null), t('Perbaharui cukai jalan', null, true)],
    expenses: [
      e('Nasi lemak & teh tarik', 8.5, 'makan', 0), e('Minyak kereta', 50, 'jalan', 0), e('Barang dapur pasar raya', 126.4, 'dapur', 1),
      e('Bil internet rumah', 99, 'bil', 2), e('Makan malam keluarga', 64, 'makan', 3), e('Tol & parkir', 23.6, 'jalan', 4),
      e('Baju kerja', 89.9, 'diri', 6), e('Bil elektrik', 142.35, 'bil', 7),
      e('Barang dapur bulanan', 310.2, 'dapur', 35), e('Bil air', 28.4, 'bil', 38), e('Servis kereta', 260, 'jalan', 70), e('Hadiah hari jadi', 120, 'diri', 100),
    ],
    claims: [
      c('gaya_hidup', 1899, 40, 'Telefon pintar baharu'), c('gaya_hidup', 89, 12, 'Buku dan majalah'),
      c('perubatan', 450, 60, 'Rawatan gigi'), c('sukan', 120, 20, 'Kasut larian'), c('perkeso', 118.6, 5, 'Caruman PERKESO (penyata gaji)'),
    ],
    receipts: {},
  };
}

export class DemoRepo implements Repo {
  readonly kind = 'demo' as const;
  private s: Store;
  private listeners = new Set<(u: AuthUser | null, event: string) => void>();

  constructor() {
    let s: Store | null = null;
    try { const raw = localStorage.getItem(KEY); if (raw) s = JSON.parse(raw); } catch { /* storan disekat */ }
    this.s = s && s.profile ? s : seed();
  }

  private save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.s)); }
    catch { throw new AppError('storage_full'); }
  }
  private emit(event: string) { const u = this.s.signedIn ? USER : null; this.listeners.forEach(l => l(u, event)); }
  private delay() { return new Promise(r => setTimeout(r, 60)); }
  private requirePremium() { if (!this.s.premium) throw new AppError('premium_required'); }

  async currentUser() { return this.s.signedIn ? USER : null; }
  onAuthChange(cb: (u: AuthUser | null, event: string) => void) { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; }
  async signIn() { this.s.signedIn = true; this.save(); this.emit('SIGNED_IN'); }
  async signUp() { await this.signIn(); return { needsConfirm: false }; }
  async sendReset() { await this.delay(); }
  async updatePassword() { await this.delay(); }
  async signOut() { this.s.signedIn = false; this.save(); this.emit('SIGNED_OUT'); }
  async accessToken() { return null; }
  async deleteAccount() { this.s = seed(); this.save(); this.emit('SIGNED_OUT'); }
  async setDemoPremium(on: boolean) { this.s.premium = on; this.save(); }

  async getProfile() { await this.delay(); return { ...this.s.profile }; }
  async updateProfile(patch: { displayName?: string; activeHouseholdId?: string }) {
    if (patch.displayName !== undefined) this.s.profile.displayName = patch.displayName.slice(0, 60);
    if (patch.activeHouseholdId !== undefined) this.s.profile.activeHouseholdId = patch.activeHouseholdId;
    this.save();
  }
  async listHouseholds() { return this.s.households.map(h => ({ ...h })); }
  async listMembers(hid: string) { return (this.s.members[hid] ?? []).map(m => ({ ...m, displayName: m.userId === USER.id ? this.s.profile.displayName : m.displayName })); }
  async myPremium() { return this.s.premium; }
  async getSubscription(): Promise<SubscriptionRow | null> {
    if (!this.s.premium) return null;
    const end = new Date(); end.setMonth(end.getMonth() + 1);
    return { user_id: USER.id, status: 'active', plan: 'monthly', lifetime: false, current_period_end: end.toISOString(), cancel_at_period_end: false, stripe_customer_id: null, stripe_subscription_id: null };
  }
  async createHousehold(name: string) {
    this.requirePremium();
    if (this.s.households.filter(h => !h.isPersonal).length >= 3) throw new AppError('too_many_households');
    const id = uuid();
    this.s.households.push({ id, name: name.trim().slice(0, 60) || 'Keluarga', ownerId: USER.id, isPersonal: false, monthlyBudget: null, inviteCode: null });
    this.s.members[id] = [{ userId: USER.id, role: 'owner', displayName: this.s.profile.displayName }];
    this.s.profile.activeHouseholdId = id;
    this.save();
    return id;
  }
  async createInvite(hid: string) {
    this.requirePremium();
    const h = this.s.households.find(x => x.id === hid && !x.isPersonal);
    if (!h) throw new AppError('not_owner');
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    h.inviteCode = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => abc[b % 32]).join('');
    this.save();
    return h.inviteCode;
  }
  async clearInvite(hid: string) { const h = this.s.households.find(x => x.id === hid); if (h) { h.inviteCode = null; this.save(); } }
  async joinHousehold(): Promise<string> { await this.delay(); throw new AppError('invalid_code'); }
  async leaveHousehold(hid: string) { await this.deleteHousehold(hid); }
  async removeMember(hid: string, userId: string) { this.s.members[hid] = (this.s.members[hid] ?? []).filter(m => m.userId !== userId); this.save(); }
  async deleteHousehold(hid: string) {
    const h = this.s.households.find(x => x.id === hid);
    if (!h || h.isPersonal) return;
    this.s.households = this.s.households.filter(x => x.id !== hid);
    this.s.tasks = this.s.tasks.filter(t => t.householdId !== hid);
    this.s.expenses = this.s.expenses.filter(e => e.householdId !== hid);
    delete this.s.members[hid];
    if (this.s.profile.activeHouseholdId === hid) this.s.profile.activeHouseholdId = this.s.households.find(x => x.isPersonal)!.id;
    this.save();
  }
  async updateHousehold(hid: string, patch: { name?: string; monthlyBudget?: number | null }) {
    const h = this.s.households.find(x => x.id === hid);
    if (!h) return;
    if (patch.name !== undefined) h.name = patch.name.slice(0, 60);
    if (patch.monthlyBudget !== undefined) h.monthlyBudget = patch.monthlyBudget;
    this.save();
  }

  async listTasks(hid: string) { await this.delay(); return this.s.tasks.filter(t => t.householdId === hid).map(t => ({ ...t })); }
  async addTask(t: NewTask) {
    const task: Task = { id: t.id ?? uuid(), householdId: t.householdId, title: t.title, due: t.due, done: t.done ?? false, doneAt: t.doneAt ?? null, createdAt: t.createdAt ?? nowIso(), createdBy: USER.id };
    this.s.tasks.push(task); this.save(); return { ...task };
  }
  async updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'due' | 'done' | 'doneAt'>>) {
    const t = this.s.tasks.find(x => x.id === id); if (t) { Object.assign(t, patch); this.save(); }
  }
  async deleteTask(id: string) { this.s.tasks = this.s.tasks.filter(t => t.id !== id); this.save(); }

  async listExpenses(hid: string, from: string, to: string) {
    await this.delay();
    return this.s.expenses.filter(e => e.householdId === hid && e.date >= from && e.date < to).map(e => ({ ...e }));
  }
  async addExpense(e: NewExpense) {
    const x: Expense = { id: e.id ?? uuid(), householdId: e.householdId, label: e.label, amount: e.amount, category: e.category, date: e.date, createdAt: e.createdAt ?? nowIso(), createdBy: USER.id };
    this.s.expenses.push(x); this.save(); return { ...x };
  }
  async deleteExpense(id: string) { this.s.expenses = this.s.expenses.filter(e => e.id !== id); this.save(); }

  async listClaims(year: number) { await this.delay(); return this.s.claims.filter(c => c.year === year).map(c => ({ ...c })); }
  async addClaim(c: NewClaim) {
    this.requirePremium();
    const claim: TaxClaim = { id: c.id ?? uuid(), year: c.year, category: c.category, amount: c.amount, date: c.date, note: c.note, receiptPath: c.receiptPath, createdAt: c.createdAt ?? nowIso() };
    this.s.claims.push(claim); this.save(); return { ...claim };
  }
  async deleteClaim(id: string) {
    const c = this.s.claims.find(x => x.id === id);
    if (c?.receiptPath) delete this.s.receipts[c.receiptPath];
    this.s.claims = this.s.claims.filter(x => x.id !== id); this.save();
  }
  async uploadReceipt(image: Blob) {
    this.requirePremium();
    const { blobToDataUrl } = await import('../lib/image');
    const path = `${USER.id}/${uuid()}.jpg`;
    this.s.receipts[path] = await blobToDataUrl(image);
    this.save();
    return path;
  }
  async receiptUrl(path: string) {
    const url = this.s.receipts[path];
    if (!url) throw new AppError('unknown', 'receipt missing');
    return url;
  }
}
