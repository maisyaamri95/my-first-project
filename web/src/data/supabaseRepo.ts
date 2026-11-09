import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { AppError, toAppError } from '../lib/errors';
import { isCategoryId } from '../lib/categories';
import type { SubscriptionRow } from '../lib/subscription';
import type { AuthUser, Expense, Household, Member, NewClaim, NewExpense, NewTask, Profile, Repo, Task, TaxClaim } from './types';

/* Baris pangkalan data (snake_case) -> objek app (camelCase). */
type Row = Record<string, any>;
const mapHousehold = (r: Row): Household => ({
  id: r.id, name: r.name, ownerId: r.owner_id, isPersonal: !!r.is_personal,
  monthlyBudget: r.monthly_budget == null ? null : Number(r.monthly_budget), inviteCode: r.invite_code ?? null,
});
const mapTask = (r: Row): Task => ({
  id: r.id, householdId: r.household_id, title: r.title, due: r.due ?? null, done: !!r.done,
  doneAt: r.done_at ?? null, createdAt: r.created_at, createdBy: r.created_by ?? null,
});
const mapExpense = (r: Row): Expense => ({
  id: r.id, householdId: r.household_id, label: r.label ?? '', amount: Number(r.amount),
  category: isCategoryId(r.category) ? r.category : 'lain', date: r.date, createdAt: r.created_at, createdBy: r.created_by ?? null,
});
const mapClaim = (r: Row): TaxClaim => ({
  id: r.id, year: r.year, category: r.category, amount: Number(r.amount), date: r.date, note: r.note ?? '',
  receiptPath: r.receipt_path ?? null, createdAt: r.created_at,
});
const mapUser = (u: User | null | undefined): AuthUser | null => (u ? { id: u.id, email: u.email ?? '' } : null);

/** Buang ralat Supabase sebagai AppError. (Untuk maybeSingle(), pemanggil mesti anggap hasilnya boleh null.) */
function check<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw toAppError(res.error);
  return res.data as NonNullable<R['data']>;
}

export class SupabaseRepo implements Repo {
  readonly kind = 'cloud' as const;
  private sb: SupabaseClient;
  private uid: string | null = null;

  constructor(url: string, anonKey: string) {
    // Aliran "implicit": pautan emel (set semula kata laluan) berfungsi walaupun dibuka dalam pelayar lain
    // daripada app di Skrin Utama iPhone (yang ada storan berasingan).
    this.sb = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  }

  private async me(): Promise<string> {
    if (this.uid) return this.uid;
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new AppError('not_signed_in');
    this.uid = id;
    return id;
  }

  /* ---------- akaun ---------- */
  async currentUser() {
    const { data } = await this.sb.auth.getSession();
    this.uid = data.session?.user.id ?? null;
    return mapUser(data.session?.user);
  }
  onAuthChange(cb: (u: AuthUser | null, event: string) => void) {
    const { data } = this.sb.auth.onAuthStateChange((event, session) => {
      this.uid = session?.user.id ?? null;
      cb(mapUser(session?.user), event);
    });
    return () => data.subscription.unsubscribe();
  }
  async signIn(email: string, password: string) {
    check(await this.sb.auth.signInWithPassword({ email, password }));
  }
  async signUp(email: string, password: string) {
    const data = check(await this.sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + '/masuk' } }));
    // Supabase tidak memberi ralat untuk emel yang sudah wujud (untuk privasi); identities kosong menandakannya.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new AppError('email_taken');
    return { needsConfirm: !data.session };
  }
  async sendReset(email: string) {
    check(await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/akaun' }));
  }
  async updatePassword(password: string) {
    check(await this.sb.auth.updateUser({ password }));
  }
  async signOut() {
    await this.sb.auth.signOut();
    this.uid = null;
  }
  async accessToken() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.access_token ?? null;
  }
  async deleteAccount() {
    const token = await this.accessToken();
    const res = await fetch('/api/delete-account', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(e => { throw toAppError(e); });
    if (!res.ok) throw new AppError('unknown', await res.text());
    await this.signOut();
  }

  /* ---------- profil & ruang ---------- */
  async getProfile(): Promise<Profile> {
    const id = await this.me();
    const r = check(await this.sb.from('profiles').select('id, display_name, active_household_id').eq('id', id).single());
    return { id: r.id, displayName: r.display_name, activeHouseholdId: r.active_household_id };
  }
  async updateProfile(patch: { displayName?: string; activeHouseholdId?: string }) {
    const id = await this.me();
    const row: Row = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName.slice(0, 60);
    if (patch.activeHouseholdId !== undefined) row.active_household_id = patch.activeHouseholdId;
    check(await this.sb.from('profiles').update(row).eq('id', id));
  }
  async listHouseholds() {
    const rows = check(await this.sb.from('households').select('id, name, owner_id, is_personal, monthly_budget, invite_code').order('created_at'));
    return (rows ?? []).map(mapHousehold);
  }
  async listMembers(householdId: string): Promise<Member[]> {
    const rows = check(await this.sb.from('household_members').select('user_id, role, joined_at').eq('household_id', householdId).order('joined_at'));
    const ids = (rows ?? []).map((r: Row) => r.user_id);
    const profiles = ids.length ? check(await this.sb.from('profiles').select('id, display_name').in('id', ids)) : [];
    const names = new Map((profiles ?? []).map((p: Row) => [p.id, p.display_name]));
    return (rows ?? []).map((r: Row) => ({ userId: r.user_id, role: r.role, displayName: names.get(r.user_id) ?? '' }));
  }
  async myPremium() {
    return !!check(await this.sb.rpc('my_premium'));
  }
  async getSubscription(): Promise<SubscriptionRow | null> {
    const id = await this.me();
    return check(await this.sb.from('subscriptions').select('*').eq('user_id', id).maybeSingle()) as SubscriptionRow | null;
  }
  async createHousehold(name: string) {
    return check(await this.sb.rpc('create_household', { hname: name })) as string;
  }
  async createInvite(householdId: string) {
    return check(await this.sb.rpc('create_invite', { hid: householdId })) as string;
  }
  async clearInvite(householdId: string) {
    check(await this.sb.rpc('clear_invite', { hid: householdId }));
  }
  async joinHousehold(code: string) {
    return check(await this.sb.rpc('join_household', { code })) as string;
  }
  async leaveHousehold(householdId: string) {
    const id = await this.me();
    check(await this.sb.from('household_members').delete().eq('household_id', householdId).eq('user_id', id));
  }
  async removeMember(householdId: string, userId: string) {
    check(await this.sb.from('household_members').delete().eq('household_id', householdId).eq('user_id', userId));
  }
  async deleteHousehold(householdId: string) {
    check(await this.sb.from('households').delete().eq('id', householdId));
  }
  async updateHousehold(householdId: string, patch: { name?: string; monthlyBudget?: number | null }) {
    const row: Row = {};
    if (patch.name !== undefined) row.name = patch.name.slice(0, 60);
    if (patch.monthlyBudget !== undefined) row.monthly_budget = patch.monthlyBudget;
    check(await this.sb.from('households').update(row).eq('id', householdId));
  }

  /* ---------- tugas ---------- */
  async listTasks(householdId: string) {
    return (check(await this.sb.from('tasks').select('*').eq('household_id', householdId)) ?? []).map(mapTask);
  }
  async addTask(t: NewTask) {
    const id = await this.me();
    const row: Row = { household_id: t.householdId, title: t.title, due: t.due, done: t.done ?? false, done_at: t.doneAt ?? null, created_by: id };
    if (t.id) row.id = t.id;
    if (t.createdAt) row.created_at = t.createdAt;
    return mapTask(check(await this.sb.from('tasks').insert(row).select().single()));
  }
  async updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'due' | 'done' | 'doneAt'>>) {
    const row: Row = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.due !== undefined) row.due = patch.due;
    if (patch.done !== undefined) row.done = patch.done;
    if (patch.doneAt !== undefined) row.done_at = patch.doneAt;
    check(await this.sb.from('tasks').update(row).eq('id', id));
  }
  async deleteTask(id: string) {
    check(await this.sb.from('tasks').delete().eq('id', id));
  }

  /* ---------- belanja ---------- */
  async listExpenses(householdId: string, from: string, to: string) {
    const rows = check(await this.sb.from('expenses').select('*').eq('household_id', householdId).gte('date', from).lt('date', to)
      .order('date', { ascending: false }).order('created_at', { ascending: false }).limit(5000));
    return (rows ?? []).map(mapExpense);
  }
  async addExpense(e: NewExpense) {
    const id = await this.me();
    const row: Row = { household_id: e.householdId, label: e.label, amount: e.amount, category: e.category, date: e.date, created_by: id };
    if (e.id) row.id = e.id;
    if (e.createdAt) row.created_at = e.createdAt;
    return mapExpense(check(await this.sb.from('expenses').insert(row).select().single()));
  }
  async deleteExpense(id: string) {
    check(await this.sb.from('expenses').delete().eq('id', id));
  }

  /* ---------- cukai ---------- */
  async listClaims(year: number) {
    const rows = check(await this.sb.from('tax_claims').select('*').eq('year', year).order('date', { ascending: false }));
    return (rows ?? []).map(mapClaim);
  }
  async addClaim(c: NewClaim) {
    const row: Row = { year: c.year, category: c.category, amount: c.amount, date: c.date, note: c.note, receipt_path: c.receiptPath };
    if (c.id) row.id = c.id;
    if (c.createdAt) row.created_at = c.createdAt;
    return mapClaim(check(await this.sb.from('tax_claims').insert(row).select().single()));
  }
  async deleteClaim(id: string) {
    const row = check(await this.sb.from('tax_claims').delete().eq('id', id).select('receipt_path').maybeSingle()) as Row | null;
    if (row?.receipt_path) await this.sb.storage.from('receipts').remove([row.receipt_path]);
  }
  async uploadReceipt(image: Blob) {
    const id = await this.me();
    const path = `${id}/${crypto.randomUUID()}.jpg`;
    check(await this.sb.storage.from('receipts').upload(path, image, { contentType: 'image/jpeg', upsert: false }));
    return path;
  }
  async receiptUrl(path: string) {
    const data = check(await this.sb.storage.from('receipts').createSignedUrl(path, 3600));
    return data.signedUrl;
  }
}
