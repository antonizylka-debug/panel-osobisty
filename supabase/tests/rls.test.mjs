import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MIG = fileURLToPath(new URL('../migrations', import.meta.url))
const db = await new PGlite()

let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  PASS  ' + m) }
const bad = (m, e) => { fail++; console.log('  FAIL  ' + m + (e ? '\n        -> ' + String(e).split('\n')[0] : '')) }

async function expectOk (label, sql) {
  try { await db.exec(sql); ok(label) } catch (e) { bad(label, e) }
}
async function expectErr (label, sql, needle) {
  try {
    await db.exec(sql)
    bad(label + ' (oczekiwano bledu, przeszlo)')
  } catch (e) {
    if (needle && !String(e).toLowerCase().includes(needle.toLowerCase())) bad(label + ' (inny blad)', e)
    else ok(label)
  }
}
// SET ROLE bez LOCAL - poza transakcja SET LOCAL wygasa po instrukcji
// i kolejne zapytanie leci znowu jako superuser (ktory omija RLS).
const asUser = (id) => `reset role; set role authenticated; set request.jwt.claim.sub = '${id}';`
const asAdmin = 'reset role; reset request.jwt.claim.sub;'

// ---------------------------------------------------------------------------
// Stub tego, co Supabase daje z pudelka: role, schemat auth, schemat storage.
// ---------------------------------------------------------------------------
console.log('\n== STUB SUPABASE ==')
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text, owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage, auth to authenticated, anon;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant execute on function auth.uid() to authenticated, anon;
`)
console.log('  stub gotowy')

// ---------------------------------------------------------------------------
console.log('\n== MIGRACJE ==')
for (const f of ['0001_schema.sql', '0002_rls.sql', '0003_storage.sql', '0004_new_user_defaults.sql',
                 '0005_habit_progress.sql', '0006_default_uid_fix.sql', '0007_body_and_ui.sql']) {
  try {
    await db.exec(readFileSync(`${MIG}/${f}`, 'utf8'))
    ok(f)
  } catch (e) {
    bad(f, e)
    console.log('\nMigracja nie przeszla - dalsze testy pominiete.')
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
console.log('\n== POKRYCIE RLS ==')
{
  const r = await db.query(`
    select c.relname,
           c.relrowsecurity,
           (select count(*) from pg_policy p where p.polrelid = c.oid and p.polpermissive) as pol
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by 1
  `)
  console.log(`  tabel w public: ${r.rows.length}`)
  const missing = r.rows.filter(x => !x.relrowsecurity || Number(x.pol) < 4)
  if (missing.length) bad('kazda tabela ma RLS + 4 polityki: ' + missing.map(x => x.relname).join(', '))
  else ok(`kazda z ${r.rows.length} tabel ma RLS i 4 polityki`)

  const nouid = await db.query(`
    select table_name from information_schema.tables t
    where table_schema='public' and table_type='BASE TABLE'
      and not exists (select 1 from information_schema.columns c
                      where c.table_schema='public' and c.table_name=t.table_name and c.column_name='user_id')
  `)
  nouid.rows.length ? bad('kazda tabela ma user_id: brak w ' + nouid.rows.map(r => r.table_name).join(', '))
                    : ok('kazda tabela ma kolumne user_id')
}

// ---------------------------------------------------------------------------
console.log('\n== REJESTRACJA / DOMYSLNE DANE ==')
const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
await db.exec(`
  insert into auth.users (id, email) values ('${A}', 'a@test.pl'), ('${B}', 'b@test.pl');
`)
{
  const q = async (t) => Number((await db.query(`select count(*) c from public.${t} where user_id = '${A}'`)).rows[0].c)
  const p = await q('profiles'), h = await q('habits'), m = await q('motivation_quotes'), rp = await q('reflection_prompts')
  console.log(`  profil:${p} nawyki:${h} cytaty:${m} pytania:${rp}`)
  ;(p === 1 && h === 5 && m === 10 && rp === 15)
    ? ok('trigger on_auth_user_created zasiał komplet danych startowych')
    : bad('trigger nie zasial oczekiwanych danych')
}

// ---------------------------------------------------------------------------
console.log('\n== IZOLACJA DANYCH (RLS) ==')
await expectOk('A dodaje wdziecznosc bez podawania user_id (default auth.uid())',
  `${asUser(A)} insert into public.gratitude_entries (date, items, mood) values ('2026-08-20', array['test A'], 4);`)

{
  await db.exec(asUser(A))
  const own = await db.query(`select user_id from public.gratitude_entries`)
  own.rows.length === 1 && own.rows[0].user_id === A
    ? ok('user_id wypelniony automatycznie na A')
    : bad('user_id nie wskazuje na A: ' + JSON.stringify(own.rows))

  await db.exec(asUser(B))
  const other = await db.query(`select * from public.gratitude_entries`)
  other.rows.length === 0 ? ok('B nie widzi wpisu A (SELECT)') : bad(`B widzi ${other.rows.length} wierszy A`)

  const upd = await db.query(`update public.gratitude_entries set reflection = 'hack' returning id`)
  upd.rows.length === 0 ? ok('B nie moze zmienic wpisu A (UPDATE)') : bad('B zmienil wpis A')

  const del = await db.query(`delete from public.gratitude_entries returning id`)
  del.rows.length === 0 ? ok('B nie moze usunac wpisu A (DELETE)') : bad('B usunal wpis A')
}

await expectErr('B nie moze wstawic wiersza z cudzym user_id',
  `${asUser(B)} insert into public.gratitude_entries (user_id, date, items) values ('${A}', '2026-08-19', array['podszywam sie']);`,
  'row-level security')

await expectErr('anon nie ma dostepu do tabel',
  `reset role; set local role anon; select * from public.expenses;`,
  'permission denied')

// ---------------------------------------------------------------------------
console.log('\n== TABELE PODRZEDNE (polityka RESTRICTIVE) ==')
await db.exec(`${asUser(A)}
  insert into public.debts (name, total_amount, monthly_payment, payment_day, start_date)
  values ('Kredyt', 12000, 500, 10, '2026-01-01');
  insert into public.habits (name) values ('Nawyk A');
`)
const debtA = (await db.query(`${''}select id from public.debts where name = 'Kredyt'`)).rows[0].id
const habitA = (await db.query(`select id from public.habits where name = 'Nawyk A'`)).rows[0].id

await expectErr('B nie podepnie raty pod dlug A',
  `${asUser(B)} insert into public.debt_payments (debt_id, month, paid) values ('${debtA}', '2026-08-01', true);`,
  'row-level security')
await expectErr('B nie odhaczy nawyku A',
  `${asUser(B)} insert into public.habit_logs (habit_id, date) values ('${habitA}', '2026-08-20');`,
  'row-level security')
await expectOk('A moze odhaczyc swoj nawyk',
  `${asUser(A)} insert into public.habit_logs (habit_id, date) values ('${habitA}', '2026-08-20');`)

// ---------------------------------------------------------------------------
console.log('\n== SPOJNOSC DANYCH ==')
await expectErr('wydatek "praca" bez pola dla-kogo odrzucony',
  `${asUser(A)} insert into public.expenses (amount, context) values (100, 'work');`, 'expenses_for_whom_ck')
await expectOk('wydatek "praca" + "dla siebie" przechodzi',
  `${asUser(A)} insert into public.expenses (amount, context, for_whom) values (100, 'work', 'self');`)
await expectErr('subskrypcja bez cyklu odrzucona',
  `${asUser(A)} insert into public.expenses (amount, type) values (29.99, 'subscription');`, 'expenses_cycle_ck')
await expectOk('subskrypcja z cyklem przechodzi',
  `${asUser(A)} insert into public.expenses (amount, type, subscription_cycle) values (29.99, 'subscription', 'monthly');`)
await expectErr('cel bez statusu odrzucony',
  `${asUser(A)} insert into public.journal_entries (type, title) values ('goal', 'Cel');`, 'journal_status_ck')
await expectErr('mysl ze statusem odrzucona',
  `${asUser(A)} insert into public.journal_entries (type, content, status) values ('thought', 'x', 'in_progress');`, 'journal_status_ck')
await expectErr('budzet nie na 1. dzien miesiaca odrzucony',
  `${asUser(A)} insert into public.budgets (month, limit_amount) values ('2026-08-15', 3000);`, 'budgets_month_ck')
await expectErr('przeglad tygodnia nie od poniedzialku odrzucony',
  `${asUser(A)} insert into public.weekly_reviews (week_start) values ('2026-08-20');`, 'weekly_reviews_monday_ck')
await expectOk('przeglad tygodnia od poniedzialku przechodzi',
  `${asUser(A)} insert into public.weekly_reviews (week_start, went_well) values ('2026-08-17', 'ok');`)
await expectErr('drugi wpis wdziecznosci tego samego dnia odrzucony',
  `${asUser(A)} insert into public.gratitude_entries (date, items) values ('2026-08-20', array['drugi']);`, 'unique')

console.log('\n== TRIGGERY ==')
await db.exec(`${asUser(A)} insert into public.daily_plan (date, items) values ('2026-08-20', array['a','b','c']);`)
{
  const r = await db.query(`select completed from public.daily_plan where date = '2026-08-20'`)
  JSON.stringify(r.rows[0].completed) === '[false,false,false]'
    ? ok('daily_plan: completed[] dopasowane do items[] przez trigger')
    : bad('daily_plan completed = ' + JSON.stringify(r.rows[0].completed))
}
{
  const before = (await db.query(`select updated_at from public.gratitude_entries limit 1`)).rows[0].updated_at
  await db.exec(`update public.gratitude_entries set reflection = 'zmiana'`)
  const after = (await db.query(`select updated_at from public.gratitude_entries limit 1`)).rows[0].updated_at
  after > before ? ok('updated_at odswieza sie przy UPDATE') : bad('updated_at bez zmian')
}

console.log('\n== STORAGE ==')
{
  await db.exec(asAdmin)
  const b = await db.query(`select id, public, file_size_limit from storage.buckets where id = 'receipts'`)
  b.rows.length === 1 && b.rows[0].public === false
    ? ok(`bucket "receipts" prywatny, limit ${b.rows[0].file_size_limit} B`)
    : bad('bucket receipts nie utworzony albo publiczny')
  const p = await db.query(`select count(*) c from pg_policy where polrelid = 'storage.objects'::regclass`)
  Number(p.rows[0].c) === 4 ? ok('4 polityki na storage.objects') : bad(`polityk storage: ${p.rows[0].c}`)
}
await expectOk('A wgrywa paragon do swojego folderu',
  `${asUser(A)} insert into storage.objects (bucket_id, name) values ('receipts', '${A}/paragon.jpg');`)
await expectErr('B nie wgra pliku do folderu A',
  `${asUser(B)} insert into storage.objects (bucket_id, name) values ('receipts', '${A}/podrzucone.jpg');`,
  'row-level security')
{
  await db.exec(asUser(B))
  const r = await db.query(`select * from storage.objects where bucket_id = 'receipts'`)
  r.rows.length === 0 ? ok('B nie widzi paragonow A') : bad('B widzi paragony A')
}

// ---------------------------------------------------------------------------
console.log('\n== TABELE "JEDEN WIERSZ NA KONTO" ==')
// Regresja: user_id jest kluczem glownym i przez pomylke nie mial
// default auth.uid(), przez co zapis z apki lecial na RLS.
await expectOk('A zapisuje cel oszczednosciowy bez podawania user_id',
  `${asUser(A)} insert into public.savings_goal (title, target_amount, current_amount)
   values ('Start biznesu', 20000, 0);`)
await expectOk('A zapisuje glowny cel bez podawania user_id',
  `${asUser(A)} insert into public.main_goal (title) values ('Zostac przedsiebiorca')
   on conflict (user_id) do update set title = excluded.title;`)
{
  await db.exec(asUser(A))
  const s = await db.query(`select user_id, target_amount from public.savings_goal`)
  s.rows.length === 1 && s.rows[0].user_id === A
    ? ok('cel oszczednosciowy zapisany na wlasciwe konto')
    : bad('zly user_id w savings_goal: ' + JSON.stringify(s.rows))

  await db.exec(asUser(B))
  const other = await db.query(`select * from public.savings_goal`)
  other.rows.length === 0 ? ok('B nie widzi celu A') : bad('B widzi cel A')
}

// ---------------------------------------------------------------------------
console.log('\n== NAWYKI Z POSTEPEM ==')
{
  await db.exec(asUser(A))
  const seeded = await db.query(
    `select name, target, unit, step from public.habits where target is not null order by name`
  )
  seeded.rows.length === 2
    ? ok(`nowe konto dostaje ${seeded.rows.length} nawyki z celem liczbowym`)
    : bad(`oczekiwano 2 nawykow z celem, jest ${seeded.rows.length}`)
}
await expectOk('nawyk z postepem zapisuje wartosc czastkowa',
  `${asUser(A)} insert into public.habit_logs (habit_id, date, value, done)
   select id, '2026-08-21', 1.5, false from public.habits where target = 2 limit 1;`)
{
  await db.exec(asUser(A))
  const v = await db.query(`select value, done from public.habit_logs where value > 0`)
  Number(v.rows[0]?.value) === 1.5 && v.rows[0]?.done === false
    ? ok('czesciowy postep (1,5 z 2) zapisany, nawyk jeszcze nieodhaczony')
    : bad('zly zapis postepu: ' + JSON.stringify(v.rows))
}
await expectErr('ujemny postep odrzucony',
  `${asUser(A)} insert into public.habit_logs (habit_id, date, value)
   select id, '2026-08-19', -5 from public.habits limit 1;`, 'habit_logs_value_ck')
await expectErr('cel nawyku musi byc dodatni',
  `${asUser(A)} insert into public.habits (name, target) values ('Zly nawyk', 0);`, 'habits_target_ck')

console.log('\n== KASOWANIE KONTA ==')
{
  await db.exec(asAdmin)
  await db.exec(`delete from auth.users where id = '${A}'`)
  const t = ['profiles','habits','habit_logs','motivation_quotes','reflection_prompts','expenses',
             'debts','debt_payments','gratitude_entries','daily_plan','weekly_reviews','journal_entries']
  let left = 0
  for (const x of t) left += Number((await db.query(`select count(*) c from public.${x} where user_id = '${A}'`)).rows[0].c)
  left === 0 ? ok('usuniecie konta kasuje wszystkie dane (ON DELETE CASCADE)') : bad(`zostalo ${left} wierszy po kasacji konta`)
}

console.log(`\n===== WYNIK: ${pass} PASS / ${fail} FAIL =====`)
process.exit(fail ? 1 : 0)
