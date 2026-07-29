import { apiClient } from './client'

export type AnalyticsPeriod = '30d' | '6m' | '12m'

export interface AnalyticsKpis {
  totalMrr: number
  arpu: number
  churnRate: number
  inactivePercentage: number
  activeCustomers: number
  totalCustomers: number
  activeSubscriptions: number
  totalSubscriptions: number
  mrrTrendPercent: number | null
  customerTrendPercent: number | null
}

export interface StatusDistributionItem {
  status: string
  count: number
}

export interface AnalyticsSeriesPoint {
  bucket: string
  label: string
  mrr: number
  newCustomers: number
  cumulativeCustomers: number
  activeSubscriptions: number
}

export interface AnalyticsSummaryResponse {
  period: AnalyticsPeriod | string
  generatedAtUtc: string
  rangeStartUtc: string
  rangeEndUtc: string
  kpis: AnalyticsKpis
  statusDistribution: StatusDistributionItem[]
  series: AnalyticsSeriesPoint[]
}

export async function fetchAnalyticsSummary(
  period: AnalyticsPeriod = '6m',
): Promise<AnalyticsSummaryResponse> {
  const { data } = await apiClient.get<AnalyticsSummaryResponse>('/api/analytics/summary', {
    params: { period },
  })
  return data
}
