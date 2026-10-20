import { useAuth } from 'react-oidc-context'
import { hasPlatformAdmin } from './auth-roles'
import { useT } from '@/i18n/LanguageContext'
import { browserStorage, signinArgs } from '@/i18n/lang'
import { LanguageSwitch } from '@/components/LanguageSwitch'

// Auth + role gate for the admin portal. Unlike the tenant portal's TenantProvider,
// it does NOT fetch /v1/tenant — an admin is not scoped to a tenant.
// The role check here is a UX gate only; the authoritative check stays server-side
// (every admin endpoint carries Roles("platform-admin")). Defense-in-depth.
export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const t = useT()

  if (auth.isLoading) {
    return (
      <div data-testid="admin-auth-loading" className="flex items-center justify-center h-screen text-muted-foreground text-sm">
        {t.common.loading}
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    auth.signinRedirect(signinArgs(browserStorage()))
    return null
  }

  if (!hasPlatformAdmin(auth.user?.access_token)) {
    return (
      <div
        data-testid="admin-forbidden"
        className="relative flex flex-col items-center justify-center h-screen gap-2 text-center bg-background text-foreground"
      >
        <LanguageSwitch className="absolute right-4 top-4" />
        <p className="text-lg font-semibold">{t.adminAuth.forbiddenTitle}</p>
        <p className="text-sm text-muted-foreground">{t.adminAuth.forbiddenDetail}</p>
      </div>
    )
  }

  return <>{children}</>
}
