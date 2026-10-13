import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { TransactionsPage } from '../features/transactions/TransactionsPage'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    getTransactions: vi.fn(),
    deleteTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    getExportCsvUrl: vi.fn().mockReturnValue('/api/v1/reports/export'),
  },
}))

describe('TransactionsPage', () => {
  it('renders transactions table with actions and search', async () => {
    vi.mocked(api.getTransactions).mockResolvedValueOnce({
      items: [
        {
          id: 'tx-88',
          merchant: 'Office Depot',
          invoice_number: 'DEP-88',
          transaction_date: '2026-02-14',
          subtotal: '45.00',
          tax: '4.50',
          total: '49.50',
          currency: 'USD',
          category: 'Office Supplies',
          payment_method: 'Debit Card',
          notes: 'Printer ink',
          original_filename: 'receipt.pdf',
          document_content_hash: 'hash88',
          review_status: 'reviewed',
          created_at: '2026-02-14T10:00:00Z',
          updated_at: '2026-02-14T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 15,
      total_pages: 1,
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TransactionsPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText('Office Depot')).toBeInTheDocument()
    expect(screen.getAllByText('Office Supplies').length).toBeGreaterThan(0)
    expect(screen.getByText('$49.50')).toBeInTheDocument()

    // Test delete modal trigger
    const deleteBtn = screen.getByTitle('Delete transaction')
    fireEvent.click(deleteBtn)

    expect(await screen.findByText(/Delete Transaction\?/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirm Delete/i })).toBeInTheDocument()
  })
})
