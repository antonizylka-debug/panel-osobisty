-- ============================================================================
-- PANEL OSOBISTY - 0009_quote_packs.sql
--
-- Pakiet cytatow o dyscyplinie do listy motywacyjnej.
--
-- UWAGA co do autorstwa: podpisane sa tylko te zdania, ktore sa szeroko
-- cytowane i co do ktorych brzmienia mam pewnosc. Reszta idzie bez podpisu
-- jako zwykle zdania o dyscyplinie — wolalem nie wkladac komus w usta slow,
-- ktorych nie powiedzial. Wszystko edytujesz w Ustawieniach -> Cytaty.
--
-- Idempotentna: wstawia tylko cytaty, ktorych jeszcze nie masz.
-- ============================================================================

do $do$
declare
  u record;
  q record;
  pack constant text[][] := array[
    -- Jim Rohn — klasyki, powszechnie przypisywane i cytowane
    ['Dyscyplina waży kilogramy. Żal waży tony.', 'Jim Rohn'],
    ['Nie życz sobie, żeby było łatwiej. Życz sobie, żebyś był lepszy.', 'Jim Rohn'],
    ['Jesteś średnią pięciu osób, z którymi spędzasz najwięcej czasu.', 'Jim Rohn'],
    ['Sukces to kilka prostych rzeczy robionych codziennie.', 'Jim Rohn'],
    ['Zajmij się swoim planem, albo ktoś zatrudni cię do swojego.', 'Jim Rohn'],
    ['Czas jest wart więcej niż pieniądze. Pieniądze odzyskasz, czasu nie.', 'Jim Rohn'],

    -- David Goggins — motywy, z ktorych jest znany
    ['Kiedy myślisz, że masz dość, jesteś dopiero na czterdziestu procentach.', 'David Goggins'],
    ['Nikt nie przyjdzie cię uratować. Rób swoje.', 'David Goggins'],
    ['Zostań najtwardszą osobą, jaką znasz.', 'David Goggins'],

    -- Bez podpisu — zdania o dyscyplinie, nie przypisane nikomu
    ['Motywacja się kończy. Nawyk zostaje.', null],
    ['Nikt nie widzi porannych treningów. Wszyscy widzą wynik.', null],
    ['Możesz mieć wymówki albo wyniki. Nie oba naraz.', null],
    ['Ciało odpuszcza pierwsze. Głowa decyduje, czy idziesz dalej.', null],
    ['Trudne staje się łatwe, kiedy robisz to codziennie.', null],
    ['Ten, kim będziesz za rok, zależy od tego, co zrobisz dziś wieczorem.', null],
    ['Nie musisz być gotowy. Musisz zacząć.', null],
    ['Dyscyplina to robić to, czego nie chcesz, gdy nie chcesz.', null],
    ['Wygodne życie i mocne życie to dwie różne rzeczy.', null],
    ['Płacisz teraz albo płacisz później. Później jest drożej.', null],
    ['Jeden dzień odpuszczony to dzień. Trzy to nowy nawyk.', null]
  ];
begin
  for u in select id from auth.users loop
    for i in 1 .. array_length(pack, 1) loop
      if not exists (
        select 1 from public.motivation_quotes
        where user_id = u.id and text = pack[i][1]
      ) then
        insert into public.motivation_quotes (user_id, text, author)
        values (u.id, pack[i][1], pack[i][2]);
      end if;
    end loop;
  end loop;
end
$do$;
