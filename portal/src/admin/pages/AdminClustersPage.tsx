import { useState } from 'react'
import { toast } from 'sonner'
import {
  useAdminClusters,
  useProviderClientCertificate,
  useUpsertCluster,
  useTestClusterConnection,
  useDeleteCluster,
  type AdminCluster,
  type ClusterTestResult,
} from '../hooks/useAdminClusters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useT } from '@/i18n/LanguageContext'
import type { Messages } from '@/i18n/en'

// docs/features/cluster/design.md#cluster-admin-page
export function AdminClustersPage() {
  const t = useT()
  const { data: clusters, isLoading, isError } = useAdminClusters()

  return (
    <div>
      <h1 className="text-lg font-semibold mb-1">{t.adminClusters.title}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {t.adminClusters.intro}
      </p>
      <div className="space-y-4 max-w-xl">
        <ClientCertificateBlock />
        {isLoading && <p className="text-sm text-muted-foreground">{t.common.loading}</p>}
        {isError && <p className="text-sm text-muted-foreground">{t.adminClusters.loadFailed}</p>}
        {clusters !== undefined && clusters.length === 0 && <p className="text-sm text-muted-foreground">{t.adminClusters.noZones}</p>}
        {/* The key changes with the row, so a saved or deleted row remounts the form with what was read back. */}
        {clusters !== undefined && clusters.map(c => (
          <ClusterForm key={`${c.zoneId}|${c.source}|${c.updatedAt ?? ''}`} cluster={c} />
        ))}
      </div>
    </div>
  )
}

interface ErrorBody {
  code?: string
  title?: string
}

function errorBody(err: unknown): ErrorBody | undefined {
  const response = (err as { response?: { data?: ErrorBody } }).response
  if (response === undefined) {
    return undefined
  }
  return response.data
}

function errorCode(err: unknown): string | undefined {
  const body = errorBody(err)
  if (body === undefined) {
    return undefined
  }
  return body.code
}

// The code says which error it is; the title says how to fix the input (a validation message names the field).
function errorMessage(err: unknown, fallback: string): string {
  const body = errorBody(err)
  if (body === undefined || body.code === undefined) {
    return fallback
  }
  if (body.title === undefined || body.title === '') {
    return body.code
  }
  return `${body.code} — ${body.title}`
}

function ClientCertificateBlock() {
  const t = useT()
  const { data: certificate, isLoading, error } = useProviderClientCertificate()

  function copy() {
    if (certificate === undefined) {
      return
    }
    navigator.clipboard.writeText(certificate.certificatePem).then(
      () => toast.success(t.adminClusters.certificateCopied),
      () => toast.error(t.adminClusters.certificateCopyFailed),
    )
  }

  return (
    <section
      aria-labelledby="titan-client-certificate"
      className="rounded-lg border border-border p-4 space-y-3"
    >
      <h2 id="titan-client-certificate" className="text-sm font-medium text-foreground">
        {t.adminClusters.certificateTitle}
      </h2>
      {isLoading && <p className="text-xs text-muted-foreground">{t.common.loading}</p>}
      {error && (
        <p className="text-xs text-bad">
          {t.adminClusters.certificateReadFailed(errorCode(error) ?? t.adminClusters.certificateRequestFailed)}
        </p>
      )}
      {certificate !== undefined && (
        <>
          <Field label={t.adminClusters.fingerprint}>
            <span className="font-mono text-[12px] text-foreground break-all select-all">{certificate.fingerprint}</span>
          </Field>
          <pre className="max-h-40 overflow-auto rounded bg-overlay p-2 font-mono text-[11px] text-soft-foreground">
            {certificate.certificatePem}
          </pre>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={copy}>{t.adminClusters.copyCertificate}</Button>
            <span className="text-xs text-muted-foreground">
              {t.adminClusters.onTheCluster}<code className="font-mono">incus config trust add-certificate titan.crt</code>
            </span>
          </div>
        </>
      )}
    </section>
  )
}

function ClusterForm({ cluster }: { cluster: AdminCluster }) {
  const t = useT()
  const upsert = useUpsertCluster()
  const test = useTestClusterConnection()
  const [name, setName] = useState(cluster.name)
  const [endpoint, setEndpoint] = useState(cluster.endpoint)
  const [serverFingerprint, setServerFingerprint] = useState(cluster.serverFingerprint)
  const [formError, setFormError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<ClusterTestResult | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const isSaved = cluster.source === 'db'
  const canSave = !upsert.isPending && endpoint !== '' && serverFingerprint !== ''

  function save(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    upsert.mutate(
      { zoneId: cluster.zoneId, name, endpoint, serverFingerprint },
      {
        onSuccess: () => toast.success(t.adminClusters.clusterSaved),
        onError: err => {
          const message = errorMessage(err, t.adminClusters.saveFailed)
          setFormError(message)
          toast.error(message)
        },
      },
    )
  }

  function runTest() {
    setTestResult(null)
    test.mutate(
      { endpoint, serverFingerprint },
      { onSuccess: setTestResult, onError: () => setTestResult({ ok: false, latencyMs: null, error: t.adminClusters.requestFailed }) },
    )
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-border p-4 space-y-3" aria-label={t.adminClusters.formLabel(cluster.zoneId)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[13px] text-foreground">{cluster.zoneId}</span>
        {isSaved && <Badge variant="blue">{t.adminClusters.saved}</Badge>}
        {!isSaved && (
          <Badge variant="warning" title={t.adminClusters.notConfiguredHint}>
            {t.adminClusters.notConfigured}
          </Badge>
        )}
      </div>

      <Field label={t.adminClusters.clusterName} htmlFor={`name-${cluster.zoneId}`}>
        <Input id={`name-${cluster.zoneId}`} value={name} onChange={e => setName(e.target.value)} />
      </Field>
      <Field label={t.adminClusters.endpoint} htmlFor={`endpoint-${cluster.zoneId}`}>
        <Input
          id={`endpoint-${cluster.zoneId}`}
          placeholder="https://host:8443"
          value={endpoint}
          onChange={e => setEndpoint(e.target.value)}
        />
      </Field>
      <Field label={t.adminClusters.serverFingerprint} htmlFor={`fingerprint-${cluster.zoneId}`}>
        <Input
          id={`fingerprint-${cluster.zoneId}`}
          className="font-mono"
          placeholder={t.adminClusters.fingerprintPlaceholder}
          value={serverFingerprint}
          onChange={e => setServerFingerprint(e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" disabled={!canSave}>{t.common.save}</Button>
        <Button type="button" variant="secondary" onClick={runTest} disabled={test.isPending}>
          {t.adminClusters.testConnection}
        </Button>
        {isSaved && (
          <Button
            type="button"
            variant="destructive"
            className="ml-auto"
            onClick={() => setConfirmingDelete(true)}
          >
            {t.common.delete}
          </Button>
        )}
      </div>
      {testResult && (
        <p
          className={testResult.ok ? 'text-xs text-ok' : 'text-xs text-bad break-words'}
          role="status"
        >
          {testResultText(testResult, t)}
        </p>
      )}
      {formError && <p className="text-xs text-bad">{formError}</p>}
      <DeleteClusterDialog
        cluster={confirmingDelete ? cluster : null}
        onClose={() => setConfirmingDelete(false)}
      />
    </form>
  )
}

// The error text after "Failed:" is the control plane's own and stays as sent.
function testResultText(result: ClusterTestResult, t: Messages): string {
  if (result.ok) {
    if (result.latencyMs === null) {
      return t.adminClusters.connected
    }
    return t.adminClusters.connectedWithLatency(result.latencyMs)
  }
  if (result.error === null) {
    return t.adminClusters.testFailed(t.adminClusters.unknownError)
  }
  return t.adminClusters.testFailed(result.error)
}

// Typing the name is a guard against mis-clicks, not a security control — the backend gates by role.
function DeleteClusterDialog({ cluster, onClose }: { cluster: AdminCluster | null; onClose: () => void }) {
  const t = useT()
  const del = useDeleteCluster()
  const [typed, setTyped] = useState('')

  // Reset the typed confirmation whenever a different cluster is opened.
  const openedFor = cluster === null ? undefined : cluster.zoneId
  const clusterName = cluster === null ? '' : cluster.name
  const [seededFor, setSeededFor] = useState<string | undefined>(undefined)
  if (openedFor !== seededFor) {
    setSeededFor(openedFor)
    setTyped('')
  }

  const confirmed = cluster !== null && typed === cluster.name

  function closeWhenDismissed(open: boolean) {
    const dismissed = !open
    if (dismissed) {
      onClose()
    }
  }

  function doDelete() {
    if (cluster === null || !confirmed) {
      return
    }
    del.mutate(cluster.zoneId, {
      onSuccess: () => {
        toast.success(t.adminClusters.removed(cluster.zoneId))
        onClose()
      },
      onError: e => toast.error(errorMessage(e, t.adminClusters.deleteFailed)),
    })
  }

  return (
    <Dialog open={cluster !== null} onOpenChange={closeWhenDismissed}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.adminClusters.deleteTitle}</DialogTitle>
          <DialogDescription>
            {cluster !== null
              ? t.adminClusters.deleteDescription(cluster.zoneId)
              : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <label htmlFor="confirm-cluster-name" className="text-sm text-soft-foreground">
            {t.adminClusters.typeNameBefore}<span className="text-foreground">{clusterName}</span>{t.adminClusters.typeNameAfter}
          </label>
          <Input
            id="confirm-cluster-name"
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={clusterName}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="destructive" onClick={doDelete} disabled={!confirmed || del.isPending}>
            {del.isPending ? t.adminClusters.deleting : t.adminClusters.deleteConnection}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}
