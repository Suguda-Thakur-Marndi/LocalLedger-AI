import type {
  ConfirmReceiptRequest,
  DashboardSummary,
  DocumentUploadResponse,
  PaginatedTransactions,
  ReceiptReviewPayload,
  SystemStatus,
  Transaction,
} from '../types'
import {
  CompanionRequiredError,
  getEffectiveApiBase,
  normalizeApiUrl,
} from './runtimeConfig'

export { CompanionRequiredError }

export interface ConnectionTestResult {
  success: boolean
  data?: any
  error?: string
  errorType?: 'mixed_content' | 'cors_network' | 'http_error' | 'timeout' | 'invalid_url'
  url?: string
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiBase = getEffectiveApiBase()

  if (!apiBase) {
    throw new CompanionRequiredError(
      'Receipt processing and local ledger actions require an active LocalLedger companion connection.'
    )
  }

  const url = `${apiBase}${endpoint}`
  const headers = new Headers(options.headers || {})

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`
    try {
      const errJson = await res.json()
      if (errJson.error?.message) {
        errorDetail = errJson.error.message
      } else if (errJson.detail) {
        errorDetail = errJson.detail
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail)
  }

  if (res.status === 204) {
    return {} as T
  }

  return res.json()
}

/**
 * Explicit connection checker for local companion.
 * Safe: only checks `/health`, never transmits any receipt or confidential data.
 */
export async function testCompanionConnection(candidateUrl: string): Promise<ConnectionTestResult> {
  const normalized = normalizeApiUrl(candidateUrl)
  if (!normalized) {
    return {
      success: false,
      error: 'Please enter a valid companion URL (e.g. http://127.0.0.1:8000/api/v1).',
      errorType: 'invalid_url',
    }
  }

  // Detect HTTPS -> HTTP Mixed Content block in browser
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    normalized.startsWith('http://')
  ) {
    return {
      success: false,
      url: normalized,
      errorType: 'mixed_content',
      error:
        'Browser Mixed Content Restriction: Modern browsers block public HTTPS websites from connecting to plaintext HTTP on localhost. To use LocalLedger AI with complete privacy, please run LocalLedger locally or access via HTTP.',
    }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 6000)

  try {
    const healthUrl = `${normalized}/health`
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!res.ok) {
      return {
        success: false,
        url: normalized,
        errorType: 'http_error',
        error: `Local companion responded with status ${res.status}: ${res.statusText}`,
      }
    }

    const data = await res.json()
    return {
      success: true,
      url: normalized,
      data,
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        url: normalized,
        errorType: 'timeout',
        error:
          'Connection timed out after 6 seconds. Please ensure the LocalLedger backend server is running.',
      }
    }

    const errorMsg =
      err.message === 'Failed to fetch'
        ? 'Unable to reach local companion. Check that your local backend server is running on 127.0.0.1:8000.'
        : err.message ||
          'Unable to reach local companion. Check that your local backend server is running on 127.0.0.1:8000.'

    return {
      success: false,
      url: normalized,
      errorType: 'cors_network',
      error: errorMsg,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export const api = {
  // Base URL inspection
  getBaseUrl: (): string | null => getEffectiveApiBase(),
  testConnection: testCompanionConnection,

  // Health
  getHealth: () => request<any>('/health'),

  // Documents
  uploadDocument: async (file: File): Promise<DocumentUploadResponse> => {
    const formData = new FormData()
    formData.append('file', file)
    return request<DocumentUploadResponse>('/documents/upload', {
      method: 'POST',
      body: formData,
    })
  },

  getDocumentReview: (documentId: string): Promise<ReceiptReviewPayload> => {
    return request<ReceiptReviewPayload>(`/documents/${documentId}/review`)
  },

  reextractDocument: (documentId: string): Promise<ReceiptReviewPayload> => {
    return request<ReceiptReviewPayload>(`/documents/${documentId}/reextract`, {
      method: 'POST',
    })
  },

  getDocumentFileUrl: (documentId: string): string => {
    const base = getEffectiveApiBase()
    return base ? `${base}/documents/${documentId}/file` : ''
  },

  // Receipts
  confirmReceipt: (payload: ConfirmReceiptRequest): Promise<Transaction> => {
    return request<Transaction>('/receipts/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  // Transactions
  getTransactions: (
    params: {
      search?: string
      category?: string
      currency?: string
      review_status?: string
      start_date?: string
      end_date?: string
      sort_by?: string
      sort_order?: string
      page?: number
      page_size?: number
    } = {}
  ): Promise<PaginatedTransactions> => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val))
      }
    })
    const query = searchParams.toString()
    return request<PaginatedTransactions>(`/transactions${query ? `?${query}` : ''}`)
  },

  getTransaction: (id: string): Promise<Transaction> => {
    return request<Transaction>(`/transactions/${id}`)
  },

  createTransaction: (data: Partial<Transaction>): Promise<Transaction> => {
    return request<Transaction>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateTransaction: (id: string, data: Partial<Transaction>): Promise<Transaction> => {
    return request<Transaction>(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteTransaction: (id: string): Promise<void> => {
    return request<void>(`/transactions/${id}`, {
      method: 'DELETE',
    })
  },

  // Reports
  getDashboardSummary: (startDate?: string, endDate?: string): Promise<DashboardSummary> => {
    const params = new URLSearchParams()
    if (startDate) params.append('start_date', startDate)
    if (endDate) params.append('end_date', endDate)
    const query = params.toString()
    return request<DashboardSummary>(`/reports/dashboard${query ? `?${query}` : ''}`)
  },

  getExportCsvUrl: (
    params: {
      startDate?: string
      endDate?: string
      category?: string
      currency?: string
    } = {}
  ): string => {
    const base = getEffectiveApiBase()
    if (!base) return ''
    const searchParams = new URLSearchParams()
    if (params.startDate) searchParams.append('start_date', params.startDate)
    if (params.endDate) searchParams.append('end_date', params.endDate)
    if (params.category) searchParams.append('category', params.category)
    if (params.currency) searchParams.append('currency', params.currency)
    const query = searchParams.toString()
    return `${base}/reports/export${query ? `?${query}` : ''}`
  },

  // Settings
  getSystemStatus: (): Promise<SystemStatus> => {
    return request<SystemStatus>('/settings/status')
  },

  checkOllama: (): Promise<any> => {
    return request<any>('/settings/check-ollama', {
      method: 'POST',
    })
  },

  getBackupExportUrl: (): string => {
    const base = getEffectiveApiBase()
    return base ? `${base}/settings/export-backup` : ''
  },

  downloadBackupZip: async (): Promise<{ filename: string; blob: Blob }> => {
    const base = getEffectiveApiBase()
    if (!base) {
      throw new CompanionRequiredError(
        'Downloading a vault backup requires an active local companion connection.'
      )
    }

    const url = `${base}/settings/export-backup`
    const res = await fetch(url)
    if (!res.ok) {
      let errorDetail = `Backup export failed with status ${res.status}`
      try {
        const errJson = await res.json()
        if (errJson.error?.message) {
          errorDetail = errJson.error.message
        } else if (errJson.detail) {
          errorDetail = errJson.detail
        }
      } catch {
        // ignore
      }
      throw new Error(errorDetail)
    }

    const contentType = res.headers.get('content-type') || ''
    if (
      !contentType.includes('application/zip') &&
      !contentType.includes('application/octet-stream')
    ) {
      throw new Error(`Unexpected server response type: ${contentType}. Expected ZIP archive.`)
    }

    let filename = res.headers.get('X-Archive-Filename')
    if (!filename) {
      const disposition = res.headers.get('Content-Disposition')
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";]+)"?/)
        if (match && match[1]) {
          filename = match[1]
        }
      }
    }
    if (!filename) {
      filename = `localledger_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`
    }

    const blob = await res.blob()
    return { filename, blob }
  },

  deleteAllData: (confirmText: string): Promise<any> => {
    return request<any>('/settings/delete-all', {
      method: 'POST',
      body: JSON.stringify({ confirm_text: confirmText }),
    })
  },
}
