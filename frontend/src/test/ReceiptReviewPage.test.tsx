import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ReceiptReviewPage } from '../features/receipts/ReceiptReviewPage'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    getDocumentReview: vi.fn(),
    confirmReceipt: vi.fn(),
    getDocumentFileUrl: vi.fn().mockReturnValue('http://127.0.0.1:8000/api/v1/documents/doc-1/file'),
  },
}))

describe('ReceiptReviewPage', () => {
  it('renders extracted fields and allows manual modification', async () => {
    vi.mocked(api.getDocumentReview).mockResolvedValueOnce({
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
        category: 'Meals & Entertainment',
        payment_method: 'Credit Card',
        notes: null,
      },
      suggestions: {
        merchant: { value: 'Coffee Corner', confidence: 0.9, source: 'ai', is_inferred: false },
        total: { value: 11.0, confidence: 0.95, source: 'ai', is_inferred: false },
      },
      ocr_text_preview: 'COFFEE CORNER\nTOTAL $11.00',
      warnings: [],
      ollama_used: true,
      model_name: 'qwen2.5:3b',
    })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/review/doc-1']}>
          <Routes>
            <Route path="/review/:documentId" element={<ReceiptReviewPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )

    // Verify fields populated
    const merchantInput = (await screen.findByDisplayValue('Coffee Corner')) as HTMLInputElement
    expect(merchantInput).toBeInTheDocument()

    // Test manual editing
    fireEvent.change(merchantInput, { target: { value: 'Coffee Corner Roasters' } })
    expect(merchantInput.value).toBe('Coffee Corner Roasters')

    // Confirm button present
    const confirmBtn = screen.getByRole('button', { name: /Confirm & Save Transaction/i })
    expect(confirmBtn).toBeInTheDocument()
  })
})
