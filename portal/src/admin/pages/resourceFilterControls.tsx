// UI controls for the admin resource-view filter/sort. Logic lives in resourceFilters.ts.
import type { SortDir } from './resourceFilters'
import { useT } from '@/i18n/LanguageContext'

// The status options stay English in both languages: they are the badge words the rows show.
export function StatusFilter({ statuses, value, onChange }: {
  statuses: string[]
  value: string
  onChange: (v: string) => void
}) {
  const t = useT()
  return (
    <select
      aria-label={t.adminFilters.filterByStatus}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-muted border border-border rounded-md px-2 py-1 text-[13px] text-foreground"
    >
      <option value="">{t.adminFilters.allStatuses}</option>
      {statuses.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}

export function SortByName({ dir, onToggle }: { dir: SortDir; onToggle: () => void }) {
  const t = useT()
  const arrow = dir === 'asc' ? ' ▲' : dir === 'desc' ? ' ▼' : ''
  return (
    <button
      type="button"
      aria-label={t.adminFilters.sortByName}
      onClick={onToggle}
      className="inline-flex items-center font-medium text-inherit hover:text-foreground"
    >
      {t.adminFilters.name}{arrow}
    </button>
  )
}
