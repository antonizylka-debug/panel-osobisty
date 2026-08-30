-- ============================================================================
-- PANEL OSOBISTY - 0014_repair_budget_category_map.sql
--
-- Naprawa danych po bugu w starym saveBuckets(): edycja procentow kasowala
-- i wstawiala koperty od nowa, co przez ON DELETE CASCADE zabieralo tez
-- wszystkie przypisania kategorii z budget_category_map. Sam bug jest juz
-- naprawiony w kodzie (saveBuckets aktualizuje koperty w miejscu), ale
-- konta, ktore edytowaly podzial przed poprawka, zostaly z pusta mapa.
--
-- Ta migracja dogaduje standardowe przypisania kategoria -> koperta dla
-- kazdego konta, ktore ma juz koperty "Potrzeby"/"Zachcianki" (z nazwy,
-- bo id kopert jest inne na kazdym koncie) ale zero wierszy w
-- budget_category_map. Nie rusza kont z wlasnymi, niestandardowymi
-- nazwami kopert ani kont z juz istniejacym mapowaniem.
--
-- Bezpieczna do wielokrotnego uruchomienia.
-- ============================================================================

do $do$
declare
  u record;
  potrzeby uuid;
  zachcianki uuid;
begin
  for u in
    select b.user_id
    from public.budget_buckets b
    group by b.user_id
    having count(*) filter (where b.name in ('Potrzeby', 'Zachcianki')) > 0
       and not exists (
         select 1 from public.budget_category_map m where m.user_id = b.user_id
       )
  loop
    select id into potrzeby from public.budget_buckets
      where user_id = u.user_id and name = 'Potrzeby' limit 1;
    select id into zachcianki from public.budget_buckets
      where user_id = u.user_id and name = 'Zachcianki' limit 1;

    if potrzeby is not null then
      insert into public.budget_category_map (user_id, category, bucket_id) values
        (u.user_id, 'Jedzenie',  potrzeby),
        (u.user_id, 'Paliwo',    potrzeby),
        (u.user_id, 'Dom',       potrzeby),
        (u.user_id, 'Rachunki',  potrzeby),
        (u.user_id, 'Zdrowie',   potrzeby),
        (u.user_id, 'Transport', potrzeby),
        (u.user_id, 'Narzędzia', potrzeby)
      on conflict (user_id, category) do nothing;
    end if;

    if zachcianki is not null then
      insert into public.budget_category_map (user_id, category, bucket_id) values
        (u.user_id, 'Rozrywka', zachcianki),
        (u.user_id, 'Ubrania',  zachcianki),
        (u.user_id, 'Inne',     zachcianki)
      on conflict (user_id, category) do nothing;
    end if;
  end loop;

  raise notice 'OK - mapowanie kategorii dogadane tam, gdzie bylo puste.';
end
$do$;
