import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DashboardPage } from '../features/dashboard/DashboardPage'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    getDashboardSummary: vi.fn(),
  },
}))

describe('DashboardPage', () => {
  it('renders empty state when no transactions exist', async () => {
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

    expect(await screen.findByText(/No Transactions Recorded Yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Upload Your First Document/i)).toBeInTheDocument()
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

    expect(await screen.findByText('Acme Cafe')).toBeInTheDocument()
    expect(screen.getByText('Meals & Entertainment')).toBeInTheDocument()
    expect(screen.getByText(/Total Spend \(USD\)/i)).toBeInTheDocument()
  })
})
