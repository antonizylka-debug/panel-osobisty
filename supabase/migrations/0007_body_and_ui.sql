-- ============================================================================
-- PANEL OSOBISTY - 0007_body_and_ui.sql
--
-- 1. Sledzenie wagi i kalorii (nowa zakladka Cialo)
-- 2. Dni odpoczynku w nawykach — nie lamia serii
-- 3. Kolor akcentu wybierany przez uzytkownika
-- 4. Dane ciala potrzebne do policzenia BMR/TDEE
--
-- Na koncu ponownie zaklada RLS na WSZYSTKICH tabelach — ta sama petla
-- co w 0002_rls.sql, zeby trzy nowe tabele nie zostaly odsloniete.
-- Idempotentna: mozna puscic wielokrotnie.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profil: kolor akcentu + dane do wyliczenia zapotrzebowania
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists accent         text not null default 'lime',
  add column if not exists height_cm      numeric(5,1),
  add column if not exists birth_date     date,
  add column if not exists sex            text,
  add column if not exists activity_level text not null default 'moderate';

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_sex_ck') then
    alter table public.profiles add constraint profiles_sex_ck
      check (sex is null or sex in ('male', 'female'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_activity_ck') then
    alter table public.profiles add constraint profiles_activity_ck
      check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_height_ck') then
    alter table public.profiles add constraint profiles_height_ck
      check (height_cm is null or (height_cm between 100 and 250));
  end if;
end
$do$;

-- ---------------------------------------------------------------------------
-- 2. Dni odpoczynku w nawykach
-- Odpoczynek nie liczy sie jako zrobione, ale nie zeruje serii.
-- ---------------------------------------------------------------------------
alter table public.habit_logs
  add column if not exists is_rest boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. Waga — jeden pomiar dziennie
-- ---------------------------------------------------------------------------
create table if not exists public.body_weights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date       date not null default current_date,
  weight_kg  numeric(5,2) not null check (weight_kg between 30 and 300),
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists body_weights_user_date_idx on public.body_weights (user_id, date desc);

drop trigger if exists body_weights_set_updated_at on public.body_weights;
create trigger body_weights_set_updated_at
  before update on public.body_weights
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Kalorie — jeden wpis dziennie
-- ---------------------------------------------------------------------------
create table if not exists public.nutrition_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  kcal        integer check (kcal >= 0 and kcal <= 20000),
  protein_g   numeric(6,1) check (protein_g >= 0),
  carbs_g     numeric(6,1) check (carbs_g >= 0),
  fat_g       numeric(6,1) check (fat_g >= 0),
  active_kcal integer check (active_kcal >= 0 and active_kcal <= 20000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists nutrition_days_user_date_idx on public.nutrition_days (user_id, date desc);

drop trigger if exists nutrition_days_set_updated_at on public.nutrition_days;
create trigger nutrition_days_set_updated_at
  before update on public.nutrition_days
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Cel wagowy — jeden na konto
-- ---------------------------------------------------------------------------
create table if not exists public.weight_goal (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  target_weight_kg numeric(5,2) not null check (target_weight_kg between 30 and 300),
  weekly_rate_kg   numeric(4,2) not null default 0.45 check (weekly_rate_kg > 0 and weekly_rate_kg <= 2),
  start_weight_kg  numeric(5,2) check (start_weight_kg between 30 and 300),
  start_date       date not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists weight_goal_set_updated_at on public.weight_goal;
create trigger weight_goal_set_updated_at
  before update on public.weight_goal
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS na nowych tabelach — ta sama petla co w 0002_rls.sql
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

do $do$
declare
  t record;
begin
  for t in
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t.name and column_name = 'user_id'
    ) then
      raise exception 'Tabela public.% nie ma kolumny user_id - RLS nie da sie zalozyc', t.name;
    end if;

    execute format('alter table public.%I enable row level security', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_select_own', t.name);
    execute format($p$
      create policy %I on public.%I for select to authenticated
      using ((select auth.uid()) = user_id)
    $p$, t.name || '_select_own', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_insert_own', t.name);
    execute format($p$
      create policy %I on public.%I for insert to authenticated
      with check ((select auth.uid()) = user_id)
    $p$, t.name || '_insert_own', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_update_own', t.name);
    execute format($p$
      create policy %I on public.%I for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)
    $p$, t.name || '_update_own', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_delete_own', t.name);
    execute format($p$
      create policy %I on public.%I for delete to authenticated
      using ((select auth.uid()) = user_id)
    $p$, t.name || '_delete_own', t.name);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 7. Kontrola koncowa
-- ---------------------------------------------------------------------------
do $do$
declare
  bad text;
begin
  select string_agg(c.relname, ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if bad is not null then raise exception 'Tabele bez RLS: %', bad; end if;

  select string_agg(c.relname, ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (select count(*) from pg_policy p where p.polrelid = c.oid and p.polpermissive) < 4;
  if bad is not null then raise exception 'Tabele z niepelnym zestawem polityk: %', bad; end if;

  select string_agg(c.relname, ', ') into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id'
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0
    and (d.oid is null or pg_get_expr(d.adbin, d.adrelid) not like '%uid()%');
  if bad is not null then raise exception 'Tabele bez default auth.uid(): %', bad; end if;

  raise notice 'OK - wszystkie tabele maja RLS, komplet polityk i automatyczne user_id.';
end
$do$;
