import type { LucideIcon } from 'lucide-react'
import { Building2, Server, DollarSign, Gift } from 'lucide-react'
import { useAdminTenants } from '../hooks/useAdminTenants'
import { useAdminVms } from '../hooks/useAdminResources'
import { useAdminInvoices } from '../hooks/useAdminInvoices'
import { useAdminPromotionalCredits } from '../hooks/useAdminPromotionalCredits'
import { useT, useFormat } from '@/i18n/LanguageContext'
import { runsAGuest } from '@/lib/vmState'

// Platform overview KPIs. Each number is derived client-side from the same admin lists the
// detail pages already load (tenants, cross-tenant VMs, invoices) — no dedicated summary endpoint.
// Cards render immediately with zeros and fill in as each query resolves, so the shell never blocks.

export function AdminDashboardPage() {
  const t = useT()
  const f = useFormat()
  const { data: tenants = [] } = useAdminTenants()
  const { data: vms = [] } = useAdminVms()
  const { data: invoices = [] } = useAdminInvoices()
  const { data: promoCredits = [] } = useAdminPromotionalCredits()

  const activeTenants = tenants.filter(tenant => tenant.status === 'Active').length
  // US-PROMO-01 — free credit is now an immediate admin grant, not a request queue. There is nothing
  // "pending" to count, so this KPI shows how many grants have been made.
  const grantsCount = promoCredits.length
  const runningVms = vms.filter(runsAGuest).length

  // Invoices are issued on day 1 for the month that just closed, so the current month has none yet.
  // The card shows the latest period that has invoices, ordered by year then month.
  let latestYear = 0
  let latestMonth = 0
  for (const i of invoices) {
    const isLater = i.periodYear > latestYear || (i.periodYear === latestYear && i.periodMonth > latestMonth)
    if (isLater) {
      latestYear = i.periodYear
      latestMonth = i.periodMonth
    }
  }
  const periodInvoices = invoices.filter(i => i.periodYear === latestYear && i.periodMonth === latestMonth)
  const revenue = periodInvoices.reduce((sum, i) => sum + i.total, 0)
  const currency = periodInvoices[0]?.currency ?? 'VND'
  let revenueTitle = t.adminDashboard.invoiced
  let revenueSub = t.adminDashboard.noInvoicesYet
  if (periodInvoices.length > 0) {
    revenueTitle = t.adminDashboard.invoicedPeriod(f.month(latestYear, latestMonth))
    revenueSub = t.adminDashboard.invoiceCount(periodInvoices.length)
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-5">{t.adminDashboard.title}</h1>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
        <Kpi
          testId="kpi-tenants"
          title={t.adminDashboard.totalTenants}
          value={String(tenants.length)}
          sub={t.adminDashboard.activeCount(activeTenants)}
          icon={Building2}
        />
        <Kpi
          testId="kpi-vms"
          title={t.adminDashboard.activeVms}
          value={String(runningVms)}
          sub={t.adminDashboard.vmsTotal(vms.length)}
          icon={Server}
        />
        <Kpi
          testId="kpi-revenue"
          title={revenueTitle}
          value={f.money(revenue, currency)}
          sub={revenueSub}
          icon={DollarSign}
        />
        <Kpi
          testId="kpi-pending"
          title={t.adminDashboard.promoGranted}
          value={String(grantsCount)}
          sub={grantsCount === 0 ? t.adminDashboard.noneGranted : t.adminDashboard.totalGrants}
          icon={Gift}
        />
      </div>
    </div>
  )
}

function Kpi({
  testId,
  title,
  value,
  sub,
  icon: Icon,
}: {
  testId: string
  title: string
  value: string
  sub: string
  icon: LucideIcon
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-border bg-card p-5">
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
        <p data-testid={testId} className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-1.5 text-xs text-faint">{sub}</p>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border text-faint">
        <Icon className="w-4 h-4" />
      </div>
    </div>
  )
}
