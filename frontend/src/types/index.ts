export interface Transaction {
  id: string
  merchant: string
  invoice_number?: string | null
  transaction_date: string
  subtotal: string
  tax: string
  total: string
  currency: string
  category: string
  payment_method?: string | null
  notes?: string | null
  original_filename: string
  document_content_hash: string
  review_status: string
  created_at: string
  updated_at: string
}

export interface PaginatedTransactions {
  items: Transaction[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface DocumentUploadResponse {
  document_id: string
  original_filename: string
  mime_type: string
  file_size: number
  sha256_hash: string
  processing_status: string
  is_duplicate: boolean
  existing_transaction_id?: string | null
}

export interface FieldSuggestion {
  value: any
  confidence: number
  source: 'ai' | 'ocr_rules' | 'fallback' | 'manual'
  is_inferred: boolean
}

export interface LineItem {
  description: string
  quantity?: number | null
  total_amount?: number | null
}

export interface ReceiptReviewData {
  merchant?: string | null
  invoice_number?: string | null
  transaction_date?: string | null
  subtotal?: number | string | null
  tax?: number | string | null
  total?: number | string | null
  currency?: string | null
  category: string
  payment_method?: string | null
  notes?: string | null
  line_items?: LineItem[]
}

export interface ReceiptReviewPayload {
  document_id: string
  original_filename: string
  mime_type: string
  processing_status: string
  extracted: ReceiptReviewData
  suggestions: Record<string, FieldSuggestion>
  ocr_text_preview: string
  warnings: string[]
  ollama_used: boolean
  model_name?: string | null
}

export interface ConfirmReceiptRequest {
  document_id: string
  merchant: string
  invoice_number?: string | null
  transaction_date: string
  subtotal: number
  tax: number
  total: number
  currency: string
  category: string
  payment_method?: string | null
  notes?: string | null
}

export interface SpendingByCategory {
  category: string
  currency: string
  total_amount: string | number
  transaction_count: number
  percentage: number
}

export interface MonthlySpendTrend {
  month: string
  currency: string
  total_amount: string | number
  transaction_count: number
}

export interface WeeklySpendTrend {
  week: string
  week_start: string
  week_label: string
  currency: string
  total_amount: string | number
  transaction_count: number
}

export interface CurrencyTotal {
  currency: string
  total_amount: string | number
  transaction_count: number
  average_amount: string | number
}

export interface DashboardSummary {
  currency_totals: CurrencyTotal[]
  total_transactions: number
  total_receipts: number
  categories: SpendingByCategory[]
  monthly_trends: MonthlySpendTrend[]
  weekly_trends?: WeeklySpendTrend[]
  available_years?: number[]
  recent_transactions: Transaction[]
}

export interface SystemStatus {
  app_env: string
  ollama_connected: boolean
  ollama_model: string
  ollama_available_models: string[]
  ocr_engine_available: boolean
  ocr_engine_type: string
  storage_directory: string
  database_path: string
  total_documents: number
  total_transactions: number
  storage_size_bytes: number
  max_upload_size_mb: number
  max_pdf_pages: number
}
