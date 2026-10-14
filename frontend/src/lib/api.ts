import type {
  ConfirmReceiptRequest,
  DashboardSummary,
  DocumentUploadResponse,
  PaginatedTransactions,
  ReceiptReviewPayload,
  SystemStatus,
  Transaction,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`
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

export const api = {
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
    return `${API_BASE}/documents/${documentId}/file`
  },

  // Receipts
  confirmReceipt: (payload: ConfirmReceiptRequest): Promise<Transaction> => {
    return request<Transaction>('/receipts/confirm', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  // Transactions
  getTransactions: (params: {
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
  } = {}): Promise<PaginatedTransactions> => {
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

  getExportCsvUrl: (params: { startDate?: string; endDate?: string; category?: string; currency?: string } = {}): string => {
    const searchParams = new URLSearchParams()
    if (params.startDate) searchParams.append('start_date', params.startDate)
    if (params.endDate) searchParams.append('end_date', params.endDate)
    if (params.category) searchParams.append('category', params.category)
    if (params.currency) searchParams.append('currency', params.currency)
    const query = searchParams.toString()
    return `${API_BASE}/reports/export${query ? `?${query}` : ''}`
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
    return `${API_BASE}/settings/export-backup`
  },

  downloadBackupZip: async (): Promise<{ filename: string; blob: Blob }> => {
    const url = `${API_BASE}/settings/export-backup`
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
    if (!contentType.includes('application/zip') && !contentType.includes('application/octet-stream')) {
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
