-- ============================================================================
-- PANEL OSOBISTY - 0006_default_uid_fix.sql
--
-- BLAD, ktory to naprawia:
--   "new row violates row-level security policy for table savings_goal"
--
-- Trzy tabele uzywaja user_id jako klucza glownego (jeden wiersz na konto)
-- i jako jedyne nie dostaly `default auth.uid()`. Aplikacja — zgodnie z
-- zasada opisana w README — nie wysyla user_id w insercie, wiec wchodzil
-- NULL i polityka INSERT (auth.uid() = user_id) slusznie odrzucala zapis.
--
-- Po tej migracji zachowuja sie tak samo jak pozostale 15 tabel.
-- Idempotentna: mozna puscic wielokrotnie.
-- ============================================================================

alter table public.profiles     alter column user_id set default auth.uid();
alter table public.main_goal    alter column user_id set default auth.uid();
alter table public.savings_goal alter column user_id set default auth.uid();

-- Kontrola: kazda tabela w public ma user_id z domyslna wartoscia auth.uid().
do $do$
declare
  bad text;
begin
  select string_agg(c.relname, ', ')
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid and a.attname = 'user_id'
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
  where n.nspname = 'public'
    and c.relkind = 'r'
    and a.attnum > 0
    and (d.oid is null or pg_get_expr(d.adbin, d.adrelid) not like '%uid()%');

  if bad is not null then
    raise exception 'Tabele bez default auth.uid() na user_id: %', bad;
  end if;

  raise notice 'OK - kazda tabela wypelnia user_id automatycznie.';
end
$do$;
