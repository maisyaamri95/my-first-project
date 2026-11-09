/**
 * Menguji supabase/schema.sql pada Postgres sebenar (PGlite) dengan stub skema `auth` dan `storage` Supabase.
 * Tujuan: pastikan peraturan RLS menghalang pengguna membaca/menulis data orang lain.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const schema = readFileSync(fileURLToPath(new URL('../supabase/schema.sql', import.meta.url)), 'utf8');

const STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant select, insert, delete on storage.objects to authenticated;
`;

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

let db: PGlite;

/** Jalankan SQL sebagai pengguna tertentu (peranan authenticated + RLS). */
async function as<T = any>(uid: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  await db.exec('set role authenticated');
  try {
    const r = await db.query<T>(sql, params);
    return r.rows;
  } finally {
    await db.exec('reset role');
  }
}
async function fails(uid: string, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await as(uid, sql, params);
  } catch (e: any) {
    return String(e.message);
  }
  throw new Error('expected failure: ' + sql);
}
const personal = async (uid: string) =>
  (await db.query<{ id: string }>(`select id from households where owner_id = $1 and is_personal`, [uid])).rows[0].id;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  await db.exec(schema);
  for (const [id, email] of [[A, 'aminah@contoh.my'], [B, 'badrul@contoh.my'], [C, 'chong@contoh.my']]) {
    await db.query('insert into auth.users (id, email) values ($1, $2)', [id, email]);
  }
});

describe('schema & RLS', () => {
  it('creates a profile and personal household for each new user', async () => {
    const p = await as(A, 'select display_name, active_household_id from profiles where id = $1', [A]);
    expect(p[0].display_name).toBe('aminah');
    expect(p[0].active_household_id).toBe(await personal(A));
  });

  it('keeps each person\'s tasks and expenses private', async () => {
    const ha = await personal(A);
    await as(A, `insert into tasks (household_id, title) values ($1, 'Bayar bil air')`, [ha]);
    await as(A, `insert into expenses (household_id, label, amount, category, date) values ($1, 'Nasi lemak', 8.5, 'makan', '2026-11-09')`, [ha]);
    expect(await as(A, 'select title from tasks')).toHaveLength(1);
    expect(await as(B, 'select * from tasks')).toHaveLength(0);
    expect(await as(B, 'select * from expenses')).toHaveLength(0);
    expect(await as(B, 'select * from households where id = $1', [ha])).toHaveLength(0);
    expect(await fails(B, `insert into tasks (household_id, title) values ($1, 'cuba')`, [ha])).toMatch(/row-level security/);
    // B cuba ubah/padam data A: tiada baris terjejas
    await as(B, `update tasks set title = 'diubah' where household_id = $1`, [ha]);
    await as(B, `delete from expenses where household_id = $1`, [ha]);
    expect((await as(A, 'select title from tasks'))[0].title).toBe('Bayar bil air');
    expect(await as(A, 'select * from expenses')).toHaveLength(1);
  });

  it('blocks changing protected columns', async () => {
    const ha = await personal(A);
    expect(await fails(A, `update households set owner_id = $1 where id = $2`, [B, ha])).toMatch(/permission denied/);
    expect(await fails(A, `update households set invite_code = 'AAAA' where id = $1`, [ha])).toMatch(/permission denied/);
    expect(await fails(A, `update tasks set household_id = $1`, [ha])).toMatch(/permission denied/);
    expect(await fails(A, `insert into subscriptions (user_id, status, lifetime) values ($1, 'active', true)`, [A])).toMatch(/permission denied/);
  });

  it('requires Premium for family spaces and tax claims', async () => {
    expect(await fails(A, `select create_household('Keluarga')`)).toMatch(/premium_required/);
    expect(await fails(A, `insert into tax_claims (year, category, amount, date) values (2026, 'gaya_hidup', 100, '2026-11-01')`)).toMatch(/row-level security/);
    expect(await fails(A, `select user_is_premium($1)`, [A])).toMatch(/permission denied/);
    expect((await as(A, 'select my_premium() as p'))[0].p).toBe(false);
  });

  it('lets a Premium owner invite family, who then share only that space', async () => {
    await db.query(`insert into subscriptions (user_id, status, plan, current_period_end) values ($1, 'active', 'monthly', now() + interval '20 days')`, [A]);
    const [{ create_household: fam }] = await as(A, `select create_household('Keluarga Amri')`);
    await as(A, `insert into tasks (household_id, title) values ($1, 'Beli barang dapur')`, [fam]);
    await as(A, `update households set monthly_budget = 2000 where id = $1`, [fam]);

    expect(await fails(B, `select create_invite($1)`, [fam])).toMatch(/not_owner/);
    const [{ create_invite: code }] = await as(A, `select create_invite($1)`, [fam]);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);

    expect(await fails(B, `select join_household('WRONG123')`)).toMatch(/invalid_code/);
    await as(B, `select join_household($1)`, [code.toLowerCase()]);

    const bTasks = await as(B, 'select title from tasks order by title');
    expect(bTasks.map(t => t.title)).toEqual(['Beli barang dapur']); // bukan tugas peribadi A
    expect((await as(B, 'select active_household_id from profiles where id = $1', [B]))[0].active_household_id).toBe(fam);
    expect(await as(B, 'select id from profiles order by id')).toHaveLength(2); // nampak A (ahli sama), bukan C
    expect(await as(C, 'select * from tasks where household_id = $1', [fam])).toHaveLength(0);

    // Ahli keluarga dapat Premium melalui pemilik
    expect((await as(B, 'select my_premium() as p'))[0].p).toBe(true);
    expect((await as(B, 'select household_is_premium($1) as p', [fam]))[0].p).toBe(true);
    await as(B, `insert into tax_claims (year, category, amount, date) values (2026, 'perubatan', 250, '2026-10-02')`);
    expect(await as(A, 'select * from tax_claims')).toHaveLength(0); // rekod cukai B peribadi
    expect(await as(B, 'select * from subscriptions')).toHaveLength(0); // tak nampak langganan A

    // B tidak boleh buang pemilik; A boleh buang B
    expect(await as(B, 'delete from household_members where household_id = $1 and user_id = $2 returning user_id', [fam, A])).toHaveLength(0);
    await as(A, 'delete from household_members where household_id = $1 and user_id = $2', [fam, B]);
    expect(await as(B, 'select * from tasks where household_id = $1', [fam])).toHaveLength(0);
    expect((await as(B, 'select active_household_id from profiles where id = $1', [B]))[0].active_household_id).toBe(await personal(B));
    expect((await as(B, 'select my_premium() as p'))[0].p).toBe(false);
  });

  it('stops joining when the owner\'s Premium has lapsed', async () => {
    const [{ id: fam, invite_code: code }] = await as(A, `select id, invite_code from households where not is_personal`);
    await db.query(`update subscriptions set status = 'canceled' where user_id = $1`, [A]);
    expect(await fails(C, `select join_household($1)`, [code])).toMatch(/owner_not_premium/);
    expect(await fails(A, `select create_invite($1)`, [fam])).toMatch(/premium_required/);
    await db.query(`update subscriptions set lifetime = true where user_id = $1`, [A]);
    await as(C, `select join_household($1)`, [code]);
  });

  it('only lets people open their own receipt photos', async () => {
    await as(A, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${A}/r1.jpg`]);
    expect(await fails(A, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${B}/r1.jpg`])).toMatch(/row-level security/);
    expect(await as(B, `select * from storage.objects`)).toHaveLength(0);
    expect(await as(A, `select * from storage.objects`)).toHaveLength(1);
    // Pengguna bukan Premium tidak boleh muat naik
    expect(await fails(B, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${B}/r1.jpg`])).toMatch(/row-level security/);
  });

  it('gives anonymous visitors nothing', async () => {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    await db.exec('set role anon');
    try {
      await expect(db.query('select * from tasks')).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec('reset role');
    }
  });
});
