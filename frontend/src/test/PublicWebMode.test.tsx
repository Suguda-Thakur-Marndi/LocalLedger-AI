import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CompanionProvider } from '../lib/CompanionContext'
import { useCompanion } from '../lib/useCompanion'
import { UploadPage } from '../features/receipts/UploadPage'
import { api, testCompanionConnection, CompanionRequiredError } from '../lib/api'
import * as runtimeConfig from '../lib/runtimeConfig'

// Helper component to inspect companion context state in tests
const TestStateInspector: React.FC = () => {
  const { runtimeMode, status, isConnected, isPublicUnconnected, effectiveApiBase, savedUrl, connectedUrl } =
    useCompanion()
  return (
    <div>
      <span data-testid="runtime-mode">{runtimeMode}</span>
      <span data-testid="companion-status">{status}</span>
      <span data-testid="is-connected">{String(isConnected)}</span>
      <span data-testid="is-public-unconnected">{String(isPublicUnconnected)}</span>
      <span data-testid="effective-api-base">{effectiveApiBase || 'null'}</span>
      <span data-testid="saved-url">{savedUrl || 'null'}</span>
      <span data-testid="connected-url">{connectedUrl || 'null'}</span>
    </div>
  )
}

describe('Public Web Mode & Companion Connectivity Flow', () => {
  beforeEach(() => {
    localStorage.clear()
    runtimeConfig.setLocalEnvironmentOverride(false)
    runtimeConfig.setActiveVerifiedCompanionUrl(null)
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    runtimeConfig.setLocalEnvironmentOverride(null)
    runtimeConfig.setActiveVerifiedCompanionUrl(null)
    vi.restoreAllMocks()
  })

  describe('Scenario 1: Public mode with no saved URL', () => {
    it('initializes as public_unconnected, status disconnected, and null effectiveApiBase', () => {
      render(
        <MemoryRouter>
          <CompanionProvider>
            <TestStateInspector />
          </CompanionProvider>
        </MemoryRouter>
      )

      expect(screen.getByTestId('runtime-mode')).toHaveTextContent('public_unconnected')
      expect(screen.getByTestId('companion-status')).toHaveTextContent('disconnected')
      expect(screen.getByTestId('is-connected')).toHaveTextContent('false')
      expect(screen.getByTestId('is-public-unconnected')).toHaveTextContent('true')
      expect(screen.getByTestId('effective-api-base')).toHaveTextContent('null')
    })

    it('rejects API requests with CompanionRequiredError without sending any fetch to localhost', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await expect(api.getHealth()).rejects.toThrow(CompanionRequiredError)
      await expect(api.getTransactions()).rejects.toThrow(CompanionRequiredError)

      // CRITICAL PRIVACY ARCHITECTURE: Zero silent requests to localhost
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('disables receipt upload UI and blocks upload actions in public unconnected mode', () => {
      render(
        <MemoryRouter>
          <CompanionProvider>
            <UploadPage />
          </CompanionProvider>
        </MemoryRouter>
      )

      expect(screen.getByText(/Receipt Ingestion Requires Local Companion/i)).toBeInTheDocument()
      expect(screen.getByText(/Receipt upload is disabled in web preview mode/i)).toBeInTheDocument()

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(input).toBeDisabled()
    })

    it('prevents file ingestion and does not trigger document upload API in public unconnected mode', async () => {
      const uploadSpy = vi.spyOn(api, 'uploadDocument')
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

      render(
        <MemoryRouter>
          <CompanionProvider>
            <UploadPage />
          </CompanionProvider>
        </MemoryRouter>
      )

      const file = new File(['dummy receipt content'], 'receipt.pdf', { type: 'application/pdf' })
      const input = document.querySelector('input[type="file"]') as HTMLInputElement

      fireEvent.change(input, { target: { files: [file] } })

      // api.uploadDocument should not be called
      expect(uploadSpy).not.toHaveBeenCalled()
      alertSpy.mockRestore()
    })
  })

  describe('Scenario 2: Public mode with saved-but-unreachable URL', () => {
    it('does NOT report connected merely because URL is stored; status is saved and base is null', () => {
      // Simulate stored URL in localStorage
      localStorage.setItem(runtimeConfig.COMPANION_STORAGE_KEY, 'http://127.0.0.1:8000/api/v1')

      render(
        <MemoryRouter>
          <CompanionProvider>
            <TestStateInspector />
          </CompanionProvider>
        </MemoryRouter>
      )

      // Privacy rule check: saved URL must not be reported as active connection!
      expect(screen.getByTestId('runtime-mode')).toHaveTextContent('public_unconnected')
      expect(screen.getByTestId('companion-status')).toHaveTextContent('saved')
      expect(screen.getByTestId('is-connected')).toHaveTextContent('false')
      expect(screen.getByTestId('is-public-unconnected')).toHaveTextContent('true')
      expect(screen.getByTestId('effective-api-base')).toHaveTextContent('null')
      expect(screen.getByTestId('saved-url')).toHaveTextContent('http://127.0.0.1:8000/api/v1')
      expect(screen.getByTestId('connected-url')).toHaveTextContent('null')
    })

    it('handles unreachable companion safely and reports informative error without throwing unhandled exceptions', async () => {
      // Simulate fetch failure (e.g. backend server not started)
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const result = await testCompanionConnection('http://127.0.0.1:8000')

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('cors_network')
      expect(result.error).toContain('Unable to reach local companion')
      expect(result.url).toBe('http://127.0.0.1:8000/api/v1')
    })
  })

  describe('Scenario 3: Public mode with successful companion connection', () => {
    it('reports connected only after successful live health check', async () => {
      const mockHealth = {
        status: 'healthy',
        database: 'connected',
        ollama: { connected: true, model_configured: 'qwen2.5:1.5b' },
      }

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealth,
      } as any)

      const result = await testCompanionConnection('http://127.0.0.1:8000')

      expect(result.success).toBe(true)
      expect(result.url).toBe('http://127.0.0.1:8000/api/v1')
      expect(result.data).toEqual(mockHealth)

      // Verifies pinged endpoint matches FastAPI versioned route
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/health',
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('updates CompanionProvider state to connected and enables effectiveApiBase upon connect', async () => {
      const mockHealth = {
        status: 'healthy',
        database: 'connected',
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealth,
      } as any)

      const TriggerComponent: React.FC = () => {
        const { connectCompanion } = useCompanion()
        return (
          <div>
            <TestStateInspector />
            <button
              data-testid="trigger-connect-btn"
              onClick={() => connectCompanion('http://127.0.0.1:8000')}
            >
              Connect
            </button>
          </div>
        )
      }

      render(
        <MemoryRouter>
          <CompanionProvider>
            <TriggerComponent />
          </CompanionProvider>
        </MemoryRouter>
      )

      expect(screen.getByTestId('is-connected')).toHaveTextContent('false')

      // Trigger connection via click
      await act(async () => {
        fireEvent.click(screen.getByTestId('trigger-connect-btn'))
      })

      await waitFor(() => {
        expect(screen.getByTestId('runtime-mode')).toHaveTextContent('companion_connected')
        expect(screen.getByTestId('companion-status')).toHaveTextContent('connected')
        expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
        expect(screen.getByTestId('effective-api-base')).toHaveTextContent('http://127.0.0.1:8000/api/v1')
      })
    })
  })

  describe('Scenario 4: Failed health check (HTTP non-200)', () => {
    it('returns http_error when backend health check returns 500 status', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any)

      const result = await testCompanionConnection('http://127.0.0.1:8000')

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('http_error')
      expect(result.error).toContain('responded with status 500: Internal Server Error')
    })
  })

  describe('Scenario 5: Connection timeout handling', () => {
    it('returns timeout error when companion does not respond in time and cleans up timer via try/finally', async () => {
      const abortError = new Error('The user aborted a request.')
      abortError.name = 'AbortError'

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      const result = await testCompanionConnection('http://127.0.0.1:8000')

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('timeout')
      expect(result.error).toContain('Connection timed out after 6 seconds')
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })
  })

  describe('Scenario 6: Local development mode', () => {
    it('identifies local development and provides default local API base', () => {
      // In local dev, isLocalEnvironment is true
      runtimeConfig.setLocalEnvironmentOverride(true)

      render(
        <MemoryRouter>
          <CompanionProvider>
            <TestStateInspector />
          </CompanionProvider>
        </MemoryRouter>
      )

      expect(screen.getByTestId('runtime-mode')).toHaveTextContent('local_dev')
      expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
      expect(screen.getByTestId('is-public-unconnected')).toHaveTextContent('false')
      expect(screen.getByTestId('effective-api-base')).toHaveTextContent(runtimeConfig.DEFAULT_LOCAL_API_BASE)
    })
  })

  describe('Browser Security Boundaries', () => {
    it('detects and warns about Mixed Content when testing http companion from https host', async () => {
      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        value: new URL('https://localledger.onrender.com'),
        writable: true,
        configurable: true,
      })

      const result = await testCompanionConnection('http://127.0.0.1:8000/api/v1')

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('mixed_content')
      expect(result.error).toContain('Browser Mixed Content Restriction')

      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true,
      })
    })
  })
})
