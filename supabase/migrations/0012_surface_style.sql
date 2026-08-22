-- ============================================================================
-- PANEL OSOBISTY - 0012_surface_style.sql
--
-- Styl powierzchni: neutralna szarosc albo tlo podbarwione kolorem akcentu.
-- Zapisywany przy koncie, tak samo jak motyw i kolor.
--
-- Idempotentna.
-- ============================================================================

alter table public.profiles
  add column if not exists surface text not null default 'neutral';

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_surface_ck') then
    alter table public.profiles add constraint profiles_surface_ck
      check (surface in ('neutral', 'tinted'));
  end if;
end
$do$;
