-- ============================================================================
-- PANEL OSOBISTY - 0010_work_hours_autofill.sql
--
-- Godziny pracy liczone po stronie bazy, gdy aplikacja ich nie poda.
--
-- PO CO: przez chwile apka liczyla godziny wylacznie od "wyjazdu z bazy".
-- W dniu bez bazy pole zostawalo puste, wiec do bazy szedl hours_worked = null
-- mimo wpisanych godzin wyjazdu z domu i powrotu. Trigger domyka ta dziure
-- niezaleznie od tego, jaka wersja apki wysyla wpis.
--
-- Kolejnosc liczenia: wyjazd z bazy -> powrot, a jesli bazy nie bylo,
-- to wyjazd z domu -> powrot. Wartosc podana wprost nie jest nadpisywana.
--
-- Na koncu uzupelnia istniejace wiersze, ktore ucierpialy.
-- Idempotentna: mozna puscic wielokrotnie.
-- ============================================================================

create or replace function public.work_days_fill_hours()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  start_t time;
  mins    integer;
begin
  -- Uzytkownik wpisal godziny recznie — nie ruszamy.
  if new.hours_worked is not null then
    return new;
  end if;

  start_t := coalesce(new.left_base_time, new.left_home_time);

  if start_t is null or new.return_time is null then
    return new;
  end if;

  mins := (extract(hour from new.return_time) * 60 + extract(minute from new.return_time))
        - (extract(hour from start_t) * 60 + extract(minute from start_t));

  if mins < 0 then
    mins := mins + 24 * 60;   -- zmiana przez polnoc
  end if;

  new.hours_worked := round(mins / 60.0, 2);
  return new;
end;
$fn$;

drop trigger if exists work_days_fill_hours_trg on public.work_days;
create trigger work_days_fill_hours_trg
  before insert or update on public.work_days
  for each row execute function public.work_days_fill_hours();

-- ---------------------------------------------------------------------------
-- Naprawa wierszy zapisanych, zanim trigger istnial.
-- ---------------------------------------------------------------------------
update public.work_days
set hours_worked = round(
  (
    (extract(hour from return_time) * 60 + extract(minute from return_time))
    - (extract(hour from coalesce(left_base_time, left_home_time)) * 60
       + extract(minute from coalesce(left_base_time, left_home_time)))
    + case
        when (extract(hour from return_time) * 60 + extract(minute from return_time))
           < (extract(hour from coalesce(left_base_time, left_home_time)) * 60
              + extract(minute from coalesce(left_base_time, left_home_time)))
        then 24 * 60 else 0
      end
  ) / 60.0, 2)
where hours_worked is null
  and return_time is not null
  and coalesce(left_base_time, left_home_time) is not null;

do $do$
declare n integer;
begin
  select count(*) into n from public.work_days
  where hours_worked is null and return_time is not null
    and coalesce(left_base_time, left_home_time) is not null;

  if n > 0 then
    raise exception 'Zostalo % dni bez policzonych godzin', n;
  end if;

  raise notice 'OK - godziny pracy liczone automatycznie, zalegle wiersze uzupelnione.';
end
$do$;
