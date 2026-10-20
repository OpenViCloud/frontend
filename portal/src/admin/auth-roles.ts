export const PLATFORM_ADMIN_ROLE = 'platform-admin'

// Keycloak puts realm roles in the access token's realm_access.roles claim
// (not the id_token profile). Decode fail-closed: any parse issue → no roles.
export function decodeRealmRoles(accessToken: string | undefined): string[] {
  if (!accessToken) return []
  const parts = accessToken.split('.')
  if (parts.length < 2) return []
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(json)
    const roles = payload?.realm_access?.roles
    return Array.isArray(roles) ? roles : []
  } catch {
    return []
  }
}

export function hasPlatformAdmin(accessToken: string | undefined): boolean {
  return decodeRealmRoles(accessToken).includes(PLATFORM_ADMIN_ROLE)
}
