import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompanionProvider } from '../lib/CompanionContext'
import { AppLayout } from '../components/layout/AppLayout'
import { UploadPage } from '../features/receipts/UploadPage'
import { TransactionsPage } from '../features/transactions/TransactionsPage'
import { api } from '../lib/api'
import { setLocalEnvironmentOverride } from '../lib/runtimeConfig'

describe('Desktop Menus, Actions, and Keyboard Shortcuts Integration', () => {
  let menuActionCallback: ((action: string) => void) | null = null
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    setLocalEnvironmentOverride(true)
    menuActionCallback = null

    ;(window as any).desktopBridge = {
      getApiBaseUrl: () => 'http://127.0.0.1:8000/api/v1',
      getBackendPort: () => 8000,
      isDesktopApp: () => true,
      getAppVersion: () => '1.0.0',
      getPlatform: () => 'win32',
      onBackendStatus: vi.fn(() => () => {}),
      onMenuAction: vi.fn((cb: (action: string) => void) => {
        menuActionCallback = cb
        return () => {
          menuActionCallback = null
        }
      }),
      openDataFolder: vi.fn(),
      showAboutDialog: vi.fn(),
      triggerUploadDialog: vi.fn(),
    }

    vi.spyOn(api, 'getHealth').mockResolvedValue({
      status: 'healthy',
      database: 'connected',
      ollama: { connected: true, model_configured: 'qwen2.5:1.5b' },
      ocr: { available: true, engine: 'Tesseract OCR' },
    } as any)

    vi.spyOn(api, 'getTransactions').mockResolvedValue({
      items: [
        {
          id: 'tx-101',
          merchant: 'Acme Hardware',
          transaction_date: '2026-10-10',
          subtotal: '100.00',
          tax: '10.00',
          total: '110.00',
          currency: 'USD',
          category: 'Hardware & Equipment',
          original_filename: 'receipt_101.pdf',
          document_content_hash: 'hash101',
          review_status: 'reviewed',
          created_at: '2026-10-10T10:00:00Z',
          updated_at: '2026-10-10T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 15,
      total_pages: 1,
    })
  })

  afterEach(() => {
    setLocalEnvironmentOverride(null)
    delete (window as any).desktopBridge
    vi.restoreAllMocks()
  })

  it('subscribes to desktop bridge onMenuAction and handles "open-settings"', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CompanionProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<div>Dashboard Page</div>} />
                <Route path="settings" element={<div>Settings Target Page</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </CompanionProvider>
      </QueryClientProvider>
    )

    expect(screen.getByText('Dashboard Page')).toBeInTheDocument()
    expect((window as any).desktopBridge.onMenuAction).toHaveBeenCalled()

    // Simulate main process menu click File -> Settings
    menuActionCallback?.('open-settings')

    await waitFor(() => {
      expect(screen.getByText('Settings Target Page')).toBeInTheDocument()
    })
  })

  it('handles "open-help" menu action by displaying the Sovereign Guide help modal', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CompanionProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<div>Dashboard View</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </CompanionProvider>
      </QueryClientProvider>
    )

    menuActionCallback?.('open-help')

    await waitFor(() => {
      expect(screen.getByText(/LocalLedger AI Sovereign Guide/i)).toBeInTheDocument()
    })
  })

  it('navigates to upload on Ctrl+O / Cmd+O keyboard shortcut and dispatches file picker event', async () => {
    const pickerListener = vi.fn()
    window.addEventListener('localledger:open-file-picker', pickerListener)

    render(
      <QueryClientProvider client={queryClient}>
        <CompanionProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<div>Home</div>} />
                <Route path="upload" element={<div data-testid="upload-target">Upload Target Page</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </CompanionProvider>
      </QueryClientProvider>
    )

    // Trigger Ctrl+O
    fireEvent.keyDown(window, { key: 'o', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getByTestId('upload-target')).toBeInTheDocument()
      expect(pickerListener).toHaveBeenCalled()
    })

    window.removeEventListener('localledger:open-file-picker', pickerListener)
  })

  it('navigates to settings on Ctrl+, keyboard shortcut', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CompanionProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<div>Home</div>} />
                <Route path="settings" element={<div>Settings Page Opened via Ctrl Comma</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </CompanionProvider>
      </QueryClientProvider>
    )

    fireEvent.keyDown(window, { key: ',', ctrlKey: true })

    await waitFor(() => {
      expect(screen.getByText('Settings Page Opened via Ctrl Comma')).toBeInTheDocument()
    })
  })

  it('focuses search input when pressing Ctrl+K', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CompanionProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<div>Home</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </CompanionProvider>
      </QueryClientProvider>
    )

    const searchInput = screen.getByPlaceholderText(/Search receipts, vendors, amounts/i)
    expect(document.activeElement).not.toBe(searchInput)

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(document.activeElement).toBe(searchInput)
  })

  it('UploadPage enforces 25 MB limit and rejects oversized files', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CompanionProvider>
          <MemoryRouter initialEntries={['/upload']}>
            <Routes>
              <Route path="/upload" element={<UploadPage />} />
            </Routes>
          </MemoryRouter>
        </CompanionProvider>
      </QueryClientProvider>
    )

    const fileInput = document.getElementById('uploadFileInput') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()

    // Create a 26 MB dummy file
    const oversizedFile = new File(['x'.repeat(100)], 'huge_invoice.pdf', {
      type: 'application/pdf',
    })
    Object.defineProperty(oversizedFile, 'size', { value: 26 * 1024 * 1024 })

    fireEvent.change(fileInput, { target: { files: [oversizedFile] } })

    await waitFor(() => {
      expect(screen.getByText(/exceeds the 25 MB limit/i)).toBeInTheDocument()
    })
  })

  it('TransactionsPage initializes search filter from URL query parameter', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CompanionProvider>
          <MemoryRouter initialEntries={['/transactions?search=Acme']}>
            <Routes>
              <Route path="/transactions" element={<TransactionsPage />} />
            </Routes>
          </MemoryRouter>
        </CompanionProvider>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(api.getTransactions).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'Acme',
        })
      )
    })
  })

  it('renders interactive User Profile pill that displays Local Vault Owner', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <CompanionProvider>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<div>Home</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </CompanionProvider>
      </QueryClientProvider>
    )

    const profileBtn = screen.getByRole('button', { name: /Open Vault Settings/i })
    expect(profileBtn).toBeInTheDocument()
    expect(screen.getByText('Local Vault Owner')).toBeInTheDocument()
  })
})
