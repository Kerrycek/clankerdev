/**
 * Hide remote suggestions while the debounced request key still belongs to
 * older input. React Query can legitimately retain those rows during the
 * debounce window, but presenting them under new text would make a stale row
 * selectable.
 */
export function currentSuggestionRows<T>(
  currentNeedle: string,
  debouncedNeedle: string,
  rows: T[] | undefined
): T[] {
  return currentNeedle === debouncedNeedle ? (rows ?? []) : [];
}
