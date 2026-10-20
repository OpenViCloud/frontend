import { useState } from 'react'
import { toast } from 'sonner'
import {
  useAdminTenants,
  useUpdateTenantStatus,
  useUpdateTenantQuota,
  useUpdateTenantDebtCeiling,
  QUOTA_CAPS,
  type AdminTenant,
  type QuotaCap,
  type TenantQuotaCaps,
} from '../hooks/useAdminTenants'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT, useFormat } from '@/i18n/LanguageContext'
import { parseWholeVnd } from '@/lib/money'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// Humanise the raw status enum for display. Only PendingApproval reads badly as a bare token;
// the rest are already single words.
function statusLabel(status: string): string {
  return status === 'PendingApproval' ? 'Pending Approval' : status
}

export function AdminTenantsPage() {
  const t = useT()
  const f = useFormat()
  const { data: tenants, isLoading, isError } = useAdminTenants()
  const updateStatus = useUpdateTenantStatus()
  const [editing, setEditing] = useState<AdminTenant | null>(null)
  const [editingLimit, setEditingLimit] = useState<AdminTenant | null>(null)

  function changeStatus(tenant: AdminTenant, next: string, doneMessage: string) {
    updateStatus.mutate(
      { tenantId: tenant.id, status: next },
      {
        onSuccess: () => toast.success(doneMessage),
        onError: e => {
          const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code
          toast.error(code ?? t.adminTenants.updateFailed)
        },
      },
    )
  }

  function toggle(tenant: AdminTenant) {
    const next = tenant.status === 'Suspended' ? 'Active' : 'Suspended'
    changeStatus(tenant, next, next === 'Suspended' ? t.adminTenants.tenantSuspended : t.adminTenants.tenantActivated)
  }

  if (isLoading) return <div className="p-6 text-muted-foreground text-sm">{t.common.loading}</div>
  if (isError) return <div className="p-6 text-muted-foreground text-sm">{t.adminTenants.loadFailed}</div>

  return (
    <div>
      <h1 className="text-lg font-semibold mb-4">{t.adminTenants.title}</h1>
      {!tenants?.length ? (
        <p className="text-sm text-muted-foreground">{t.adminTenants.empty}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.adminTenants.name}</TableHead>
              <TableHead>{t.adminTenants.status}</TableHead>
              <TableHead>{t.adminTenants.quotaVmNet}</TableHead>
              <TableHead>{t.adminTenants.debtCeiling}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map(tenant => (
              <TableRow key={tenant.id}>
                <TableCell>{tenant.name}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      tenant.status === 'Suspended' ? 'warning' : tenant.status === 'PendingApproval' ? 'secondary' : 'success'
                    }
                  >
                    {statusLabel(tenant.status)}
                  </Badge>
                </TableCell>
                <TableCell>{tenant.maxVms} / {tenant.maxNetworks}</TableCell>
                <TableCell>
                  {/* No "default" marker any more: every tenant carries its own number, seeded at
                      signup. There is no system default left that a change could move. */}
                  <span className="font-mono text-sm">{f.money(tenant.debtCeiling, 'VND')}</span>
                </TableCell>
                <TableCell className="flex gap-2 justify-end">
                  {tenant.status === 'PendingApproval' ? (
                    // US-SL-01d — approve → Active, reject → Suspended. Distinct from the
                    // Suspend/Activate toggle, whose "Suspend" label on a pending row = silent reject.
                    <>
                      <Button
                        onClick={() => changeStatus(tenant, 'Active', t.adminTenants.tenantApproved)}
                        disabled={updateStatus.isPending}
                      >
                        {t.adminTenants.approve}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => changeStatus(tenant, 'Suspended', t.adminTenants.tenantRejected)}
                        disabled={updateStatus.isPending}
                      >
                        {t.adminTenants.reject}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => setEditing(tenant)}>
                        {t.adminTenants.editQuota}
                      </Button>
                      <Button variant="outline" onClick={() => setEditingLimit(tenant)}>
                        {t.adminTenants.debtCeiling}
                      </Button>
                      <Button variant="outline" onClick={() => toggle(tenant)} disabled={updateStatus.isPending}>
                        {tenant.status === 'Suspended' ? t.adminTenants.activate : t.adminTenants.suspend}
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <EditQuotaDialog tenant={editing} onClose={() => setEditing(null)} />
      <EditDebtCeilingDialog tenant={editingLimit} onClose={() => setEditingLimit(null)} />
    </div>
  )
}

// B-A02 — quota editor. Number inputs seeded from the tenant's current caps; Save PATCHes
// /v1/tenants/{id}/quota, all nine caps. Non-negative is enforced by the backend validator + domain; here we only
// block obviously-invalid input (empty / negative / not a whole number) so the request is well-formed.
const NON_NEGATIVE_WHOLE_NUMBER = /^\d+$/

function EditQuotaDialog({ tenant, onClose }: { tenant: AdminTenant | null; onClose: () => void }) {
  const t = useT()
  const updateQuota = useUpdateTenantQuota()
  const [values, setValues] = useState<Record<QuotaCap, string> | null>(null)

  // Re-seed inputs whenever a different tenant is opened.
  const openedFor = tenant?.id
  const [seededFor, setSeededFor] = useState<string | undefined>(undefined)
  if (tenant && openedFor !== seededFor) {
    setSeededFor(openedFor)
    setValues(seedQuotaValues(tenant))
  }

  const valid = values !== null && QUOTA_CAPS.every(cap => NON_NEGATIVE_WHOLE_NUMBER.test(values[cap].trim()))

  function setCap(cap: QuotaCap, value: string) {
    if (values === null) {
      return
    }
    setValues({ ...values, [cap]: value })
  }

  function save() {
    if (!tenant || values === null || !valid) {
      return
    }
    updateQuota.mutate(
      { tenantId: tenant.id, caps: quotaCapsFrom(values) },
      {
        onSuccess: () => {
          toast.success(t.adminTenants.quotaUpdated)
          onClose()
        },
        onError: e => {
          const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code
          toast.error(code ?? t.adminTenants.quotaUpdateFailed)
        },
      },
    )
  }

  return (
    <Dialog open={!!tenant} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.adminTenants.editQuota}</DialogTitle>
          <DialogDescription>{tenant ? t.adminTenants.resourceCapsFor(tenant.name) : ''}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUOTA_CAPS.map(cap => (
            <div key={cap} className="space-y-1">
              <label htmlFor={`quota-${cap}`} className="text-sm text-soft-foreground">{t.adminTenants[cap]}</label>
              <Input
                id={`quota-${cap}`}
                type="text"
                inputMode="numeric"
                value={values === null ? '' : values[cap]}
                onChange={e => setCap(cap, e.target.value)}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common.cancel}</Button>
          <Button onClick={save} disabled={!valid || updateQuota.isPending}>
            {updateQuota.isPending ? t.common.saving : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function seedQuotaValues(tenant: AdminTenant): Record<QuotaCap, string> {
  const seeded = {} as Record<QuotaCap, string>
  for (const cap of QUOTA_CAPS) {
    seeded[cap] = String(tenant[cap])
  }
  return seeded
}

function quotaCapsFrom(values: Record<QuotaCap, string>): TenantQuotaCaps {
  const caps = {} as TenantQuotaCaps
  for (const cap of QUOTA_CAPS) {
    caps[cap] = Number(values[cap].trim())
  }
  return caps
}

// Debt-ceiling editor. The number the admin reads when closing invoices at month-end — it does NOT
// block the tenant from creating anything (that gate was removed 2026-09-04), so the dialog must not
// promise enforcement it does not deliver. Empty is not a value here: every tenant has a number.
function EditDebtCeilingDialog({ tenant, onClose }: { tenant: AdminTenant | null; onClose: () => void }) {
  const t = useT()
  const updateCeiling = useUpdateTenantDebtCeiling()
  const [value, setValue] = useState('')
  const [seeded, setSeeded] = useState<string | null>(null)

  if (tenant && seeded !== tenant.id) {
    setSeeded(tenant.id)
    setValue(String(tenant.debtCeiling))
  }

  // Whole đồng, typed the way the table shows it (9.000.000 ₫); Number('9.000.000') would be NaN, '9.000' nine.
  const parsed = parseWholeVnd(value)
  const valid = parsed !== null

  function save() {
    if (!tenant || parsed === null) {
      return
    }
    updateCeiling.mutate(
      { tenantId: tenant.id, debtCeiling: parsed },
      {
        onSuccess: () => {
          toast.success(t.adminTenants.debtCeilingUpdated)
          onClose()
        },
        onError: e => {
          const code = (e as { response?: { data?: { code?: string } } })?.response?.data?.code
          toast.error(code ?? t.adminTenants.debtCeilingUpdateFailed)
        },
      },
    )
  }

  return (
    <Dialog open={!!tenant} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.adminTenants.debtCeiling}</DialogTitle>
          <DialogDescription>
            {t.adminTenants.debtCeilingDescription(tenant ? tenant.name : '')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label htmlFor="debt-ceiling" className="text-sm text-soft-foreground">{t.adminTenants.ceilingVnd}</label>
          <Input
            id="debt-ceiling"
            inputMode="numeric"
            value={value}
            onChange={e => setValue(e.target.value)}
          />
          {!valid && <p className="text-xs text-bad">{t.adminTenants.nonNegative}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common.cancel}</Button>
          <Button onClick={save} disabled={!valid || updateCeiling.isPending}>
            {updateCeiling.isPending ? t.common.saving : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
