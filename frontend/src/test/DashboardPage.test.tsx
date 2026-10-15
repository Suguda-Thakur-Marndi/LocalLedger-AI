import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    getDashboardSummary: vi.fn(),
    getSystemStatus: vi.fn().mockResolvedValue({
      app_env: 'development',
      ollama_connected: true,
      ollama_model: 'llama3.2-vision:11b',
      ollama_available_models: ['llama3.2-vision:11b'],
      ocr_engine_available: true,
      ocr_engine_type: 'pymupdf',
      storage_directory: 'data/documents',
      database_path: 'data/db/localledger.db',
      total_documents: 2,
      total_transactions: 2,
      storage_size_bytes: 2048,
      max_upload_size_mb: 25,
      max_pdf_pages: 10,
    }),
    getTransactions: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 5,
      total_pages: 1,
    }),
  },
}))

describe('DashboardPage', () => {
  it('renders greeting, status banner, and metric cards when empty', async () => {
    vi.mocked(api.getDashboardSummary).mockResolvedValueOnce({
      currency_totals: [],
      total_transactions: 0,
      total_receipts: 0,
      categories: [],
      monthly_trends: [],
      recent_transactions: [],
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Local Vault Dashboard/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Total Expenses/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Receipts Processed/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/No recent transactions recorded yet/i).length).toBeGreaterThan(0)
    // Verify no fake demo data is present
    expect(screen.queryByText(/OpenAI API Platform/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Apple Store Downtown/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\$4,820\.50/i)).not.toBeInTheDocument()
  })

  it('renders error state on API failure without displaying mock or fake data', async () => {
    vi.mocked(api.getDashboardSummary).mockRejectedValueOnce(
      new Error('Connection refused to 127.0.0.1:8000')
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText(/Failed to load dashboard metrics/i)).toBeInTheDocument()
    expect(screen.getByText(/Connection refused to 127\.0\.0\.1:8000/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()

    // Assert that mock/demo records are never silently rendered on error
    expect(screen.queryByText(/OpenAI API Platform/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Apple Store Downtown/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/\$4,820\.50/i)).not.toBeInTheDocument()
  })

  it('renders KPI metrics and recent transactions when data exists', async () => {
    vi.mocked(api.getDashboardSummary).mockResolvedValueOnce({
      currency_totals: [
        {
          currency: 'USD',
          total_amount: '250.00',
          transaction_count: 2,
          average_amount: '125.00',
        },
      ],
      total_transactions: 2,
      total_receipts: 2,
      categories: [
        {
          category: 'Meals & Entertainment',
          currency: 'USD',
          total_amount: '250.00',
          transaction_count: 2,
          percentage: 100,
        },
      ],
      monthly_trends: [
        {
          month: '2026-03',
          currency: 'USD',
          total_amount: '250.00',
          transaction_count: 2,
        },
      ],
      recent_transactions: [
        {
          id: 'tx-1',
          merchant: 'Acme Cafe',
          invoice_number: 'INV-101',
          transaction_date: '2026-03-15',
          subtotal: '200.00',
          tax: '50.00',
          total: '250.00',
          currency: 'USD',
          category: 'Meals & Entertainment',
          payment_method: 'Visa',
          notes: 'Team lunch',
          original_filename: 'receipt.pdf',
          document_content_hash: 'hash123',
          review_status: 'reviewed',
          created_at: '2026-03-15T12:00:00Z',
          updated_at: '2026-03-15T12:00:00Z',
        },
      ],
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    const acmeElements = await screen.findAllByText('Acme Cafe')
    expect(acmeElements.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Meals & Entertainment').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Total Expenses/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText('$250.00').length).toBeGreaterThan(0)
  })
})
