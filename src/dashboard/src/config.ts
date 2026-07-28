const DEFAULT_API_BASE_URL = 'https://unified-saas-pipeline.onrender.com'

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL
  const value =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : DEFAULT_API_BASE_URL

  return value.replace(/\/+$/, '')
}

export const API_BASE_URL = resolveApiBaseUrl()
