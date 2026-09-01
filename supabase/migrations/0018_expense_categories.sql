-- ============================================================================
-- PANEL OSOBISTY - 0018_expense_categories.sql
--
-- Kategorie wydatkow przestaja byc lista zaszyta w kodzie (CATEGORIES w
-- src/features/expenses/api.js) i staja sie danymi konta.
--
-- expenses.category zostaje tekstem, a nie kluczem obcym — celowo:
-- skasowanie kategorii nie moze osierocic ani przepisac historycznych
-- wydatkow. Kategoria wypisana z listy przestaje byc proponowana w
-- formularzu, ale stare wpisy dalej ja pokazuja.
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

create table if not exists public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 40),
  sort_order integer not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists expense_categories_uidx
  on public.expense_categories (user_id, lower(name));

-- Domyslna lista dla kont zalozonych przed ta migracja.
insert into public.expense_categories (user_id, name, sort_order)
select u.id, c.name, c.ord
from auth.users u
cross join (values
  ('Jedzenie', 1), ('Paliwo', 2), ('Dom', 3), ('Rachunki', 4), ('Zdrowie', 5),
  ('Ubrania', 6), ('Rozrywka', 7), ('Narzędzia', 8), ('Transport', 9), ('Inne', 10)
) as c(name, ord)
on conflict do nothing;

-- Nowe konta dostaja te sama liste przy rejestracji.
create or replace function public.handle_new_user_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.expense_categories (user_id, name, sort_order)
  values
    (new.id, 'Jedzenie', 1), (new.id, 'Paliwo', 2), (new.id, 'Dom', 3),
    (new.id, 'Rachunki', 4), (new.id, 'Zdrowie', 5), (new.id, 'Ubrania', 6),
    (new.id, 'Rozrywka', 7), (new.id, 'Narzędzia', 8), (new.id, 'Transport', 9),
    (new.id, 'Inne', 10)
  on conflict do nothing;
  return new;
end
$fn$;

drop trigger if exists on_auth_user_created_categories on auth.users;
create trigger on_auth_user_created_categories
  after insert on auth.users
  for each row execute function public.handle_new_user_categories();

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

  raise notice 'OK - kategorie wydatkow gotowe.';
end
$do$;
