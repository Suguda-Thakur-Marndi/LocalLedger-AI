import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { ReceiptReviewPage } from '../features/receipts/ReceiptReviewPage'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    getDocumentReview: vi.fn(),
    confirmReceipt: vi.fn(),
    reextractDocument: vi.fn(),
    getDocumentFileUrl: vi.fn().mockImplementation((id: string) => `http://127.0.0.1:8000/api/v1/documents/${id}/file`),
  },
}))

const mockDoc1 = {
  document_id: 'doc-1',
  original_filename: 'coffee.pdf',
  mime_type: 'application/pdf',
  processing_status: 'extracted',
  extracted: {
    merchant: 'Coffee Corner',
    invoice_number: 'INV-123',
    transaction_date: '2026-03-20',
    subtotal: '10.00',
    tax: '1.00',
    total: '11.00',
    currency: 'USD',
    category: 'Software & Subscriptions',
    payment_method: 'Credit Card',
    notes: 'Morning coffee',
  },
  suggestions: {
    merchant: { value: 'Coffee Corner', confidence: 0.9, source: 'ai' as const, is_inferred: false },
    total: { value: 11.0, confidence: 0.95, source: 'ai' as const, is_inferred: false },
  },
  ocr_text_preview: 'COFFEE CORNER\nTOTAL $11.00',
  warnings: [],
  ollama_used: true,
  model_name: 'llama3.2-vision:11b',
}

const mockDoc2 = {
  document_id: 'doc-2',
  original_filename: 'books.pdf',
  mime_type: 'application/pdf',
  processing_status: 'extracted',
  extracted: {
    merchant: 'City Bookstore',
    invoice_number: 'INV-999',
    transaction_date: '2026-03-21',
    subtotal: '40.00',
    tax: '5.00',
    total: '45.00',
    currency: 'USD',
    category: 'Office Supplies & Stationery',
    payment_method: 'Debit Card',
    notes: 'Reference books',
  },
  suggestions: {},
  ocr_text_preview: 'CITY BOOKSTORE\nTOTAL $45.00',
  warnings: [],
  ollama_used: false,
}

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })

describe('ReceiptReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('populates all initial extracted fields correctly from review data', async () => {
    vi.mocked(api.getDocumentReview).mockResolvedValueOnce(mockDoc1)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/review/doc-1']}>
          <Routes>
            <Route path="/review/:documentId" element={<ReceiptReviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    const merchantInput = (await screen.findByLabelText(/Merchant Name \*/i)) as HTMLInputElement
    expect(merchantInput).toBeInTheDocument()
    expect(merchantInput.value).toBe('Coffee Corner')

    const invoiceInput = screen.getByLabelText(/Invoice \/ Receipt #/i) as HTMLInputElement
    expect(invoiceInput.value).toBe('INV-123')

    const dateInput = screen.getByLabelText(/Transaction Date \*/i) as HTMLInputElement
    expect(dateInput.value).toBe('2026-03-20')

    const currencySelect = screen.getByLabelText(/Currency \*/i) as HTMLSelectElement
    expect(currencySelect.value).toBe('USD')

    const subtotalInput = screen.getByLabelText(/^Subtotal$/i) as HTMLInputElement
    expect(subtotalInput.value).toBe('10.00')

    const taxInput = screen.getByLabelText(/Tax \/ VAT/i) as HTMLInputElement
    expect(taxInput.value).toBe('1.00')

    const totalInput = screen.getByLabelText(/Calculated Total Paid \*/i) as HTMLInputElement
    expect(totalInput.value).toBe('11.00')

    const categorySelect = screen.getByLabelText(/Expense Category/i) as HTMLSelectElement
    expect(categorySelect.value).toBe('Software & Subscriptions')

    const paymentInput = screen.getByLabelText(/Payment Account/i) as HTMLInputElement
    expect(paymentInput.value).toBe('Credit Card')

    const notesInput = screen.getByLabelText(/Auditor Notes/i) as HTMLTextAreaElement
    expect(notesInput.value).toBe('Morning coffee')
  })

  it('preserves user edits and submits modified values on save', async () => {
    vi.mocked(api.getDocumentReview).mockResolvedValueOnce(mockDoc1)
    vi.mocked(api.confirmReceipt).mockResolvedValueOnce({
      id: 'tx-1',
      merchant: 'Coffee Corner Roasters',
      transaction_date: '2026-03-20',
      subtotal: '10.00',
      tax: '1.00',
      total: '15.50',
      currency: 'USD',
      category: 'Software & Subscriptions',
      payment_method: 'Credit Card',
      notes: 'Updated note for tax audit',
      original_filename: 'coffee.pdf',
      document_content_hash: 'abc',
      review_status: 'confirmed',
      created_at: '2026-03-20',
      updated_at: '2026-03-20',
    })
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/review/doc-1']}>
          <Routes>
            <Route path="/review/:documentId" element={<ReceiptReviewPage />} />
            <Route path="/transactions" element={<div>Transactions</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    const merchantInput = (await screen.findByLabelText(/Merchant Name \*/i)) as HTMLInputElement
    fireEvent.change(merchantInput, { target: { value: 'Coffee Corner Roasters' } })
    expect(merchantInput.value).toBe('Coffee Corner Roasters')

    const totalInput = screen.getByLabelText(/Calculated Total Paid \*/i) as HTMLInputElement
    fireEvent.change(totalInput, { target: { value: '15.50' } })
    expect(totalInput.value).toBe('15.50')

    const notesInput = screen.getByLabelText(/Auditor Notes/i) as HTMLTextAreaElement
    fireEvent.change(notesInput, { target: { value: 'Updated note for tax audit' } })
    expect(notesInput.value).toBe('Updated note for tax audit')

    const saveButtons = screen.getAllByRole('button', { name: /Save Transaction/i })
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(api.confirmReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 'doc-1',
          merchant: 'Coffee Corner Roasters',
          total: 15.5,
          notes: 'Updated note for tax audit',
        })
      )
    })
  })

  it('prevents stale receipt data when switching between receipts', async () => {
    vi.mocked(api.getDocumentReview).mockImplementation(async (id: string) => {
      if (id === 'doc-1') return mockDoc1
      if (id === 'doc-2') return mockDoc2
      throw new Error('Not found')
    })
    const queryClient = createTestQueryClient()

    const SwitcherComponent = () => {
      const navigate = useNavigate()
      return (
        <div>
          <button onClick={() => navigate('/review/doc-2')}>Switch to Doc 2</button>
        </div>
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/review/doc-1']}>
          <SwitcherComponent />
          <Routes>
            <Route path="/review/:documentId" element={<ReceiptReviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Verify doc-1 loaded
    const merchantInput1 = (await screen.findByLabelText(/Merchant Name \*/i)) as HTMLInputElement
    expect(merchantInput1.value).toBe('Coffee Corner')

    // Modify doc-1 form state
    fireEvent.change(merchantInput1, { target: { value: 'User Modified Merchant 1' } })
    expect(merchantInput1.value).toBe('User Modified Merchant 1')

    // Switch to doc-2
    fireEvent.click(screen.getByRole('button', { name: /Switch to Doc 2/i }))

    // Wait for doc-2 data to appear
    const merchantInput2 = (await screen.findByDisplayValue('City Bookstore')) as HTMLInputElement
    expect(merchantInput2).toBeInTheDocument()
    expect(merchantInput2.value).toBe('City Bookstore')

    // Confirm no stale values from doc-1 remain
    expect(screen.queryByDisplayValue('Coffee Corner')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('User Modified Merchant 1')).not.toBeInTheDocument()

    const totalInput = screen.getByLabelText(/Calculated Total Paid \*/i) as HTMLInputElement
    expect(totalInput.value).toBe('45.00')

    const notesInput = screen.getByLabelText(/Auditor Notes/i) as HTMLTextAreaElement
    expect(notesInput.value).toBe('Reference books')
  })

  it('re-extracts receipt and updates form with freshly extracted values', async () => {
    vi.mocked(api.getDocumentReview).mockResolvedValueOnce(mockDoc1)
    const reextractedDoc = {
      ...mockDoc1,
      extracted: {
        ...mockDoc1.extracted,
        merchant: 'Coffee Corner Specialty Cafe',
        total: '18.75',
      },
    }
    vi.mocked(api.reextractDocument).mockResolvedValueOnce(reextractedDoc)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/review/doc-1']}>
          <Routes>
            <Route path="/review/:documentId" element={<ReceiptReviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    const merchantInput = (await screen.findByDisplayValue('Coffee Corner')) as HTMLInputElement
    expect(merchantInput.value).toBe('Coffee Corner')

    // Click retry extraction
    const retryBtn = screen.getByRole('button', { name: /Retry Extraction/i })
    fireEvent.click(retryBtn)

    // Form should re-initialize with the reextracted values
    await waitFor(() => {
      expect(api.reextractDocument).toHaveBeenCalledWith('doc-1')
      expect(screen.getByDisplayValue('Coffee Corner Specialty Cafe')).toBeInTheDocument()
      expect(screen.getByDisplayValue('18.75')).toBeInTheDocument()
    })
  })

  it('shows validation errors and prevents save when required fields are missing', async () => {
    vi.mocked(api.getDocumentReview).mockResolvedValueOnce(mockDoc1)
    const queryClient = createTestQueryClient()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/review/doc-1']}>
          <Routes>
            <Route path="/review/:documentId" element={<ReceiptReviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    const merchantInput = (await screen.findByLabelText(/Merchant Name \*/i)) as HTMLInputElement
    fireEvent.change(merchantInput, { target: { value: '' } })

    const saveButtons = screen.getAllByRole('button', { name: /Save Transaction/i })
    fireEvent.click(saveButtons[0])

    expect(await screen.findByText('Merchant name is required')).toBeInTheDocument()
    expect(api.confirmReceipt).not.toHaveBeenCalled()
  })
})
