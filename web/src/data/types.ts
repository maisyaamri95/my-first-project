import type { CategoryId } from '../lib/categories';
import type { SubscriptionRow } from '../lib/subscription';

export interface AuthUser { id: string; email: string }

export interface Profile { id: string; displayName: string; activeHouseholdId: string | null }

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  isPersonal: boolean;
  monthlyBudget: number | null;
  inviteCode: string | null;
}

export interface Member { userId: string; role: 'owner' | 'member'; displayName: string }

export interface Task {
  id: string;
  householdId: string;
  title: string;
  due: string | null; // YYYY-MM-DD
  done: boolean;
  doneAt: string | null; // ISO
  createdAt: string;
  createdBy: string | null;
}

export interface Expense {
  id: string;
  householdId: string;
  label: string;
  amount: number;
  category: CategoryId;
  date: string; // YYYY-MM-DD
  createdAt: string;
  createdBy: string | null;
}

export interface TaxClaim {
  id: string;
  year: number;
  category: string;
  amount: number;
  date: string;
  note: string;
  receiptPath: string | null;
  createdAt: string;
}

export type NewTask = Pick<Task, 'householdId' | 'title' | 'due'> & Partial<Pick<Task, 'id' | 'done' | 'doneAt' | 'createdAt'>>;
export type NewExpense = Pick<Expense, 'householdId' | 'label' | 'amount' | 'category' | 'date'> & Partial<Pick<Expense, 'id' | 'createdAt'>>;
export type NewClaim = Pick<TaxClaim, 'year' | 'category' | 'amount' | 'date' | 'note' | 'receiptPath'> & Partial<Pick<TaxClaim, 'id' | 'createdAt'>>;

export interface Repo {
  readonly kind: 'demo' | 'cloud';

  currentUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (user: AuthUser | null, event: string) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirm: boolean }>;
  sendReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;
  accessToken(): Promise<string | null>;
  deleteAccount(): Promise<void>;

  getProfile(): Promise<Profile>;
  updateProfile(patch: { displayName?: string; activeHouseholdId?: string }): Promise<void>;
  listHouseholds(): Promise<Household[]>;
  listMembers(householdId: string): Promise<Member[]>;
  myPremium(): Promise<boolean>;
  getSubscription(): Promise<SubscriptionRow | null>;
  createHousehold(name: string): Promise<string>;
  createInvite(householdId: string): Promise<string>;
  clearInvite(householdId: string): Promise<void>;
  joinHousehold(code: string): Promise<string>;
  leaveHousehold(householdId: string): Promise<void>;
  removeMember(householdId: string, userId: string): Promise<void>;
  deleteHousehold(householdId: string): Promise<void>;
  updateHousehold(householdId: string, patch: { name?: string; monthlyBudget?: number | null }): Promise<void>;

  listTasks(householdId: string): Promise<Task[]>;
  addTask(t: NewTask): Promise<Task>;
  updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'due' | 'done' | 'doneAt'>>): Promise<void>;
  deleteTask(id: string): Promise<void>;

  /** Belanja dalam julat [from, to). */
  listExpenses(householdId: string, from: string, to: string): Promise<Expense[]>;
  addExpense(e: NewExpense): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;

  listClaims(year: number): Promise<TaxClaim[]>;
  addClaim(c: NewClaim): Promise<TaxClaim>;
  deleteClaim(id: string): Promise<void>;
  uploadReceipt(image: Blob): Promise<string>;
  receiptUrl(path: string): Promise<string>;

  /** Mod demo sahaja: hidup/matikan Premium untuk mencuba. */
  setDemoPremium?(on: boolean): Promise<void>;
}
