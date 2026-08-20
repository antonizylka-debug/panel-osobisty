-- ============================================================================
-- PANEL OSOBISTY - 0002_rls.sql
-- Row Level Security na KAZDEJ tabeli w schemacie public. Bez wyjatkow.
--
-- Zamiast wypisywac 18 tabel x 4 polityki recznie, petla przechodzi po
-- wszystkich tabelach public. Dzieki temu kazda nowa tabela dodana pozniej
-- albo dostanie polityki po ponownym uruchomieniu tego pliku, albo wywali sie
-- na kontroli na koncu - nie da sie o niej po cichu zapomniec.
--
-- (select auth.uid()) zamiast auth.uid() - Postgres cachuje wynik raz na
-- zapytanie zamiast liczyc go dla kazdego wiersza.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Anon nie ma dostepu do niczego. Tylko zalogowani.
-- ---------------------------------------------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- 2. RLS + 4 polityki (SELECT / INSERT / UPDATE / DELETE) na kazdej tabeli
-- ---------------------------------------------------------------------------
do $do$
declare
  t record;
begin
  for t in
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
    order by c.relname
  loop
    -- Kontrola zalozenia: user_id musi istniec, inaczej polityka nie ma sensu.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = t.name
        and column_name = 'user_id'
    ) then
      raise exception 'Tabela public.% nie ma kolumny user_id - RLS nie da sie zalozyc', t.name;
    end if;

    execute format('alter table public.%I enable row level security', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_select_own', t.name);
    execute format($p$
      create policy %I on public.%I
        for select to authenticated
        using ((select auth.uid()) = user_id)
    $p$, t.name || '_select_own', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_insert_own', t.name);
    execute format($p$
      create policy %I on public.%I
        for insert to authenticated
        with check ((select auth.uid()) = user_id)
    $p$, t.name || '_insert_own', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_update_own', t.name);
    execute format($p$
      create policy %I on public.%I
        for update to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $p$, t.name || '_update_own', t.name);

    execute format('drop policy if exists %I on public.%I', t.name || '_delete_own', t.name);
    execute format($p$
      create policy %I on public.%I
        for delete to authenticated
        using ((select auth.uid()) = user_id)
    $p$, t.name || '_delete_own', t.name);
  end loop;
end
$do$;

-- ---------------------------------------------------------------------------
-- 3. Dodatkowa ochrona tabel podrzednych
-- Samo user_id nie wystarczy: uzytkownik mogby wpiac swoj wiersz pod cudze
-- debt_id / habit_id. Polityka RESTRICTIVE laczy sie z powyzszymi przez AND.
-- ---------------------------------------------------------------------------
drop policy if exists debt_payments_parent_own on public.debt_payments;
create policy debt_payments_parent_own on public.debt_payments
  as restrictive for all to authenticated
  using (exists (
    select 1 from public.debts d
    where d.id = debt_id and d.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.debts d
    where d.id = debt_id and d.user_id = (select auth.uid())
  ));

drop policy if exists habit_logs_parent_own on public.habit_logs;
create policy habit_logs_parent_own on public.habit_logs
  as restrictive for all to authenticated
  using (exists (
    select 1 from public.habits h
    where h.id = habit_id and h.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.habits h
    where h.id = habit_id and h.user_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 4. Kontrola koncowa - migracja nie przejdzie, jesli cokolwiek zostalo odkryte
-- ---------------------------------------------------------------------------
do $do$
declare
  bad text;
begin
  select string_agg(c.relname, ', ')
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if bad is not null then
    raise exception 'Tabele bez wlaczonego RLS: %', bad;
  end if;

  select string_agg(c.relname, ', ')
    into bad
  from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public'
    and c.relkind = 'r'
    and (
      select count(*) from pg_policy p
      where p.polrelid = c.oid and p.polpermissive
    ) < 4;

  if bad is not null then
    raise exception 'Tabele z niepelnym zestawem polityk (< 4): %', bad;
  end if;

  raise notice 'RLS OK - wszystkie tabele public maja RLS i komplet polityk.';
end
$do$;
