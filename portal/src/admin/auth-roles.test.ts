import { describe, expect, it } from 'vitest'
import { hasPlatformAdmin, decodeRealmRoles } from './auth-roles'

function makeToken(roles: string[]): string {
  const payload = btoa(JSON.stringify({ realm_access: { roles } }))
  return `header.${payload}.sig`
}

describe('auth-roles', () => {
  it('extracts realm roles from a valid access token', () => {
    expect(decodeRealmRoles(makeToken(['platform-admin', 'default-roles']))).toContain('platform-admin')
  })

  it('hasPlatformAdmin true when role present', () => {
    expect(hasPlatformAdmin(makeToken(['platform-admin']))).toBe(true)
  })

  it('hasPlatformAdmin false when role absent (fail-closed)', () => {
    expect(hasPlatformAdmin(makeToken(['tenant-user']))).toBe(false)
  })

  it('fail-closed on undefined / malformed token', () => {
    expect(hasPlatformAdmin(undefined)).toBe(false)
    expect(hasPlatformAdmin('not-a-jwt')).toBe(false)
    expect(hasPlatformAdmin('a.@@@.c')).toBe(false)
  })
})
