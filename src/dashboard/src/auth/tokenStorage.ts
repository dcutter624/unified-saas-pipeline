const TOKEN_KEY = 'usp_token'
const TENANT_KEY = 'usp_tenantId'

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredTenantId(): string | null {
  try {
    return localStorage.getItem(TENANT_KEY)
  } catch {
    return null
  }
}

export function persistAuth(token: string, tenantId: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TENANT_KEY, tenantId)
}

export function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TENANT_KEY)
}
