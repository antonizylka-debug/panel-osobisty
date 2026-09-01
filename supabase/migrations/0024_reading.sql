-- ============================================================================
-- PANEL OSOBISTY - 0024_reading.sql
--
-- Czytanie: ksiazki + dziennik stron.
--
-- Dwie tabele, bo to dwie rozne rzeczy: books to STAN ("jestem na 120 stronie
-- z 300"), reading_log to ZDARZENIA ("wczoraj 20 stron"). Sam stan nie pokaze
-- serii ani tempa; same zdarzenia zmuszalyby do sumowania przy kazdym
-- odczycie i rozjechalyby sie przy recznej korekcie.
--
-- books.current_page zostaje zrodlem prawdy dla postepu. Wpis do dziennika
-- podbija te liczbe — tak samo jak wplata podbija savings_goal (0021).
--
-- Konczy sie ta sama petla RLS co 0002. Idempotentna.
-- ============================================================================

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'book_status') then
    create type public.book_status as enum ('czytam', 'skonczona', 'porzucona', 'planuje');
  end if;
end
$do$;

create table if not exists public.books (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title        text not null check (length(trim(title)) between 1 and 200),
  author       text,
  total_pages  integer check (total_pages > 0),
  current_page integer not null default 0 check (current_page >= 0),
  status       public.book_status not null default 'czytam',
  started_at   date,
  finished_at  date,
  rating       smallint check (rating between 1 and 5),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- ocena i data konca maja sens tylko dla przeczytanej ksiazki
  constraint books_finished_ck check (status = 'skonczona' or finished_at is null)
);

create index if not exists books_user_status_idx on public.books (user_id, status);

drop trigger if exists books_set_updated_at on public.books;
create trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

create table if not exists public.reading_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  book_id    uuid references public.books(id) on delete cascade,
  date       date not null default current_date,
  pages      integer not null check (pages > 0),
  created_at timestamptz not null default now()
);

create index if not exists reading_log_user_date_idx on public.reading_log (user_id, date desc);

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

  raise notice 'OK - czytanie gotowe.';
end
$do$;
