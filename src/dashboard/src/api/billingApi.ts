import { apiClient } from './client'

export interface PlanCatalogItem {
  tier: string
  monthlyPrice: number
  description: string
  features: string[]
  isCurrent: boolean
}

export interface BillingSubscription {
  tenantId: string
  tenantName: string
  subscriptionTier: string
  subscriptionStatus: string
  monthlyPrice: number
  currentPeriodEnd: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  features: Record<string, boolean>
  plans: PlanCatalogItem[]
}

export interface CheckoutSession {
  sessionId: string
  checkoutUrl: string
  tier: string
  mode: string
  message: string
}

export async function fetchBillingSubscription(): Promise<BillingSubscription> {
  const { data } = await apiClient.get<BillingSubscription>('/api/billing/subscription')
  return data
}

export async function createCheckoutSession(payload: {
  tier: string
  successUrl?: string
  cancelUrl?: string
}): Promise<CheckoutSession> {
  const { data } = await apiClient.post<CheckoutSession>('/api/billing/checkout-session', payload)
  return data
}

export async function postBillingWebhook(payload: {
  type: string
  data: {
    object: {
      id?: string
      customer?: string | null
      subscription?: string | null
      status?: string
      metadata?: Record<string, string>
      currentPeriodEnd?: number
    }
  }
}): Promise<BillingSubscription> {
  const { data } = await apiClient.post<BillingSubscription>('/api/billing/webhook', payload, {
    skipErrorToast: true,
  })
  return data
}

export async function exportAuditLogsCsv(): Promise<Blob> {
  const { data } = await apiClient.get<string>('/api/tenant/audit-logs/export', {
    responseType: 'text',
    skipErrorToast: true,
  })
  return new Blob([data], { type: 'text/csv;charset=utf-8' })
}
