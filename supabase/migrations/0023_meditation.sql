-- ============================================================================
-- PANEL OSOBISTY - 0023_meditation.sql
--
-- Medytacja: sesje z timerem i (opcjonalnie) prowadzonym oddechem.
--
-- duration_seconds, nie minutes — sesja przerwana po 3 minutach ma sie
-- zapisac jako 3 minuty, a nie zniknac przez zaokraglenie do zera. Liczy sie
-- CZAS FAKTYCZNY, nie zaplanowany: przerwana sesja to tez sesja.
--
-- mood_before/after sa opcjonalne. Sens medytacji widac dopiero w roznicy
-- miedzy nimi, ale wymuszanie dwoch klikniec przy kazdej sesji zniechecaloby
-- do samego siadania.
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

create table if not exists public.meditation_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date             date not null default current_date,
  duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 86400),
  planned_seconds  integer check (planned_seconds > 0),
  technique        text not null default 'cisza',
  mood_before      smallint check (mood_before between 1 and 5),
  mood_after       smallint check (mood_after between 1 and 5),
  note             text,
  created_at       timestamptz not null default now()
);

create index if not exists meditation_sessions_user_date_idx
  on public.meditation_sessions (user_id, date desc, created_at desc);

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

  raise notice 'OK - medytacja gotowa.';
end
$do$;
