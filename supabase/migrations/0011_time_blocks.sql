-- ============================================================================
-- PANEL OSOBISTY - 0011_time_blocks.sql
--
-- Bloki czasu poza dniowka: od ktorej do ktorej, w jakiej kategorii
-- i co konkretnie robiles.
--
-- Zastepuje dwa pola liczbowe (business_hours / personal_hours), w ktore
-- trzeba bylo wpisac sama liczbe. Kategoria jest zwyklym tekstem, wiec
-- poza "biznes" i "dla siebie" mozna dopisac wlasna.
--
-- Godziny liczy trigger z pory poczatku i konca, z obsluga przekroczenia
-- polnocy — tak samo jak przy snie i godzinach pracy.
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

create table if not exists public.time_blocks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date       date not null default current_date,
  category   text not null default 'business',
  label      text,
  start_time time,
  end_time   time,
  hours      numeric(5,2) check (hours >= 0 and hours <= 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_blocks_category_ck check (length(btrim(category)) > 0),
  -- albo podajesz godziny od-do, albo sam czas trwania
  constraint time_blocks_span_ck check (
    (start_time is not null and end_time is not null) or hours is not null
  )
);

create index if not exists time_blocks_user_date_idx on public.time_blocks (user_id, date desc);
create index if not exists time_blocks_category_idx on public.time_blocks (user_id, category);

-- Czas trwania z pory poczatku i konca; po polnocy nie wychodzi liczba ujemna.
create or replace function public.time_blocks_fill_hours()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  mins integer;
begin
  if new.start_time is not null and new.end_time is not null then
    mins := (extract(hour from new.end_time) * 60 + extract(minute from new.end_time))
          - (extract(hour from new.start_time) * 60 + extract(minute from new.start_time));
    if mins <= 0 then
      mins := mins + 24 * 60;
    end if;
    new.hours := round(mins / 60.0, 2);
  end if;

  new.category := btrim(new.category);
  return new;
end;
$fn$;

drop trigger if exists time_blocks_fill_hours_trg on public.time_blocks;
create trigger time_blocks_fill_hours_trg
  before insert or update on public.time_blocks
  for each row execute function public.time_blocks_fill_hours();

drop trigger if exists time_blocks_set_updated_at on public.time_blocks;
create trigger time_blocks_set_updated_at
  before update on public.time_blocks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Przeniesienie tego, co juz bylo wpisane w stare pola liczbowe.
-- ---------------------------------------------------------------------------
insert into public.time_blocks (user_id, date, category, label, hours)
select w.user_id, w.date, 'business', 'Przeniesione z wcześniejszego wpisu', w.business_hours
from public.work_days w
where w.business_hours is not null and w.business_hours > 0
  and not exists (
    select 1 from public.time_blocks b
    where b.user_id = w.user_id and b.date = w.date and b.category = 'business'
  );

insert into public.time_blocks (user_id, date, category, label, hours)
select w.user_id, w.date, 'personal', 'Przeniesione z wcześniejszego wpisu', w.personal_hours
from public.work_days w
where w.personal_hours is not null and w.personal_hours > 0
  and not exists (
    select 1 from public.time_blocks b
    where b.user_id = w.user_id and b.date = w.date and b.category = 'personal'
  );

-- ---------------------------------------------------------------------------
-- RLS — ta sama petla co w 0002_rls.sql
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

do $do$
declare bad text;
begin
  select string_agg(c.relname, ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (not c.relrowsecurity
      or (select count(*) from pg_policy p where p.polrelid = c.oid and p.polpermissive) < 4);
  if bad is not null then raise exception 'Tabele bez pelnego RLS: %', bad; end if;

  raise notice 'OK - bloki czasu gotowe.';
end
$do$;
