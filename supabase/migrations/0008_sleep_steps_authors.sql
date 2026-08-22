-- ============================================================================
-- PANEL OSOBISTY - 0008_sleep_steps_authors.sql
--
-- 1. Sen i kroki — jeden wiersz na dzien (tabela daily_metrics)
-- 2. Autor przy cytacie motywacyjnym
--
-- Sen liczony z godzin: zasnalem -> wstalem, z obsluga przekroczenia polnocy
-- (22:30 -> 06:15 to 7,75 h, nie minus 16). Liczy trigger, zeby wartosc byla
-- spojna niezaleznie od tego, czy wpis przyszedl z apki, czy z importu.
--
-- Konczy sie ta sama petla RLS co 0002 — nowa tabela nie zostaje odsloniета.
-- Idempotentna: mozna puscic wielokrotnie.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Autor cytatu
-- ---------------------------------------------------------------------------
alter table public.motivation_quotes
  add column if not exists author text;

-- ---------------------------------------------------------------------------
-- 2. Sen i kroki
-- ---------------------------------------------------------------------------
create table if not exists public.daily_metrics (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date           date not null default current_date,
  steps          integer check (steps >= 0 and steps <= 200000),
  sleep_start    time,
  sleep_end      time,
  sleep_hours    numeric(4,2) check (sleep_hours >= 0 and sleep_hours <= 24),
  note           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists daily_metrics_user_date_idx on public.daily_metrics (user_id, date desc);

-- Godziny snu z pory zasniecia i pobudki; przekroczenie polnocy obslugiwane.
create or replace function public.daily_metrics_sleep_hours()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  mins integer;
begin
  if new.sleep_start is not null and new.sleep_end is not null then
    mins := (extract(hour from new.sleep_end) * 60 + extract(minute from new.sleep_end))
          - (extract(hour from new.sleep_start) * 60 + extract(minute from new.sleep_start));
    if mins <= 0 then
      mins := mins + 24 * 60;   -- zasniecie wieczorem, pobudka nastepnego dnia
    end if;
    new.sleep_hours := round(mins / 60.0, 2);
  elsif new.sleep_start is null and new.sleep_end is null then
    new.sleep_hours := null;
  end if;
  return new;
end;
$fn$;

drop trigger if exists daily_metrics_sleep_trg on public.daily_metrics;
create trigger daily_metrics_sleep_trg
  before insert or update on public.daily_metrics
  for each row execute function public.daily_metrics_sleep_hours();

drop trigger if exists daily_metrics_set_updated_at on public.daily_metrics;
create trigger daily_metrics_set_updated_at
  before update on public.daily_metrics
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS — ta sama petla co w 0002_rls.sql
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;

do $do$
declare t record;
begin
  for t in
    select c.relname as name from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' order by c.relname
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t.name and column_name = 'user_id'
    ) then
      raise exception 'Tabela public.% nie ma kolumny user_id', t.name;
    end if;

    execute format('alter table public.%I enable row level security', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_select_own', t.name);
    execute format($p$create policy %I on public.%I for select to authenticated
      using ((select auth.uid()) = user_id)$p$, t.name || '_select_own', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_insert_own', t.name);
    execute format($p$create policy %I on public.%I for insert to authenticated
      with check ((select auth.uid()) = user_id)$p$, t.name || '_insert_own', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_update_own', t.name);
    execute format($p$create policy %I on public.%I for update to authenticated
      using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$p$,
      t.name || '_update_own', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_delete_own', t.name);
    execute format($p$create policy %I on public.%I for delete to authenticated
      using ((select auth.uid()) = user_id)$p$, t.name || '_delete_own', t.name);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 4. Kontrola koncowa
-- ---------------------------------------------------------------------------
do $do$
declare bad text;
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

  raise notice 'OK - sen, kroki i autorzy cytatow gotowe.';
end
$do$;
