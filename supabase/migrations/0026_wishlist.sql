-- ============================================================================
-- PANEL OSOBISTY - 0026_wishlist.sql
--
-- Rzeczy, na ktore zbierasz.
--
-- Apka zna realna stawke godzinowa i tempo odkladania, wiec kazda pozycja
-- moze pokazac dwie liczby, ktorych nie da sie zobaczyc nigdzie indziej:
-- ILE TO JEST W GODZINACH PRACY i KIEDY BEDZIE CIE NA TO STAC.
--
-- decided_at zapisuje moment decyzji (kupione / odpuszczone), zeby dalo sie
-- policzyc, ile pieniedzy zaoszczedzila sama lista — pozycje odpuszczone to
-- realnie niewydane pieniadze.
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'wish_status') then
    create type public.wish_status as enum ('chce', 'kupione', 'odpuszczam');
  end if;
end
$do$;

create table if not exists public.wishlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(trim(name)) between 1 and 160),
  price      numeric(12,2) not null check (price > 0),
  priority   smallint not null default 2 check (priority between 1 and 3),
  url        text,
  note       text,
  status     public.wish_status not null default 'chce',
  decided_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- data decyzji tylko dla pozycji rozstrzygnietych
  constraint wishlist_decided_ck check ((status = 'chce') = (decided_at is null))
);

create index if not exists wishlist_user_status_idx on public.wishlist (user_id, status, priority);

drop trigger if exists wishlist_set_updated_at on public.wishlist;
create trigger wishlist_set_updated_at
  before update on public.wishlist
  for each row execute function public.set_updated_at();

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

  raise notice 'OK - lista rzeczy gotowa.';
end
$do$;
