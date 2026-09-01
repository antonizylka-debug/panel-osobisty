-- ============================================================================
-- PANEL OSOBISTY - 0020_payment_method.sql
--
-- Czym zaplacone: gotowka / karta / przelew. Potrzebne, zeby powiazac
-- wydatki z zakladka "Gotowka w domu".
--
-- WAZNE co do modelu: wydatek gotowkowy NIE dopisuje wiersza do
-- cash_on_hand. Stan gotowki liczy sie jako
--     ostatni spis − wydatki gotowkowe od daty tego spisu
-- Powody:
--   1. Historia spisow zostaje czytelna — piec kaw tygodniowo nie zasmieca
--      jej pieciona "spisami", ktore spisami nie sa.
--   2. Kasowanie albo poprawa wydatku automatycznie prostuje stan gotowki,
--      bo nic nie jest zapisane na sztywno.
--   3. Kazde nowe przeliczenie zeruje dryf i ustawia nowy punkt odniesienia.
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum ('cash', 'card', 'transfer');
  end if;
end
$do$;

alter table public.expenses
  add column if not exists payment_method public.payment_method;

-- Wyszukiwanie wydatkow gotowkowych od ostatniego spisu.
create index if not exists expenses_cash_idx
  on public.expenses (user_id, date) where payment_method = 'cash';

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

  raise notice 'OK - metoda platnosci gotowa.';
end
$do$;
