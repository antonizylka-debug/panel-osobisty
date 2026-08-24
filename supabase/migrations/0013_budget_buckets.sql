-- ============================================================================
-- PANEL OSOBISTY - 0013_budget_buckets.sql
--
-- Podzial przychodu na koperty procentowe — metoda 50/30/20 i jej odmiany.
--
--   50% potrzeby      (czynsz, jedzenie, paliwo, rachunki)
--   30% zachcianki    (rozrywka, ubrania, wyjscia)
--   20% oszczednosci  (to, czego nie wydajesz)
--
-- Koperty sa edytowalne: mozna zmienic procenty, nazwy, dodac wlasne.
-- Kategorie wydatkow przypisuje sie do kopert, zeby apka wiedziala,
-- z ktorej koperty schodzi dany wydatek.
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

create table if not exists public.budget_buckets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  percent    numeric(5,2) not null check (percent >= 0 and percent <= 100),
  is_savings boolean not null default false,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists budget_buckets_user_idx on public.budget_buckets (user_id, sort_order);

drop trigger if exists budget_buckets_set_updated_at on public.budget_buckets;
create trigger budget_buckets_set_updated_at
  before update on public.budget_buckets
  for each row execute function public.set_updated_at();

-- Ktora kategoria wydatku schodzi z ktorej koperty.
create table if not exists public.budget_category_map (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category   text not null check (length(btrim(category)) > 0),
  bucket_id  uuid not null references public.budget_buckets(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, category)
);

create index if not exists budget_category_map_user_idx on public.budget_category_map (user_id, category);

-- ---------------------------------------------------------------------------
-- Domyslny podzial 50/30/20 dla kont, ktore jeszcze nic nie maja
-- ---------------------------------------------------------------------------
do $do$
declare
  u record;
  potrzeby uuid;
  zachcianki uuid;
  oszczednosci uuid;
begin
  for u in select id from auth.users loop
    if exists (select 1 from public.budget_buckets where user_id = u.id) then
      continue;
    end if;

    insert into public.budget_buckets (user_id, name, percent, is_savings, sort_order)
    values (u.id, 'Potrzeby', 50, false, 1) returning id into potrzeby;

    insert into public.budget_buckets (user_id, name, percent, is_savings, sort_order)
    values (u.id, 'Zachcianki', 30, false, 2) returning id into zachcianki;

    insert into public.budget_buckets (user_id, name, percent, is_savings, sort_order)
    values (u.id, 'Oszczędności', 20, true, 3) returning id into oszczednosci;

    insert into public.budget_category_map (user_id, category, bucket_id) values
      (u.id, 'Jedzenie',  potrzeby),
      (u.id, 'Paliwo',    potrzeby),
      (u.id, 'Dom',       potrzeby),
      (u.id, 'Rachunki',  potrzeby),
      (u.id, 'Zdrowie',   potrzeby),
      (u.id, 'Transport', potrzeby),
      (u.id, 'Narzędzia', potrzeby),
      (u.id, 'Rozrywka',  zachcianki),
      (u.id, 'Ubrania',   zachcianki),
      (u.id, 'Inne',      zachcianki)
    on conflict (user_id, category) do nothing;
  end loop;
end
$do$;

-- Nowe konta dostaja ten sam podzial przy rejestracji.
create or replace function public.seed_budget_buckets()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  potrzeby uuid;
  zachcianki uuid;
begin
  insert into public.budget_buckets (user_id, name, percent, is_savings, sort_order)
  values (new.id, 'Potrzeby', 50, false, 1) returning id into potrzeby;

  insert into public.budget_buckets (user_id, name, percent, is_savings, sort_order)
  values (new.id, 'Zachcianki', 30, false, 2) returning id into zachcianki;

  insert into public.budget_buckets (user_id, name, percent, is_savings, sort_order)
  values (new.id, 'Oszczędności', 20, true, 3);

  insert into public.budget_category_map (user_id, category, bucket_id) values
    (new.id, 'Jedzenie',  potrzeby),
    (new.id, 'Paliwo',    potrzeby),
    (new.id, 'Dom',       potrzeby),
    (new.id, 'Rachunki',  potrzeby),
    (new.id, 'Zdrowie',   potrzeby),
    (new.id, 'Transport', potrzeby),
    (new.id, 'Narzędzia', potrzeby),
    (new.id, 'Rozrywka',  zachcianki),
    (new.id, 'Ubrania',   zachcianki),
    (new.id, 'Inne',      zachcianki)
  on conflict (user_id, category) do nothing;

  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created_budget on auth.users;
create trigger on_auth_user_created_budget
  after insert on auth.users
  for each row execute function public.seed_budget_buckets();

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

-- Koperta w mapowaniu musi nalezec do tego samego uzytkownika.
drop policy if exists budget_category_map_parent_own on public.budget_category_map;
create policy budget_category_map_parent_own on public.budget_category_map
  as restrictive for all to authenticated
  using (exists (
    select 1 from public.budget_buckets b
    where b.id = bucket_id and b.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.budget_buckets b
    where b.id = bucket_id and b.user_id = (select auth.uid())
  ));

do $do$
declare bad text;
begin
  select string_agg(c.relname, ', ') into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
    and (not c.relrowsecurity
      or (select count(*) from pg_policy p where p.polrelid = c.oid and p.polpermissive) < 4);
  if bad is not null then raise exception 'Tabele bez pelnego RLS: %', bad; end if;

  raise notice 'OK - koperty budzetowe gotowe.';
end
$do$;
