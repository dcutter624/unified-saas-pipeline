import { apiClient } from './client'

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

export interface LoginResponse {
  token: string
  tenantId: string
}

export interface MetricsResponse {
  totalCustomers: number
  totalSubscriptions: number
  statuses: Array<{ status: string; count: number }>
}

export async function loginRequest(username: string, password: string): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>(
    '/api/auth/login',
    { username, password },
    { skipAuthRedirect: true },
  )
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
