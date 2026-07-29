export interface CurrentUser {
  id: string
  username: string
  email: string
  role: string
}

export interface TenantSettings {
  tenantId: string
  tenantName: string
  slug: string
  createdAt: string
  status: string
  primaryColor: string | null
  logoUrl: string | null
}

export interface LoginResponse {
  token: string
  tenantId: string
  tenantStatus?: string
  message?: string | null
}

export interface RegisterTenantRequest {
  tenantName: string
  adminUsername: string
  adminEmail: string
  adminPassword: string
}

export interface RegisterResponse {
  token: string
  tenantId: string
  message: string
}

export interface UpdateTenantSettingsRequest {
  tenantName?: string
  status?: string
  primaryColor?: string | null
  logoUrl?: string | null
}

export interface MetricsResponse {
  totalCustomers: number
  totalSubscriptions: number
  statuses: Array<{ status: string; count: number }>
}

export function isTenantDisabled(status?: string | null): boolean {
  if (!status) {
    return false
  }
  const normalized = status.toLowerCase()
  return normalized === 'inactive' || normalized === 'suspended'
}
