import { apiClient } from './client'

export interface AuditLogItem {
  id: string
  tenantId: string
  userId: string | null
  username: string
  action: string
  entityName: string
  entityId: string | null
  timestamp: string
  ipAddress: string | null
}

export interface PagedAuditLogsResponse {
  items: AuditLogItem[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export async function fetchAuditLogs(params?: {
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}): Promise<PagedAuditLogsResponse> {
  const { data } = await apiClient.get<PagedAuditLogsResponse>('/api/tenant/audit-logs', {
    params: {
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 25,
      sortBy: params?.sortBy ?? 'timestamp',
      sortDir: params?.sortDir ?? 'desc',
    },
  })
  return data
}
