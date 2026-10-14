import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReportsPage } from '../features/reports/ReportsPage'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    getDashboardSummary: vi.fn(),
    getExportCsvUrl: vi.fn().mockReturnValue('/api/v1/reports/export.csv'),
  },
}))

describe('ReportsPage', () => {
  it('renders reports page header, export button, and redesigned monthly expenditure volume chart', async () => {
    vi.mocked(api.getDashboardSummary).mockResolvedValueOnce({
      currency_totals: [
        {
          currency: 'MYR',
          total_amount: '363.00',
          transaction_count: 2,
          average_amount: '181.50',
        },
      ],
      total_transactions: 2,
      total_receipts: 2,
      categories: [
        {
          category: 'Meals & Dining',
          currency: 'MYR',
          total_amount: '363.00',
          transaction_count: 2,
          percentage: 100,
        },
      ],
      monthly_trends: [
        {
          month: '2019-01',
          currency: 'MYR',
          total_amount: '363.00',
          transaction_count: 2,
        },
      ],
      recent_transactions: [],
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReportsPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText('Financial Reports')).toBeInTheDocument()
    expect(await screen.findByText('Monthly Expenditure Volume')).toBeInTheDocument()
    expect(screen.getByText('Export Filtered CSV')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /Monthly Expenditure Volume Chart/i })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: 'Monthly' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Quarterly' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Yearly' })).toBeInTheDocument()
    expect((await screen.findAllByText(/MYR\s*363\.00|RM\s*363\.00/i)).length).toBeGreaterThan(0)
  })
})
