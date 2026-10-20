import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminAuthGate } from './AdminAuthGate'
import { FixedLanguage } from '@/test/FixedLanguage'
import { LanguageProvider } from '@/i18n/LanguageProvider'

function makeToken(roles: string[]): string {
  return `header.${btoa(JSON.stringify({ realm_access: { roles } }))}.sig`
}

const adminToken = makeToken(['platform-admin'])

vi.mock('react-oidc-context', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    signinRedirect: vi.fn(),
    user: { access_token: adminToken },
  })),
}))

describe('AdminAuthGate', () => {
  afterEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = 'en'
  })

  it('shows loading while auth is resolving and does not redirect', async () => {
    const { useAuth } = await import('react-oidc-context')
    const signinRedirect = vi.fn()
    vi.mocked(useAuth).mockReturnValueOnce({
      isAuthenticated: false,
      isLoading: true,
      signinRedirect,
    } as never)
    const { getByTestId } = render(<AdminAuthGate><div>secret</div></AdminAuthGate>)
    expect(getByTestId('admin-auth-loading')).toBeTruthy()
    expect(signinRedirect).not.toHaveBeenCalled()
  })

  it('redirects to Keycloak in the language the user saved', async () => {
    window.localStorage.setItem('ovc-lang', 'vi')
    const { useAuth } = await import('react-oidc-context')
    const signinRedirect = vi.fn()
    vi.mocked(useAuth).mockReturnValueOnce({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect,
    } as never)
    render(<AdminAuthGate><div>secret</div></AdminAuthGate>)
    await waitFor(() => expect(signinRedirect).toHaveBeenCalledWith({ ui_locales: 'vi' }))
    window.localStorage.clear()
  })

  it('redirects to Keycloak without a language when none is saved', async () => {
    window.localStorage.clear()
    const { useAuth } = await import('react-oidc-context')
    const signinRedirect = vi.fn()
    vi.mocked(useAuth).mockReturnValueOnce({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect,
    } as never)
    render(<AdminAuthGate><div>secret</div></AdminAuthGate>)
    await waitFor(() => expect(signinRedirect).toHaveBeenCalledWith({}))
  })

  it('redirects to Keycloak when not authenticated', async () => {
    const { useAuth } = await import('react-oidc-context')
    const signinRedirect = vi.fn()
    vi.mocked(useAuth).mockReturnValueOnce({
      isAuthenticated: false,
      isLoading: false,
      signinRedirect,
    } as never)
    render(<AdminAuthGate><div>secret</div></AdminAuthGate>)
    await waitFor(() => expect(signinRedirect).toHaveBeenCalled())
  })

  it('renders children when authenticated as platform-admin', () => {
    const { getByText } = render(<AdminAuthGate><div>secret</div></AdminAuthGate>)
    expect(getByText('secret')).toBeTruthy()
  })

  it('shows 403 when authenticated but not platform-admin (no children)', async () => {
    const { useAuth } = await import('react-oidc-context')
    vi.mocked(useAuth).mockReturnValueOnce({
      isAuthenticated: true,
      isLoading: false,
      signinRedirect: vi.fn(),
      user: { access_token: makeToken(['tenant-user']) },
    } as never)
    const { getByTestId, queryByText } = render(<AdminAuthGate><div>secret</div></AdminAuthGate>)
    expect(getByTestId('admin-forbidden')).toBeTruthy()
    expect(queryByText('secret')).toBeNull()
  })

  it('shows the 403 page in Vietnamese', async () => {
    const { useAuth } = await import('react-oidc-context')
    vi.mocked(useAuth).mockReturnValueOnce({
      isAuthenticated: true,
      isLoading: false,
      signinRedirect: vi.fn(),
      user: { access_token: makeToken(['tenant-user']) },
    } as never)
    const { getByText, queryByText } = render(
      <FixedLanguage lang="vi"><AdminAuthGate><div>secret</div></AdminAuthGate></FixedLanguage>,
    )
    expect(getByText('403 — Không có quyền truy cập')).toBeTruthy()
    expect(getByText('Tài khoản không có vai trò platform-admin.')).toBeTruthy()
    expect(queryByText('secret')).toBeNull()
  })

  it('lets the reader switch the 403 page to Vietnamese', async () => {
    const { useAuth } = await import('react-oidc-context')
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      signinRedirect: vi.fn(),
      user: { access_token: makeToken(['tenant-user']) },
    } as never)
    try {
      const { getByText, getByRole } = render(
        <LanguageProvider detectCountry={async () => null}><AdminAuthGate><div>secret</div></AdminAuthGate></LanguageProvider>,
      )
      expect(getByText('403 — Access denied')).toBeTruthy()
      await userEvent.click(getByRole('button', { name: 'Tiếng Việt' }))
      expect(getByText('403 — Không có quyền truy cập')).toBeTruthy()
    } finally {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true, isLoading: false, signinRedirect: vi.fn(), user: { access_token: adminToken },
      } as never)
    }
  })
})
