/**
 * Tlumaczenie bledow z Supabase na zdania, ktore cos znacza.
 *
 * Do tej pory w interfejsie ladowalo goleerr.message, czyli rzeczy w stylu
 * "duplicate key value violates unique constraint work_days_user_id_date_key".
 * Uzytkownik nie wie, co z tym zrobic. Kazdy wzorzec ma wiec odpowiednik
 * mowiacy, CO sie stalo i CO z tym zrobic.
 *
 * Nieznany blad zostaje w oryginale — lepszy techniczny komunikat niz
 * zmyslony "cos poszlo nie tak", ktory ukrywa jedyna wskazowke.
 */

const PATTERNS = [
  [/Failed to fetch|NetworkError|ERR_INTERNET|Load failed/i,
    'Brak połączenia z internetem. Zapis poczeka i wyśle się, gdy wrócisz do sieci.'],

  [/JWT expired|token is expired|invalid claim|refresh_token/i,
    'Sesja wygasła. Zaloguj się jeszcze raz.'],

  [/Invalid login credentials/i,
    'Zły e-mail albo hasło.'],

  [/Email not confirmed/i,
    'Musisz najpierw potwierdzić e-mail — sprawdź skrzynkę.'],

  [/User already registered/i,
    'Na ten e-mail jest już konto. Zaloguj się albo zresetuj hasło.'],

  [/Password should be at least (\d+)/i,
    (m) => `Hasło musi mieć co najmniej ${m[1]} znaków.`],

  // Brakujaca kolumna = niewykonana migracja. Nazwa kolumny zostaje,
  // bo po niej poznajesz, ktorego pliku brakuje.
  [/Could not find the '([^']+)' column|column "?([\w.]+)"? does not exist/i,
    (m) => `Baza nie ma jeszcze kolumny „${m[1] || m[2]}" — brakuje migracji. Odpal ją w Supabase → SQL Editor.`],

  [/relation "([^"]+)" does not exist/i,
    (m) => `Baza nie ma jeszcze tabeli „${m[1]}" — brakuje migracji. Odpal ją w Supabase → SQL Editor.`],

  [/duplicate key value|already exists/i,
    'Taki wpis już istnieje — popraw ten, który jest, zamiast dodawać drugi.'],

  [/violates row-level security|permission denied/i,
    'Brak uprawnień do tego zapisu. Wyloguj się i zaloguj ponownie.'],

  [/violates check constraint/i,
    'Któraś wartość jest poza dozwolonym zakresem — sprawdź kwoty i godziny.'],

  [/violates foreign key constraint/i,
    'Ten wpis jest powiązany z innym, którego już nie ma. Odśwież stronę.'],

  [/violates not-null constraint/i,
    'Nie wypełniłeś wymaganego pola.'],

  [/payload too large|exceeded the maximum allowed size/i,
    'Plik jest za duży. Zrób mniejsze zdjęcie albo pomiń paragon.'],
]

export function describeError(err) {
  const raw = typeof err === 'string' ? err : err?.message ?? ''
  if (!raw) return 'Nie udało się zapisać.'

  for (const [pattern, replacement] of PATTERNS) {
    const match = raw.match(pattern)
    if (match) return typeof replacement === 'function' ? replacement(match) : replacement
  }
  return raw
}
