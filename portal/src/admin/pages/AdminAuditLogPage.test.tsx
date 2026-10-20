import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/renderWithProviders'
import { AdminAuditLogPage } from './AdminAuditLogPage'

const entry = (o = {}) => ({
  id: 'a1',
  action: 'vm.delete.cross_tenant',
  actor: 'admin-test',
  resourceType: 'vm',
  resourceId: '11111111-1111-1111-1111-111111111111',
  ownerTenantId: '22222222-2222-2222-2222-222222222222',
  createdAt: '2026-08-20T10:30:00Z',
  ...o,
})

describe('AdminAuditLogPage', () => {
  it('shows empty state when there are no audit entries', async () => {
    server.use(http.get('*/v1/admin/audit-log', () => HttpResponse.json([])))
    renderWithProviders(<AdminAuditLogPage />)
    await waitFor(() => expect(screen.getByText(/no admin actions recorded/i)).toBeInTheDocument())
  })

  it('renders real audit rows (action, actor, resource, owner tenant)', async () => {
    server.use(http.get('*/v1/admin/audit-log', () => HttpResponse.json([entry()])))
    renderWithProviders(<AdminAuditLogPage />)
    await waitFor(() => expect(screen.getByText('vm.delete.cross_tenant')).toBeInTheDocument())
    expect(screen.getByText('admin-test')).toBeInTheDocument()
    expect(screen.getByText(/vm · 11111111-1111-1111-1111-111111111111/)).toBeInTheDocument()
    expect(screen.getByText('22222222-2222-2222-2222-222222222222')).toBeInTheDocument()
  })

  it('renders in Vietnamese: heading, table headers and the platform owner label', async () => {
    server.use(http.get('*/v1/admin/audit-log', () =>
      HttpResponse.json([entry({ ownerTenantId: '00000000-0000-0000-0000-000000000000' })])))
    renderWithProviders(<AdminAuditLogPage />, { lang: 'vi' })
    await waitFor(() => expect(screen.getByText('vm.delete.cross_tenant')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Nhật ký quản trị' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Người thực hiện' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Tenant sở hữu' })).toBeInTheDocument()
    expect(screen.getByText('Nền tảng')).toBeInTheDocument()
  })
})
