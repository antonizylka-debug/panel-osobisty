-- ============================================================================
-- PANEL OSOBISTY - 0021_savings_deposits.sql
--
-- Historia odkladania na cel oszczednosciowy.
--
-- Dotad savings_goal.current_amount bylo jedna liczba, ktora sie nadpisywalo —
-- wiadomo bylo ILE jest uzbierane, ale nie OD KIEDY, JAK CZESTO ani SKAD.
-- Ta tabela dokłada te trzy rzeczy.
--
-- current_amount na savings_goal ZOSTAJE zrodlem prawdy (czyta je pol apki:
-- pasek postepu, prognoza terminu, wartosc netto). Wplata przez nowy formularz
-- dopisuje wiersz TU i podbija tamta kwote. Reczna korekta current_amount dalej
-- dziala — po prostu nie zostawia sladu w historii.
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'savings_source') then
    create type public.savings_source as enum ('dniowka', 'dodatkowa', 'gotowka', 'inne');
  end if;
end
$do$;

create table if not exists public.savings_deposits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date       date not null default current_date,
  amount     numeric(12,2) not null check (amount <> 0),
  source     public.savings_source not null default 'inne',
  note       text,
  created_at timestamptz not null default now()
);

-- amount moze byc ujemne: wyplata z odlozonych to tez zdarzenie, ktore ma
-- zostac w historii, a nie cicha korekta stanu.

create index if not exists savings_deposits_user_date_idx
  on public.savings_deposits (user_id, date desc, created_at desc);

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

  raise notice 'OK - historia odkladania gotowa.';
end
$do$;
