-- ============================================================================
-- PANEL OSOBISTY - 0025_quit_trackers.sql
--
-- "Bez czegos": licznik dni od ostatniego zlamania.
--
-- Model: tracker (od kiedy probujesz) + wpadki (kiedy sie zdarzylo).
-- Seria = dni od ostatniej wpadki, a gdy jej nie bylo — od daty startu.
--
-- Wpadka NIE kasuje trackera i nie zeruje historii. Zapisujemy ja jako
-- zdarzenie, bo najciekawsza liczba to nie biezaca seria, tylko REKORD i to,
-- czy kolejne podejscia sa dluzsze od poprzednich. Kasowanie licznika przy
-- kazdym potknieciu gubi dokladnie te informacje.
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

create table if not exists public.quit_trackers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 80),
  started_at date not null default current_date,
  active     boolean not null default true,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists quit_trackers_user_idx on public.quit_trackers (user_id) where active;

create table if not exists public.quit_slips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tracker_id uuid not null references public.quit_trackers(id) on delete cascade,
  date       date not null default current_date,
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists quit_slips_tracker_idx on public.quit_slips (tracker_id, date desc);

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

  raise notice 'OK - liczniki "bez czegos" gotowe.';
end
$do$;
