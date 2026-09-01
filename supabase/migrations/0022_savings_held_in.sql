-- ============================================================================
-- PANEL OSOBISTY - 0022_savings_held_in.sql
--
-- GDZIE fizycznie leza odlozone pieniadze.
--
-- Bez tego wartosc netto liczyla je podwojnie: raz jako "gotowka w domu"
-- (bo tam faktycznie leza), drugi raz jako "odlozone na cel". To sa te same
-- banknoty — cel oszczednosciowy jest ETYKIETA na czesci posiadanych
-- pieniedzy, a nie osobnym workiem.
--
--   'cash'     — odlozone leza w gotowce w domu; do wartosci netto NIE
--                dodajemy ich osobno, tylko pokazujemy ile z gotowki jest
--                zaklepane na cel
--   'separate' — odlozone sa gdzie indziej (konto, lokata, skarbonka poza
--                spisem gotowki); wtedy licza sie jako osobne aktywo
--
-- Domyslnie 'cash', bo to bezpieczniejszy wariant: zaniza wartosc netto
-- zamiast ja zawyzac.
--
-- Idempotentna.
-- ============================================================================

do $do$
begin
  if not exists (select 1 from pg_type where typname = 'savings_location') then
    create type public.savings_location as enum ('cash', 'separate');
  end if;
end
$do$;

alter table public.savings_goal
  add column if not exists held_in public.savings_location not null default 'cash';

do $do$
begin
  raise notice 'OK - lokalizacja odlozonych gotowa.';
end
$do$;
