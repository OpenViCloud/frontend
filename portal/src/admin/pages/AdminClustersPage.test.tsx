import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/renderWithProviders'
import { AdminClustersPage } from './AdminClustersPage'

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() }, Toaster: () => null }))

const PIN = 'ffcf7803b2371e90834c2dd2a454f48bcb9c541b16dd7dc54a93a104b1aa108f'
const TITAN_FINGERPRINT = '7c094b4f42e1d25d78b9d017eaa125827a8824d978e3cf8973916b36d6a379c2'
const TITAN_PEM = '-----BEGIN CERTIFICATE-----\nMIIBtitan\n-----END CERTIFICATE-----\n'

const cluster = (o = {}) => ({
  id: 'c1', zoneId: 'mock', name: 'incus-stub', endpoint: 'https://incus-stub:8443',
  serverFingerprint: PIN, source: 'db', createdAt: '2026-10-07T00:00:00Z', updatedAt: '2026-10-07T00:00:00Z',
  providerSettings: { ovnUplinkNetwork: null, storagePool: null },
  ...o,
})

const notConfigured = () => cluster({
  id: null, zoneId: 'eude01', name: 'eude01', endpoint: '', serverFingerprint: '', source: 'none',
  createdAt: null, updatedAt: null,
})

function serve(clusters: unknown[]) {
  server.use(
    http.get('*/v1/admin/clusters', () => HttpResponse.json(clusters)),
    http.get('*/v1/admin/clusters/client-certificate', () =>
      HttpResponse.json({ certificatePem: TITAN_PEM, fingerprint: TITAN_FINGERPRINT })),
  )
}

describe('AdminClustersPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows Titan's client certificate to trust on the cluster, public half only", async () => {
    serve([cluster()])
    renderWithProviders(<AdminClustersPage />)

    const block = await screen.findByRole('region', { name: 'Titan client certificate' })
    await waitFor(() => expect(within(block).getByText(TITAN_FINGERPRINT)).toBeInTheDocument())
    expect(within(block).getByText(/MIIBtitan/)).toBeInTheDocument()
    expect(within(block).getByText(/incus config trust add-certificate/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/PRIVATE KEY/)
  })

  it('copies the certificate PEM', async () => {
    serve([cluster()])
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    renderWithProviders(<AdminClustersPage />)

    await user.click(await screen.findByRole('button', { name: 'Copy certificate' }))

    expect(writeText).toHaveBeenCalledWith(TITAN_PEM)
  })

  it('reports an unreadable certificate in its block and keeps the zone forms usable', async () => {
    server.use(
      http.get('*/v1/admin/clusters', () => HttpResponse.json([cluster()])),
      http.get('*/v1/admin/clusters/client-certificate', () =>
        HttpResponse.json({ status: 503, title: 'x', code: 'CLUSTER_IDENTITY_UNREADABLE' }, { status: 503 })),
    )
    renderWithProviders(<AdminClustersPage />)

    const block = await screen.findByRole('region', { name: 'Titan client certificate' })
    await waitFor(() => expect(within(block).getByText(/CLUSTER_IDENTITY_UNREADABLE/)).toBeInTheDocument())
    expect(screen.getByDisplayValue('https://incus-stub:8443')).toBeInTheDocument()
  })

  it('shows a saved zone with endpoint and server fingerprint, and no username or password', async () => {
    serve([cluster()])
    renderWithProviders(<AdminClustersPage />)

    await waitFor(() => expect(screen.getByDisplayValue('https://incus-stub:8443')).toBeInTheDocument())
    expect(screen.getByDisplayValue('incus-stub')).toBeInTheDocument()
    expect(screen.getByDisplayValue(PIN)).toBeInTheDocument()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.queryByLabelText(/username/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })

  it('saves name, endpoint and server fingerprint only, then reads the list again', async () => {
    let body: Record<string, unknown> | null = null
    let listReads = 0
    server.use(
      http.get('*/v1/admin/clusters', () => {
        listReads++
        if (body === null) {
          return HttpResponse.json([notConfigured()])
        }
        return HttpResponse.json([cluster({ zoneId: 'eude01', name: 'eude01', endpoint: 'https://incus-eu:8443' })])
      }),
      http.get('*/v1/admin/clusters/client-certificate', () =>
        HttpResponse.json({ certificatePem: TITAN_PEM, fingerprint: TITAN_FINGERPRINT })),
      http.put('*/v1/admin/clusters/eude01', async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminClustersPage />)
    await screen.findByText('Not configured')

    await user.type(screen.getByLabelText('Endpoint'), 'https://incus-eu:8443')
    await user.type(screen.getByLabelText('Server fingerprint'), PIN)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(body).not.toBeNull())
    expect(body).toEqual({ name: 'eude01', endpoint: 'https://incus-eu:8443', serverFingerprint: PIN })
    await waitFor(() => expect(listReads).toBeGreaterThan(1))
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument())
  })

  it('keeps Save off until both endpoint and server fingerprint are given', async () => {
    serve([notConfigured()])
    const user = userEvent.setup()
    renderWithProviders(<AdminClustersPage />)
    await screen.findByText('Not configured')

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(screen.getByLabelText('Endpoint'), 'https://incus-eu:8443')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    await user.type(screen.getByLabelText('Server fingerprint'), PIN)
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('surfaces the error code when the save is rejected', async () => {
    serve([cluster()])
    server.use(http.put('*/v1/admin/clusters/mock', () =>
      HttpResponse.json({ status: 400, title: 'Endpoint must be an https:// URL.', code: 'VALIDATION_ERROR' }, { status: 400 })))
    const user = userEvent.setup()
    renderWithProviders(<AdminClustersPage />)
    await waitFor(() => expect(screen.getByDisplayValue(PIN)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('VALIDATION_ERROR — Endpoint must be an https:// URL.')).toBeInTheDocument())
  })

  it('tests the connection with the endpoint and fingerprint on screen', async () => {
    let body: Record<string, unknown> | null = null
    serve([cluster()])
    server.use(http.post('*/v1/admin/clusters/test', async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>
      return HttpResponse.json({ ok: true, latencyMs: 24 })
    }))
    const user = userEvent.setup()
    renderWithProviders(<AdminClustersPage />)
    await waitFor(() => expect(screen.getByDisplayValue(PIN)).toBeInTheDocument())

    await user.clear(screen.getByLabelText('Endpoint'))
    await user.type(screen.getByLabelText('Endpoint'), 'https://edited:8443')
    await user.click(screen.getByRole('button', { name: 'Test connection' }))

    await waitFor(() => expect(screen.getByText(/Connected · 24ms/)).toBeInTheDocument())
    expect(body).toEqual({ endpoint: 'https://edited:8443', serverFingerprint: PIN })
  })

  it('shows the whole error when the cluster does not trust Titan', async () => {
    const error = `The cluster at https://incus-stub:8443 does not trust Titan: add Titan's client certificate (fingerprint ${TITAN_FINGERPRINT}) to its trust store.`
    serve([cluster()])
    server.use(http.post('*/v1/admin/clusters/test', () => HttpResponse.json({ ok: false, error })))
    const user = userEvent.setup()
    renderWithProviders(<AdminClustersPage />)
    await waitFor(() => expect(screen.getByDisplayValue(PIN)).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Test connection' }))

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(`Failed: ${error}`)
  })

  it('offers Delete only for a saved zone', async () => {
    serve([cluster(), notConfigured()])
    renderWithProviders(<AdminClustersPage />)

    const saved = await screen.findByRole('form', { name: 'Cluster mock' })
    const none = screen.getByRole('form', { name: 'Cluster eude01' })
    expect(within(saved).getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(within(none).getByText('Not configured')).toBeInTheDocument()
    expect(within(none).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('deletes a saved zone only after its cluster name is typed', async () => {
    let deletedZone: string | null = null
    serve([cluster()])
    server.use(http.delete('*/v1/admin/clusters/mock', () => {
      deletedZone = 'mock'
      return new HttpResponse(null, { status: 204 })
    }))
    const user = userEvent.setup()
    renderWithProviders(<AdminClustersPage />)
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    const confirm = screen.getByRole('button', { name: 'Delete connection' })
    expect(confirm).toBeDisabled()
    expect(screen.getByText(/has no cluster until one is saved again/)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Type the cluster name/i), 'incus-stub')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => expect(deletedZone).toBe('mock'))
  })

  // The list is read again after a delete; the form must show the zone as it now is, not the deleted values —
  // otherwise Save stays enabled and one click registers the deleted cluster again.
  it('clears the form once the deleted zone reads back as not configured', async () => {
    let deleted = false
    server.use(
      http.get('*/v1/admin/clusters', () =>
        HttpResponse.json([deleted ? cluster({ id: null, name: 'mock', endpoint: '', serverFingerprint: '', source: 'none', createdAt: null, updatedAt: null }) : cluster()])),
      http.get('*/v1/admin/clusters/client-certificate', () =>
        HttpResponse.json({ certificatePem: TITAN_PEM, fingerprint: TITAN_FINGERPRINT })),
      http.delete('*/v1/admin/clusters/mock', () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<AdminClustersPage />)
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await user.type(screen.getByLabelText(/Type the cluster name/i), 'incus-stub')
    await user.click(screen.getByRole('button', { name: 'Delete connection' }))

    await screen.findByText('Not configured')
    expect(screen.getByLabelText('Endpoint')).toHaveValue('')
    expect(screen.getByLabelText('Server fingerprint')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('renders in Vietnamese', async () => {
    serve([cluster(), notConfigured()])
    renderWithProviders(<AdminClustersPage />, { lang: 'vi' })

    expect(screen.getByRole('heading', { level: 1, name: 'Cluster' })).toBeInTheDocument()
    const block = await screen.findByRole('region', { name: 'Chứng chỉ client của Titan' })
    expect(await within(block).findByRole('button', { name: 'Sao chép chứng chỉ' })).toBeInTheDocument()
    const none = await screen.findByRole('form', { name: 'Cluster eude01' })
    expect(within(none).getByText('Chưa cấu hình')).toBeInTheDocument()
    expect(within(none).getByLabelText('Fingerprint máy chủ')).toBeInTheDocument()
    expect(within(none).getByRole('button', { name: 'Kiểm tra kết nối' })).toBeInTheDocument()
  })
})
