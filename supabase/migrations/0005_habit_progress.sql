-- ============================================================================
-- PANEL OSOBISTY - 0005_habit_progress.sql
-- Nawyk moze byc zero-jedynkowy (jak dotad) albo miec cel liczbowy:
-- "2 litry wody", "20 pompek", "10 stron".
--
--   target = null  -> stary nawyk na ptaszka, jedno klikniecie
--   target > 0     -> nawyk z postepem, klikniecie dodaje "step"
--
-- Idempotentna: mozna puscic wielokrotnie.
-- RLS nie wymaga zmian — nie dochodzi zadna tabela, a polityki z 0002_rls.sql
-- obejmuja cala tabele, nie pojedyncze kolumny.
-- ============================================================================

alter table public.habits
  add column if not exists target numeric(8,2),
  add column if not exists unit   text,
  add column if not exists step   numeric(8,2) not null default 1;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'habits_target_ck') then
    alter table public.habits add constraint habits_target_ck check (target is null or target > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'habits_step_ck') then
    alter table public.habits add constraint habits_step_ck check (step > 0);
  end if;
end
$do$;

alter table public.habit_logs
  add column if not exists value numeric(8,2) not null default 0;

do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'habit_logs_value_ck') then
    alter table public.habit_logs add constraint habit_logs_value_ck check (value >= 0);
  end if;
end
$do$;

-- Nowe konta dostaja jeden nawyk z postepem, zeby bylo widac, ze tak mozna.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.habits (user_id, name, sort_order, target, unit, step)
  values
    (new.id, 'Wypiłem 2 litry wody',         1, 2,    'l', 0.5),
    (new.id, 'Ruch albo spacer 30 minut',     2, null, null, 1),
    (new.id, 'Pierwsza godzina bez telefonu', 3, null, null, 1),
    (new.id, 'Przeczytałem 10 stron',         4, 10,  'str.', 5),
    (new.id, 'Spać przed 23:00',              5, null, null, 1);

  insert into public.motivation_quotes (user_id, text)
  values
    (new.id, 'Nie musisz mieć ochoty. Musisz tylko zacząć.'),
    (new.id, 'Dzisiejsza godzina jest warta więcej niż jutrzejszy plan.'),
    (new.id, 'Najgorsza wersja zrobiona bije najlepszą wersję odłożoną.'),
    (new.id, 'To, co robisz codziennie, znaczy więcej niż to, co robisz czasem.'),
    (new.id, 'Nie porównuj swojego początku z czyimś dziesiątym rokiem.'),
    (new.id, 'Każda złotówka odłożona dziś kupuje ci wolność jutro.'),
    (new.id, 'Zmęczenie mija. To, że odpuściłeś, zostaje.'),
    (new.id, 'Mały krok w dobrą stronę to nadal dobra strona.'),
    (new.id, 'Pracujesz na swoje nazwisko, nawet gdy nikt nie patrzy.'),
    (new.id, 'Jeden dzień słabszy nie kasuje trzydziestu dobrych.');

  insert into public.reflection_prompts (user_id, text)
  values
    (new.id, 'Czego dziś unikałem i dlaczego?'),
    (new.id, 'Jaki jeden krok przybliżył mnie dziś do celu?'),
    (new.id, 'Co zabrało mi dziś najwięcej energii?'),
    (new.id, 'Za co dziś jestem sobie wdzięczny?'),
    (new.id, 'Co zrobiłbym inaczej, gdyby ten dzień zaczął się od nowa?'),
    (new.id, 'Na co dziś wydałem pieniądze, choć nie musiałem?'),
    (new.id, 'Kto mi dziś pomógł, choć nie musiał?'),
    (new.id, 'Co odkładam od tygodnia i dlaczego to takie ciężkie?'),
    (new.id, 'Jak dziś wyglądałby mój dzień, gdybym już był tam, gdzie chcę być?'),
    (new.id, 'Co mnie dziś ucieszyło, choć trwało tylko chwilę?'),
    (new.id, 'Ile godzin dziś naprawdę pracowałem, a ile tylko byłem w pracy?'),
    (new.id, 'Co takiego robię z przyzwyczajenia, a nie z wyboru?'),
    (new.id, 'Jaka jedna rzecz, gdybym ją ogarnął, ułatwiłaby resztę?'),
    (new.id, 'Czego się dziś nauczyłem o sobie?'),
    (new.id, 'Co powiedziałbym dziś sobie sprzed roku?');

  return new;
end;
$fn$;
