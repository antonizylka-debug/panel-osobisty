# Panel Osobisty

Osobisty panel PWA: wdzięczność, wydatki, godziny pracy, myśli i cele, anty-prokrastynacja.
Stos: **React (Vite) + Supabase** (Auth + Postgres + Storage, plan darmowy).

Stan budowy: **13 z 14 kroków gotowych.** Zostaje tryb offline (krok 11).

---

## Co jest w tym repo

```
supabase/
├── migrations/
│   ├── 0001_schema.sql            typy, 18 tabel, indeksy, triggery updated_at
│   ├── 0002_rls.sql               RLS + 4 polityki na każdej tabeli, bez wyjątków
│   ├── 0003_storage.sql           prywatny bucket na paragony + polityki
│   └── 0004_new_user_defaults.sql profil + nawyki + cytaty + pytania dla nowego konta
└── tests/
    └── rls.test.mjs               35 testów na PGlite (Postgres w WASM)
```

## Jak wgrać bazę do Supabase

1. Załóż projekt na [supabase.com](https://supabase.com) (plan darmowy).
2. SQL Editor → wklej i uruchom pliki **po kolei**: `0001` → `0002` → `0003` → `0004`.
3. Authentication → Providers → Email: włącz **Confirm email**.
4. Authentication → URL Configuration: ustaw adres apki (potrzebne do potwierdzenia maila i resetu hasła).

`0002` i `0004` można puszczać wielokrotnie — są idempotentne. `0001` i `0003` uruchamiasz raz.

Jeśli `0002` zgłosi błąd typu `Tabele bez włączonego RLS: ...` — to działa jak trzeba.
Ta migracja celowo **nie przechodzi**, dopóki jakakolwiek tabela w `public` jest odsłonięta.

## Jak odpalić testy

```bash
cd supabase/tests && npm install && npm test
```

Testy stawiają Postgresa w pamięci (PGlite), podstawiają atrapy schematów `auth` i `storage`,
puszczają wszystkie cztery migracje i sprawdzają m.in.:

- każda z 18 tabel ma RLS i komplet 4 polityk,
- użytkownik B nie odczyta, nie zmieni ani nie skasuje wpisu użytkownika A,
- B nie wstawi wiersza z cudzym `user_id`, nie podepnie raty pod cudzy dług ani nie odhaczy cudzego nawyku,
- `anon` nie ma dostępu do żadnej tabeli,
- B nie zobaczy ani nie podrzuci pliku do folderu paragonów A,
- usunięcie konta kasuje wszystkie dane.

Nie potrzeba Dockera ani łączenia się z produkcyjnym Supabase.

---

## Model danych — rzeczy, o których warto pamiętać przy pisaniu apki

**`user_id` wypełnia się samo.** Każda tabela ma `user_id uuid not null default auth.uid()`.
Front **nigdy** nie wysyła `user_id` w insercie — Postgres wstawia go z tokenu. Nie da się przez to
podpisać cudzym kontem, a kod po stronie apki jest krótszy.

**Ścieżka paragonu musi zaczynać się od uuid użytkownika:** `receipts/<user_id>/<nazwa>.jpg`.
Na tym opierają się polityki bucketa. Limit pliku 512 KB (apka kompresuje do ~200 KB).

**Pola z zerojedynkową zależnością pilnuje baza, nie formularz:**

| Reguła | Constraint |
|---|---|
| `type = 'subscription'` ⇔ jest `subscription_cycle` | `expenses_cycle_ck` |
| `context = 'work'` ⇔ jest `for_whom` | `expenses_for_whom_ck` |
| `type = 'goal'` ⇔ jest `status` | `journal_status_ck` |
| `budgets.month` to zawsze 1. dzień miesiąca | `budgets_month_ck` |
| `weekly_reviews.week_start` to zawsze poniedziałek | `weekly_reviews_monday_ck` |

**Jeden wpis na dzień** (`unique (user_id, date)`): `gratitude_entries`, `work_days`, `daily_plan`.
Zapis rób przez `upsert` z `onConflict`, nie przez „sprawdź czy istnieje, potem wstaw".

**`main_goal` i `savings_goal` mają `user_id` jako klucz główny** — jeden wiersz na konto, `upsert` bez `id`.

**`budgets.category = NULL`** to limit całego miesiąca; kategoria wypełniona to limit per kategoria.
Osobne indeksy unikalne pilnują, żeby nie było dwóch limitów na to samo.

**`daily_plan.completed[]`** jest automatycznie dociągane triggerem do długości `items[]` —
wystarczy wysłać samo `items`.

**Pytania do refleksji, „nie częściej niż raz na 30 dni":**
losuj z `reflection_prompts` gdzie `active` i (`last_used_at is null` lub `last_used_at < now() - interval '30 days'`),
po wylosowaniu ustaw `last_used_at = now()`.

## Odstępstwa od specyfikacji (świadome)

Specyfikacja wypisywała pola tabel skrótowo. Tam, gdzie wypisana lista nie wystarczała
do zbudowania opisanej funkcji, dołożyłem minimum:

- **`profiles`** — nie było na liście tabel, ale motyw zapamiętany dla konta (wym. 7),
  ekran powitalny (wym. 9) i ustawienia przypomnień nie mają się gdzie zapisać.
- **`savings_goal.current_amount`** — pasek „uzbierane / potrzebne" potrzebuje obu liczb.
- **`push_subscriptions`** — Web Push wymaga zapisania endpointu przeglądarki (jeden na urządzenie).
- **`expenses.subscription_cycle`, `expenses.for_whom_note`** — oba są w treści specyfikacji
  („subskrypcja + cykl", „dla kogoś innego (+ notatka)"), tylko nie w wypisanej liście kolumn.
- **`procrastination_sessions`** — `if_then_plan` rozbite na `if_then_when` / `if_then_where` /
  `if_then_what`, bo krok 3 pyta o KIEDY, GDZIE i CO osobno. Doszło `reward` (mini-nagroda z kroku 4).
- **`habits.sort_order`** — żeby checklista nie zmieniała kolejności przy każdym odświeżeniu.

**Czego celowo NIE ma:** `FORCE ROW LEVEL SECURITY`. RLS jest włączony wszędzie, ale bez `FORCE` —
inaczej przestaje działać edytor tabel w panelu Supabase i Twój własny wgląd w dane przez SQL Editor.
`service_role` (Edge Functions od przypomnień) i tak omija RLS przez uprawnienie `BYPASSRLS`.

---

## Kolejność budowy

- [x] **1. Schemat bazy + RLS**
- [x] **2. Rejestracja/logowanie + ochrona tras + ekran powitalny**
- [x] **3. PWA (manifest, ikony, service worker, skróty) + tryb ciemny + nawigacja**
- [x] **4. Wdzięczność**
- [x] **5. Godziny pracy**
- [x] **6. Wydatki (budżet, prognoza, przelicznik, paragony, spłaty)**
- [x] **7. Myśli i cele (notatki głosowe, pytania do refleksji)**
- [x] **8. Zrób to teraz**
- [x] **9. Dodatki: przegląd tygodnia, plan dnia, nawyki, ulubione, wyszukiwarka**
- [x] **10. Ekran Start**
- [ ] 11. Tryb offline (IndexedDB ↔ Supabase)
- [x] **12. Import wyciągu CSV**
- [x] **13. Przypomnienia (lokalne powiadomienia)**
- [x] **14. Ustawienia konta + eksport danych**
