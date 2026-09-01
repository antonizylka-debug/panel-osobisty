-- ============================================================================
-- PANEL OSOBISTY - 0019_recurring_expenses.sql
--
-- Wydatki cykliczne: szablon (Netflix, 29,99 zl, co miesiac) + data
-- najblizszego wystapienia. Apka przy starcie dopisuje zalegle wystapienia
-- i przesuwa next_due — dotad subskrypcje byly tylko TYPEM wydatku, ktory
-- i tak trzeba bylo wklepywac recznie co miesiac.
--
-- Klucz to next_due + unikalny indeks (recurring_id, date) na expenses:
-- nawet gdy apka odpali sie piec razy pod rzad albo na dwoch urzadzeniach,
-- ten sam cykl nie zdubluje wydatku.
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

create table if not exists public.recurring_expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  description   text not null check (length(trim(description)) between 1 and 120),
  amount        numeric(12,2) not null check (amount > 0),
  category      text,
  context       public.expense_context not null default 'private',
  for_whom      public.expense_for_whom,
  cycle         public.subscription_cycle not null,
  next_due      date not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- ta sama regula co na expenses: "dla kogo" tylko przy kontekscie praca
  constraint recurring_for_whom_ck check ((context = 'work') = (for_whom is not null))
);

create index if not exists recurring_expenses_due_idx
  on public.recurring_expenses (user_id, next_due) where active;

drop trigger if exists recurring_expenses_set_updated_at on public.recurring_expenses;
create trigger recurring_expenses_set_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

-- Slad po szablonie na wygenerowanym wydatku.
alter table public.expenses
  add column if not exists recurring_id uuid references public.recurring_expenses(id) on delete set null;

-- Zabezpieczenie przed podwojnym dopisaniem tego samego cyklu.
create unique index if not exists expenses_recurring_date_uidx
  on public.expenses (recurring_id, date) where recurring_id is not null;

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

  raise notice 'OK - wydatki cykliczne gotowe.';
end
$do$;
