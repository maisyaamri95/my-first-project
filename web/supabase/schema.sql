-- =====================================================================
-- Tugas & Belanja: skema pangkalan data Supabase
-- Jalankan SEKALI dalam Supabase > SQL Editor > New query > Run.
--
-- Prinsip keselamatan:
--  * Setiap jadual guna Row Level Security (RLS).
--  * Tugas & belanja milik satu "ruang" (household). Hanya ahli ruang boleh baca/tulis.
--  * Rekod cukai adalah peribadi: hanya pemiliknya boleh baca/tulis.
--  * Langganan hanya ditulis oleh pelayan (webhook Stripe) menggunakan service role.
-- =====================================================================

-- ---------- Jadual ----------

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  active_household_id uuid,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Peribadi' check (char_length(name) between 1 and 60),
  owner_id uuid not null references auth.users(id) on delete cascade,
  is_personal boolean not null default false,
  monthly_budget numeric(12,2) check (monthly_budget is null or (monthly_budget > 0 and monthly_budget < 10000000)),
  invite_code text unique,
  created_at timestamptz not null default now()
);
create index households_owner_idx on public.households(owner_id);

alter table public.profiles
  add constraint profiles_active_household_fk
  foreign key (active_household_id) references public.households(id) on delete set null;

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  due date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index tasks_household_idx on public.tasks(household_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  label text not null default '' check (char_length(label) <= 120),
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  category text not null check (category in ('makan', 'dapur', 'jalan', 'bil', 'diri', 'lain')),
  date date not null,
  created_at timestamptz not null default now()
);
create index expenses_household_date_idx on public.expenses(household_id, date);

create table public.tax_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  year int not null check (year between 2020 and 2100),
  category text not null check (char_length(category) between 1 and 40),
  amount numeric(12,2) not null check (amount > 0 and amount < 10000000),
  date date not null,
  note text not null default '' check (char_length(note) <= 200),
  receipt_path text check (receipt_path is null or char_length(receipt_path) <= 300),
  created_at timestamptz not null default now()
);
create index tax_claims_user_year_idx on public.tax_claims(user_id, year);

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'none',
  plan text check (plan in ('monthly', 'yearly', 'lifetime')),
  lifetime boolean not null default false,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

-- ---------- Fungsi bantuan ----------

-- Adakah pengguna semasa ahli ruang ini?
create or replace function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from household_members where household_id = hid and user_id = auth.uid());
$$;

-- Adakah dua pengguna berkongsi sekurang-kurangnya satu ruang?
create or replace function public.shares_household(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from household_members a join household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Status Premium seseorang. Dalaman sahaja (tidak boleh dipanggil oleh pengguna).
-- Logik ini mesti sama dengan subscriptionIsActive() dalam src/lib/subscription.ts.
create or replace function public.user_is_premium(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions s
    where s.user_id = uid
      and (s.lifetime
           or (s.status in ('active', 'trialing', 'past_due')
               and (s.current_period_end is null or s.current_period_end > now() - interval '3 days')))
  );
$$;
revoke execute on function public.user_is_premium(uuid) from public, anon, authenticated;

-- Premium untuk pengguna semasa: langganan sendiri, ATAU ahli ruang keluarga yang pemiliknya Premium.
create or replace function public.my_premium() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.user_is_premium(auth.uid())
    or exists (
      select 1 from household_members m join households h on h.id = m.household_id
      where m.user_id = auth.uid() and public.user_is_premium(h.owner_id)
    )
  );
$$;

create or replace function public.household_is_premium(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member(hid)
     and exists (select 1 from households h where h.id = hid and public.user_is_premium(h.owner_id));
$$;

-- ---------- Pengguna baharu: cipta profil + ruang peribadi ----------

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  insert into households (name, owner_id, is_personal) values ('Peribadi', new.id, true) returning id into hid;
  insert into household_members (household_id, user_id, role) values (hid, new.id, 'owner');
  insert into profiles (id, display_name, active_household_id)
    values (new.id, left(coalesce(split_part(new.email, '@', 1), ''), 60), hid);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Bila ahli keluar/dibuang, pindahkan ruang aktifnya kembali ke ruang peribadi.
create or replace function public.handle_member_removed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles p set active_household_id = (
    select h.id from households h where h.owner_id = old.user_id and h.is_personal limit 1
  )
  where p.id = old.user_id and p.active_household_id = old.household_id;
  return old;
end $$;
revoke execute on function public.handle_member_removed() from public, anon, authenticated;

create trigger on_household_member_removed
  after delete on public.household_members for each row execute function public.handle_member_removed();

-- ---------- RPC (dipanggil dari app) ----------

-- Cipta ruang keluarga baharu (Premium sahaja).
create or replace function public.create_household(hname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not public.user_is_premium(auth.uid()) then raise exception 'premium_required' using errcode = 'P0001'; end if;
  if (select count(*) from households where owner_id = auth.uid() and not is_personal) >= 3 then
    raise exception 'too_many_households' using errcode = 'P0001';
  end if;
  insert into households (name, owner_id, is_personal)
    values (left(coalesce(nullif(trim(hname), ''), 'Keluarga'), 60), auth.uid(), false) returning id into hid;
  insert into household_members (household_id, user_id, role) values (hid, auth.uid(), 'owner');
  update profiles set active_household_id = hid where id = auth.uid();
  return hid;
end $$;

-- Jana kod jemputan 8 aksara (pemilik ruang keluarga Premium sahaja). Kod lama tidak sah lagi.
create or replace function public.create_invite(hid uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if not exists (select 1 from households where id = hid and owner_id = auth.uid() and not is_personal) then
    raise exception 'not_owner' using errcode = '42501';
  end if;
  if not public.user_is_premium(auth.uid()) then raise exception 'premium_required' using errcode = 'P0001'; end if;
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + (get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 0) % 32), 1);
    end loop;
    begin
      update households set invite_code = code where id = hid;
      exit;
    exception when unique_violation then
      -- kod bertembung (sangat jarang): cuba lagi
    end;
  end loop;
  return code;
end $$;

create or replace function public.clear_invite(hid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update households set invite_code = null where id = hid and owner_id = auth.uid();
end $$;

-- Sertai ruang keluarga dengan kod jemputan.
create or replace function public.join_household(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select id into hid from households where invite_code = upper(trim(code)) and not is_personal;
  if hid is null then raise exception 'invalid_code' using errcode = 'P0002'; end if;
  if not exists (select 1 from households h where h.id = hid and public.user_is_premium(h.owner_id)) then
    raise exception 'owner_not_premium' using errcode = 'P0001';
  end if;
  if not exists (select 1 from household_members where household_id = hid and user_id = auth.uid()) then
    if (select count(*) from household_members where household_id = hid) >= 6 then
      raise exception 'household_full' using errcode = 'P0001';
    end if;
    insert into household_members (household_id, user_id, role) values (hid, auth.uid(), 'member');
  end if;
  update profiles set active_household_id = hid where id = auth.uid();
  return hid;
end $$;

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.tasks enable row level security;
alter table public.expenses enable row level security;
alter table public.tax_claims enable row level security;
alter table public.subscriptions enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_household(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and (active_household_id is null or public.is_member(active_household_id)));

create policy households_select on public.households for select to authenticated
  using (public.is_member(id));
create policy households_update on public.households for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));
create policy households_delete on public.households for delete to authenticated
  using (owner_id = auth.uid() and not is_personal);

create policy members_select on public.household_members for select to authenticated
  using (public.is_member(household_id));
create policy members_delete on public.household_members for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or (role <> 'owner' and exists (select 1 from public.households h where h.id = household_id and h.owner_id = auth.uid()))
  );

create policy tasks_select on public.tasks for select to authenticated using (public.is_member(household_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_member(household_id) and created_by = auth.uid());
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy tasks_delete on public.tasks for delete to authenticated using (public.is_member(household_id));

create policy expenses_select on public.expenses for select to authenticated using (public.is_member(household_id));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (public.is_member(household_id) and created_by = auth.uid());
create policy expenses_update on public.expenses for update to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy expenses_delete on public.expenses for delete to authenticated using (public.is_member(household_id));

create policy tax_select on public.tax_claims for select to authenticated using (user_id = auth.uid());
create policy tax_insert on public.tax_claims for insert to authenticated
  with check (user_id = auth.uid() and public.my_premium());
create policy tax_update on public.tax_claims for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tax_delete on public.tax_claims for delete to authenticated using (user_id = auth.uid());

create policy subscriptions_select on public.subscriptions for select to authenticated using (user_id = auth.uid());

-- ---------- Kebenaran lajur (pengguna tidak boleh ubah pemilik, id, dsb.) ----------

revoke all on public.profiles, public.households, public.household_members, public.tasks,
  public.expenses, public.tax_claims, public.subscriptions from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, active_household_id) on public.profiles to authenticated;

grant select, delete on public.households to authenticated;
grant update (name, monthly_budget) on public.households to authenticated;

grant select, delete on public.household_members to authenticated;

grant select, insert, delete on public.tasks to authenticated;
grant update (title, due, done, done_at) on public.tasks to authenticated;

grant select, insert, delete on public.expenses to authenticated;
grant update (label, amount, category, date) on public.expenses to authenticated;

grant select, insert, delete on public.tax_claims to authenticated;
grant update (year, category, amount, date, note, receipt_path) on public.tax_claims to authenticated;

grant select on public.subscriptions to authenticated;

-- ---------- Storan gambar resit ----------
-- Fail disimpan di receipts/<user_id>/<fail>.jpg dan hanya pemiliknya boleh buka.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy receipts_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text and public.my_premium());
create policy receipts_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
