import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { repo } from './index';
import type { AuthUser, Household, Member, Profile, Repo } from './types';
import type { SubscriptionRow } from '../lib/subscription';

interface AppState {
  repo: Repo;
  ready: boolean;
  user: AuthUser | null;
  profile: Profile | null;
  households: Household[];
  household: Household | null; // ruang aktif
  members: Member[];
  premium: boolean;
  subscription: SubscriptionRow | null;
  recovery: boolean; // pengguna buka pautan set semula kata laluan
  setRecovery(v: boolean): void;
  refresh(): Promise<void>;
  switchHousehold(id: string): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [premium, setPremium] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [recovery, setRecovery] = useState(false);
  const loading = useRef<Promise<void> | null>(null);

  const load = useCallback(async () => {
    if (loading.current) return loading.current;
    const p = (async () => {
      const u = await repo.currentUser();
      setUser(u);
      if (!u) { setProfile(null); setHouseholds([]); setMembers([]); setPremium(false); setSubscription(null); return; }
      const [prof, hs, prem, sub] = await Promise.all([repo.getProfile(), repo.listHouseholds(), repo.myPremium(), repo.getSubscription()]);
      setProfile(prof); setHouseholds(hs); setPremium(prem); setSubscription(sub);
      const active = hs.find(h => h.id === prof.activeHouseholdId) ?? hs.find(h => h.isPersonal) ?? hs[0];
      setMembers(active ? await repo.listMembers(active.id) : []);
    })();
    loading.current = p;
    try { await p; } finally { loading.current = null; }
  }, []);

  useEffect(() => {
    load().catch(() => {}).finally(() => setReady(true));
    const off = repo.onAuthChange((u, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || !u) load().catch(() => {});
    });
    const onVisible = () => { if (document.visibilityState === 'visible') load().catch(() => {}); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { off(); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const household = useMemo(
    () => households.find(h => h.id === profile?.activeHouseholdId) ?? households.find(h => h.isPersonal) ?? households[0] ?? null,
    [households, profile],
  );

  const switchHousehold = useCallback(async (id: string) => {
    await repo.updateProfile({ activeHouseholdId: id });
    await load();
  }, [load]);

  const value: AppState = {
    repo, ready, user, profile, households, household, members, premium, subscription, recovery, setRecovery,
    refresh: load, switchHousehold,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
