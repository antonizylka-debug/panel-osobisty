-- ============================================================================
-- PANEL OSOBISTY - 0001_schema.sql
-- Typy, tabele, indeksy, triggery updated_at.
-- Uruchom jako pierwszy. RLS jest w 0002_rls.sql.
--
-- ZASADY:
--  * kazda tabela ma user_id uuid not null references auth.users(id)
--  * user_id ma default auth.uid() -> aplikacja NIGDY nie wysyla user_id
--  * on delete cascade -> usuniecie konta kasuje wszystkie dane
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TYPY WYLICZENIOWE
-- ---------------------------------------------------------------------------
create type public.theme_pref              as enum ('system', 'light', 'dark');
create type public.expense_type            as enum ('receipt', 'subscription');
create type public.subscription_cycle      as enum ('weekly', 'monthly', 'quarterly', 'yearly');
create type public.expense_context         as enum ('private', 'work');
create type public.expense_for_whom        as enum ('self', 'someone_else');
create type public.pay_status              as enum ('pending', 'paid');
create type public.day_type                as enum ('work', 'off', 'vacation', 'sick');
create type public.journal_type            as enum ('thought', 'goal', 'past_link');
create type public.goal_status             as enum ('in_progress', 'achieved', 'abandoned');
create type public.procrastination_emotion as enum ('fear', 'boredom', 'overwhelm', 'reluctance', 'no_start');

-- ---------------------------------------------------------------------------
-- HELPER: automatyczny updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- PROFIL / USTAWIENIA KONTA
-- Motyw (wymaganie 7), ekran powitalny (9), przypomnienia (Dodatki).
-- ---------------------------------------------------------------------------
create table public.profiles (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  display_name            text,
  theme                   public.theme_pref not null default 'system',
  onboarded               boolean not null default false,
  reminder_time           time not null default '20:00',
  reminder_push_enabled   boolean not null default false,
  reminder_email_enabled  boolean not null default false,
  reminder_gratitude      boolean not null default true,
  reminder_work_hours     boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Subskrypcje Web Push (jeden uzytkownik = wiele urzadzen)
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- ---------------------------------------------------------------------------
-- ZAKLADKA 1 - START
-- ---------------------------------------------------------------------------
create table public.motivation_quotes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text        text not null check (length(btrim(text)) > 0),
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now()
);

create index motivation_quotes_user_idx on public.motivation_quotes (user_id, created_at desc);
create index motivation_quotes_fav_idx on public.motivation_quotes (user_id) where is_favorite;

-- Jeden glowny cel na konto -> upsert po user_id.
create table public.main_goal (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  title            text not null check (length(btrim(title)) > 0),
  description      text,
  progress_current numeric(12,2) not null default 0 check (progress_current >= 0),
  progress_target  numeric(12,2) check (progress_target > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger main_goal_set_updated_at
  before update on public.main_goal
  for each row execute function public.set_updated_at();

-- Jeden cel oszczednosciowy na konto (pasek: uzbierane / potrzebne).
-- current_amount dodane ponad liste pol ze specyfikacji, bo pasek postepu
-- nie ma bez niego czego pokazac.
create table public.savings_goal (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  title          text not null check (length(btrim(title)) > 0),
  target_amount  numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0 check (current_amount >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger savings_goal_set_updated_at
  before update on public.savings_goal
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ZAKLADKA 2 - WDZIECZNOSC
-- Jeden wpis dziennie (edytowalny) -> unique (user_id, date).
-- ---------------------------------------------------------------------------
create table public.gratitude_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  items       text[] not null check (array_length(items, 1) between 1 and 5),
  reflection  text,
  mood        smallint check (mood between 1 and 5),
  is_favorite boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, date)
);

create index gratitude_entries_user_date_idx on public.gratitude_entries (user_id, date desc);
create index gratitude_entries_fav_idx on public.gratitude_entries (user_id) where is_favorite;

create trigger gratitude_entries_set_updated_at
  before update on public.gratitude_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ZAKLADKA 3 - WYDATKI
-- ---------------------------------------------------------------------------
create table public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount             numeric(12,2) not null check (amount >= 0),
  date               date not null default current_date,
  description        text,
  type               public.expense_type not null default 'receipt',
  subscription_cycle public.subscription_cycle,
  context            public.expense_context not null default 'private',
  for_whom           public.expense_for_whom,
  for_whom_note      text,
  category           text,
  receipt_url        text,
  imported           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- cykl wymagany dokladnie dla subskrypcji
  constraint expenses_cycle_ck check ((type = 'subscription') = (subscription_cycle is not null)),
  -- "dla kogo" wymagane dokladnie dla kontekstu praca
  constraint expenses_for_whom_ck check ((context = 'work') = (for_whom is not null))
);

create index expenses_user_date_idx on public.expenses (user_id, date desc);
create index expenses_category_idx on public.expenses (user_id, category);
create index expenses_subscription_idx on public.expenses (user_id) where type = 'subscription';
-- wykrywanie duplikatow przy imporcie CSV (data + kwota + opis)
create index expenses_dupe_idx on public.expenses (user_id, date, amount);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

-- Budzet: category IS NULL = limit calego miesiaca, inaczej limit per kategoria.
create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month        date not null,
  limit_amount numeric(12,2) not null check (limit_amount > 0),
  category     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- zawsze pierwszy dzien miesiaca
  constraint budgets_month_ck check (date_trunc('month', month)::date = month)
);

create unique index budgets_overall_uidx  on public.budgets (user_id, month) where category is null;
create unique index budgets_category_uidx on public.budgets (user_id, month, category) where category is not null;

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- SPLATY I ZOBOWIAZANIA (sekcja w zakladce Wydatki)
-- ---------------------------------------------------------------------------
create table public.debts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  total_amount    numeric(12,2) not null check (total_amount > 0),
  monthly_payment numeric(12,2) not null check (monthly_payment > 0),
  payment_day     smallint not null check (payment_day between 1 and 31),
  start_date      date not null,
  end_date        date,
  creditor        text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint debts_dates_ck check (end_date is null or end_date >= start_date)
);

create index debts_active_idx on public.debts (user_id) where active;

create trigger debts_set_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

create table public.debt_payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_id    uuid not null references public.debts(id) on delete cascade,
  month      date not null,
  paid       boolean not null default false,
  paid_date  date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint debt_payments_month_ck check (date_trunc('month', month)::date = month),
  unique (debt_id, month)
);

create index debt_payments_user_month_idx on public.debt_payments (user_id, month desc);

create trigger debt_payments_set_updated_at
  before update on public.debt_payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ZAKLADKA 4 - GODZINY PRACY
-- hours_worked liczone auto (wyjazd z bazy -> powrot), ale edytowalne.
-- Realna stawka = pay_amount / (return_time - left_home_time) - liczona w apce.
-- ---------------------------------------------------------------------------
create table public.work_days (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date           date not null default current_date,
  wake_time      time,
  left_home_time time,
  left_base_time time,
  return_time    time,
  hours_worked   numeric(5,2) check (hours_worked >= 0 and hours_worked <= 24),
  pay_amount     numeric(12,2) check (pay_amount >= 0),
  pay_status     public.pay_status not null default 'pending',
  pay_date       date,
  paid_for_dates date[],
  business_hours numeric(5,2) check (business_hours >= 0 and business_hours <= 24),
  personal_hours numeric(5,2) check (personal_hours >= 0 and personal_hours <= 24),
  day_type       public.day_type not null default 'work',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, date)
);

create index work_days_user_date_idx on public.work_days (user_id, date desc);
create index work_days_pending_idx on public.work_days (user_id, date desc) where pay_status = 'pending';

create trigger work_days_set_updated_at
  before update on public.work_days
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ZAKLADKA 5 - MYSLI I CELE
-- ---------------------------------------------------------------------------
create table public.journal_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type           public.journal_type not null,
  title          text,
  content        text,
  tag            text,
  status         public.goal_status,
  due_date       date,
  problem_solved text,
  next_step      text,
  is_favorite    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- status istnieje dokladnie dla celow
  constraint journal_status_ck check ((type = 'goal') = (status is not null))
);

create index journal_entries_user_created_idx on public.journal_entries (user_id, created_at desc);
create index journal_entries_type_idx on public.journal_entries (user_id, type);
create index journal_entries_tag_idx on public.journal_entries (user_id, tag);
create index journal_entries_fav_idx on public.journal_entries (user_id) where is_favorite;
-- archiwum osiagnietych celow
create index journal_entries_achieved_idx on public.journal_entries (user_id, updated_at desc) where status = 'achieved';

create trigger journal_entries_set_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- Pula pytan do refleksji. To samo pytanie nie wraca czesciej niz raz na 30 dni
-- -> aplikacja losuje sposrod active = true and (last_used_at is null or last_used_at < now() - 30d).
create table public.reflection_prompts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text         text not null check (length(btrim(text)) > 0),
  last_used_at timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index reflection_prompts_pool_idx on public.reflection_prompts (user_id, last_used_at nulls first) where active;

-- ---------------------------------------------------------------------------
-- ZAKLADKA 6 - ZROB TO TERAZ
-- if_then_plan rozbity na KIEDY / GDZIE / CO (krok 3 specyfikacji).
-- BEZ karania: brak licznika porazek, completed = false to normalny stan.
-- ---------------------------------------------------------------------------
create table public.procrastination_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task          text not null check (length(btrim(task)) > 0),
  emotion       public.procrastination_emotion,
  micro_step    text,
  if_then_when  time,
  if_then_where text,
  if_then_what  text,
  timer_minutes smallint not null default 25 check (timer_minutes in (10, 15, 25)),
  rounds        smallint not null default 1 check (rounds >= 1),
  completed     boolean not null default false,
  reward        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index procrastination_user_created_idx on public.procrastination_sessions (user_id, created_at desc);
-- widok "moje wzorce": ktore emocje najczesciej blokuja
create index procrastination_emotion_idx on public.procrastination_sessions (user_id, emotion);

create trigger procrastination_set_updated_at
  before update on public.procrastination_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- DODATKI PRZEKROJOWE
-- ---------------------------------------------------------------------------
create table public.weekly_reviews (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start    date not null,
  went_well     text,
  would_change  text,
  next_priority text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- tydzien zaczyna sie w poniedzialek
  constraint weekly_reviews_monday_ck check (extract(isodow from week_start) = 1),
  unique (user_id, week_start)
);

create trigger weekly_reviews_set_updated_at
  before update on public.weekly_reviews
  for each row execute function public.set_updated_at();

-- Plan dnia: 3-5 rzeczy. completed[] jest dopasowywane dlugoscia do items[]
-- przez trigger, zeby zapis z samym items[] nie wywalal sie na constraincie.
create or replace function public.daily_plan_normalize()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
declare
  n int := coalesce(array_length(new.items, 1), 0);
  c int := coalesce(array_length(new.completed, 1), 0);
begin
  if c < n then
    new.completed := new.completed || array_fill(false, array[n - c]);
  elsif c > n then
    new.completed := new.completed[1:n];
  end if;
  return new;
end;
$fn$;

create table public.daily_plan (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date       date not null default current_date,
  items      text[] not null check (array_length(items, 1) between 1 and 5),
  completed  boolean[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_plan_lengths_ck check (
    coalesce(array_length(completed, 1), 0) = coalesce(array_length(items, 1), 0)
  ),
  unique (user_id, date)
);

create trigger daily_plan_normalize_trg
  before insert or update on public.daily_plan
  for each row execute function public.daily_plan_normalize();

create trigger daily_plan_set_updated_at
  before update on public.daily_plan
  for each row execute function public.set_updated_at();

create table public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  active     boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

create index habits_active_idx on public.habits (user_id, sort_order) where active;

create table public.habit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id   uuid not null references public.habits(id) on delete cascade,
  date       date not null default current_date,
  done       boolean not null default true,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, date desc);
