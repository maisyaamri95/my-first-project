import { DemoRepo } from './demoRepo';
import { SupabaseRepo } from './supabaseRepo';
import type { Repo } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase bila kunci tersedia; jika tidak, mod demo (data dalam pelayar ini sahaja). */
export const repo: Repo = url && key ? new SupabaseRepo(url, key) : new DemoRepo();
