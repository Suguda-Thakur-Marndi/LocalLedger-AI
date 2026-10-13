import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { UploadPage } from '../features/receipts/UploadPage'
import { api } from '../lib/api'

vi.mock('../lib/api', () => ({
  api: {
    uploadDocument: vi.fn(),
  },
}))

describe('UploadPage', () => {
  it('renders upload instructions and drag-and-drop prompt', () => {
    render(
      <MemoryRouter>
        <UploadPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/Click to browse or drag and drop receipts/i)).toBeInTheDocument()
    expect(screen.getByText(/Supports PDF, PNG, JPEG, and WebP/i)).toBeInTheDocument()
  })

  it('rejects unsupported file formats gracefully in the queue', async () => {
    render(
      <MemoryRouter>
        <UploadPage />
      </MemoryRouter>
    )

    const file = new File(['dummy content'], 'test.txt', { type: 'text/plain' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/Unsupported format/i)).toBeInTheDocument()
  })

  it('uploads valid PDF and shows ready for review badge', async () => {
    vi.mocked(api.uploadDocument).mockResolvedValueOnce({
      document_id: 'doc-123',
      original_filename: 'receipt.pdf',
      mime_type: 'application/pdf',
      file_size: 1024,
      sha256_hash: 'abcdef123456',
      processing_status: 'extracted',
      is_duplicate: false,
    })

    render(
      <MemoryRouter>
        <UploadPage />
      </MemoryRouter>
    )

    const file = new File(['%PDF-1.4'], 'receipt.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    expect(await screen.findByText(/Ready for Review/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Review/i })).toBeInTheDocument()
  })
})
