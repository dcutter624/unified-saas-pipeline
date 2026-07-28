const DEFAULT_API_BASE_URL = 'https://unified-saas-pipeline.onrender.com'

/**
 * Normalize env / pasted values into an absolute API origin.
 * Handles markdown links, brackets, quotes, and `https:/` typos that
 * otherwise make Axios resolve against the Vercel host (404).
 */
export function sanitizeApiBaseUrl(raw: string | undefined): string {
  let value = typeof raw === 'string' ? raw.trim() : ''

  if (!value) {
    return DEFAULT_API_BASE_URL
  }

  // Prefer the target URL from markdown: [label](https://example.com)
  const markdownLink = value.match(/\((https?:\/\/[^)\s]+)\)/i)
  if (markdownLink?.[1]) {
    value = markdownLink[1]
  }

  value = value
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/[\[\]\s]/g, '')
    .replace(/\/+$/, '')

  // Fix single-slash protocol typo: https:/host → https://host
  value = value.replace(/^(https?:\/)(?!\/)/i, '$1/')

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`
  }

  // Final pass: ensure protocol has exactly two slashes after the colon
  value = value.replace(/^(https?):\/+/i, '$1://')

  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return DEFAULT_API_BASE_URL
    }
    return `${url.protocol}//${url.host}`
  } catch {
    return DEFAULT_API_BASE_URL
  }
}

export const API_BASE_URL = sanitizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
