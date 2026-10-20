import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// Shape mirrors AdminClusterDto (control-plane). 'db' = a registered Incus cluster; 'none' = a configured
// zone with no cluster yet (docs/features/cluster/design.md#cluster-incus). providerSettings is left out: no
// page edits it yet.
export interface AdminCluster {
  id: string | null
  zoneId: string
  name: string
  endpoint: string
  serverFingerprint: string
  source: 'db' | 'none'
  createdAt: string | null
  updatedAt: string | null
}

export interface UpsertClusterInput {
  zoneId: string
  name: string
  endpoint: string
  serverFingerprint: string
}

// The control plane sends null, not an absent field, for the half that does not apply.
export interface ClusterTestResult {
  ok: boolean
  latencyMs: number | null
  error: string | null
}

export interface TestClusterInput {
  endpoint: string
  serverFingerprint: string
}

// The public half only: the private key never leaves the control plane
// (docs/features/cluster/design.md#provider-client-identity).
export interface ProviderClientCertificate {
  certificatePem: string
  fingerprint: string
}

export function useAdminClusters() {
  return useQuery({
    queryKey: ['admin', 'clusters'],
    queryFn: () => api.get<AdminCluster[]>('/v1/admin/clusters').then(r => r.data),
  })
}

export function useProviderClientCertificate() {
  return useQuery({
    queryKey: ['admin', 'provider-client-certificate'],
    queryFn: () =>
      api.get<ProviderClientCertificate>('/v1/admin/clusters/client-certificate').then(r => r.data),
  })
}

export function useUpsertCluster() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ zoneId, ...body }: UpsertClusterInput) =>
      // docs/architecture/http-contract.md#commands-return-no-data: 204 with no body — the cluster list is re-read instead.
      api.put(`/v1/admin/clusters/${encodeURIComponent(zoneId)}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'clusters'] }),
  })
}

// Removes a zone's cluster row; the zone reads 'none' again until a cluster is saved.
export function useDeleteCluster() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (zoneId: string) =>
      api.delete(`/v1/admin/clusters/${encodeURIComponent(zoneId)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'clusters'] }),
  })
}

export function useTestClusterConnection() {
  return useMutation({
    mutationFn: (input: TestClusterInput) =>
      api.post<ClusterTestResult>('/v1/admin/clusters/test', input).then(r => r.data),
  })
}
