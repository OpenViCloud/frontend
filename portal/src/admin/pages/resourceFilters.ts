// Shared client-side filter + sort logic for the admin cross-tenant resource views (VM, Network).
// The status filter works on the label the row shows (labelOf: incusLabel for a network, vmLabel for a VM): an
// observed state, or the move a waiting request makes — so an admin can pick out every network "Deleting".
// Both list a read-only, already-loaded set; filtering/sorting happens in the browser and does not
// touch the /v1/admin/* contract. UI controls live in resourceFilterControls.tsx.

export type SortDir = null | 'asc' | 'desc'

// null → asc → desc → asc … (once clicked the header always has a defined direction).
export function nextSortDir(prev: SortDir): SortDir {
  return prev === 'asc' ? 'desc' : 'asc'
}

interface HasName {
  name: string
}

export function distinctStatuses<T extends HasName>(items: T[] | undefined, labelOf: (item: T) => string): string[] {
  return Array.from(new Set((items ?? []).map(i => labelOf(i)))).sort()
}

export function filterAndSort<T extends HasName>(
  items: T[], status: string, dir: SortDir, labelOf: (item: T) => string,
): T[] {
  const filtered = status ? items.filter(i => labelOf(i) === status) : items
  if (!dir) return filtered
  // Copy before sort — never mutate the query cache array in place.
  return [...filtered].sort((a, b) =>
    dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
  )
}
