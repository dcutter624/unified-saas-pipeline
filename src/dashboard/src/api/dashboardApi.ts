import { apiClient } from './client'
import type {
  LoginResponse,
  MetricsResponse,
  RegisterResponse,
  RegisterTenantRequest,
  TenantSettings,
  UpdateTenantSettingsRequest,
} from '../types/tenant'

export interface Subscription {
  id: string
  tenantId: string
  customerId: string
  status: string
  tier: string
  startDate: string
  endDate: string | null
  createdAt: string
}

export interface Customer {
  id: string
  tenantId: string
  email: string
  name: string
  createdAt: string
  subscriptions?: Subscription[]
}

export interface Tenant {
  id: string
  name: string
  slug: string
  createdAt: string
  customers: Customer[]
  subscriptions: Subscription[]
}

export async function loginRequest(username: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>(
    '/api/auth/login',
    { username, password },
    { skipAuthRedirect: true, skipErrorToast: true },
  )
  return data
}

export async function registerTenantRequest(
  payload: RegisterTenantRequest,
): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>('/api/auth/register', payload, {
    skipAuthRedirect: true,
    skipErrorToast: true,
  })
  return data
}

export async function fetchTenantSettings(): Promise<TenantSettings> {
  const { data } = await apiClient.get<TenantSettings>('/api/tenant/settings')
  return data
}

export async function updateTenantSettingsRequest(
  payload: UpdateTenantSettingsRequest,
): Promise<TenantSettings> {
  const { data } = await apiClient.put<TenantSettings>('/api/tenant/settings', payload)
  return data
}

export async function fetchTenants(): Promise<Tenant[]> {
  const { data } = await apiClient.get<Tenant[]>('/api/tenants')
  return data
}

export async function fetchMetrics(): Promise<MetricsResponse> {
  const { data } = await apiClient.get<MetricsResponse>('/api/metrics')
  return data
}

export interface DashboardResponse {
  id: string
  name: string
  slug: string
  customerCount: number
  subscriptionCount: number
  customers: Customer[]
  subscriptions: Subscription[]
}

export async function fetchDashboard(): Promise<DashboardResponse> {
  const { data } = await apiClient.get<DashboardResponse>('/api/dashboard')
  return data
}

export async function createCustomerRequest(payload: {
  name: string
  email: string
  tier?: string
}): Promise<void> {
  await apiClient.post('/api/data', payload, { skipErrorToast: true })
}

export async function updateSubscriptionStatusRequest(
  subscriptionId: string,
  status: string,
): Promise<void> {
  await apiClient.patch(
    `/api/subscriptions/${subscriptionId}/status`,
    { status },
    { skipErrorToast: true },
  )
}
