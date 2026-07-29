import type { CurrentUser, TenantSettings } from '../types/tenant'

const TOKEN_KEY = 'usp_token'
const TENANT_KEY = 'usp_tenantId'
const USER_KEY = 'usp_currentUser'
const SETTINGS_KEY = 'usp_tenantSettings'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return null
    }
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

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

export function getStoredUser(): CurrentUser | null {
  return readJson<CurrentUser>(USER_KEY)
}

export function getStoredSettings(): TenantSettings | null {
  return readJson<TenantSettings>(SETTINGS_KEY)
}

export function persistSession(
  token: string,
  tenantId: string,
  user: CurrentUser | null,
  settings: TenantSettings | null,
): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TENANT_KEY, tenantId)
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  }
  if (settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }
}

export function persistSettings(settings: TenantSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function clearAuthStorage(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TENANT_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(SETTINGS_KEY)
}
