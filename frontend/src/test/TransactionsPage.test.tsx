import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
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
    vi.mocked(api.getTransactions).mockResolvedValue({
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
          category: 'Office Supplies & Stationery',
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

    const officeDepotItems = await screen.findAllByText('Office Depot')
    expect(officeDepotItems.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Office Supplies & Stationery').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$49.50').length).toBeGreaterThan(0)

    // Test delete modal trigger from either desktop table or mobile card
    const deleteBtns = screen.getAllByTitle('Delete Record')
    fireEvent.click(deleteBtns[0])

    expect(await screen.findByText(/Confirm Record Deletion/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Delete Transaction/i })).toBeInTheDocument()
  })
})
