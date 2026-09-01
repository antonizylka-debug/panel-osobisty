import { useEffect, useState } from 'react'
import { fetchCategories, DEFAULT_CATEGORIES } from './categoriesApi'

/**
 * Nazwy aktywnych kategorii wydatkow.
 *
 * Zwraca wbudowana liste dopoki migracja 0018 nie jest uruchomiona albo gdy
 * konto nie ma jeszcze zadnej kategorii — kazdy formularz ma wtedy z czego
 * wybierac zamiast pokazywac pusty select.
 */
export function useCategories() {
  const [names, setNames] = useState(DEFAULT_CATEGORIES)

  useEffect(() => {
    let alive = true
    fetchCategories()
      .then((rows) => { if (alive && rows.length) setNames(rows.map((c) => c.name)) })
      .catch(() => { /* brak migracji — zostaja domyslne */ })
    return () => { alive = false }
  }, [])

  return names
}
