import type { CurrentUser } from '../types/tenant'

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=')
  return atob(padded)
}

export function parseUserFromToken(token: string): CurrentUser | null {
  try {
    const [, payload] = token.split('.')
    if (!payload) {
      return null
    }

    const claims = JSON.parse(decodeBase64Url(payload)) as Record<string, unknown>
    const username =
      (claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] as string | undefined) ??
      (claims.name as string | undefined) ??
      ''
    const email =
      (claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] as string | undefined) ??
      (claims.email as string | undefined) ??
      ''
    const role =
      (claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] as string | undefined) ??
      (claims.role as string | undefined) ??
      'User'
    const id =
      (claims['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] as string | undefined) ??
      (claims.sub as string | undefined) ??
      ''

    if (!username && !id) {
      return null
    }

    return {
      id,
      username,
      email,
      role,
    }
  } catch {
    return null
  }
}
