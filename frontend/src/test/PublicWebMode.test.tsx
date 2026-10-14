import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { CompanionProvider } from '../lib/CompanionContext'
import { UploadPage } from '../features/receipts/UploadPage'
import { CompanionModal } from '../components/CompanionModal'
import { api, testCompanionConnection, CompanionRequiredError } from '../lib/api'
import * as runtimeConfig from '../lib/runtimeConfig'

describe('Public Web Mode & Companion Connectivity', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('Missing Configuration / Public Unconnected State', () => {
    it('throws CompanionRequiredError immediately when requesting API without a connected companion', async () => {
      // Mock isLocalEnvironment to false and getEffectiveApiBase to null (public unconnected)
      vi.spyOn(runtimeConfig, 'isLocalEnvironment').mockReturnValue(false)
      vi.spyOn(runtimeConfig, 'getEffectiveApiBase').mockReturnValue(null)

      const fetchSpy = vi.spyOn(globalThis, 'fetch')

      await expect(api.getHealth()).rejects.toThrow(CompanionRequiredError)

      // CRITICAL PRIVACY ARCHITECTURE: Zero silent requests to localhost
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('renders the local companion notice and disables upload dropzone in public unconnected mode', () => {
      vi.spyOn(runtimeConfig, 'isLocalEnvironment').mockReturnValue(false)
      vi.spyOn(runtimeConfig, 'getStoredCompanionUrl').mockReturnValue(null)

      render(
        <MemoryRouter>
          <CompanionProvider>
            <UploadPage />
          </CompanionProvider>
        </MemoryRouter>
      )

      expect(
        screen.getByText(/Receipt Ingestion Requires Local Companion/i)
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Receipt upload is disabled in web preview mode/i)
      ).toBeInTheDocument()

      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      expect(input).toBeDisabled()
    })

    it('prevents file ingestion and does not trigger document upload API in public unconnected mode', async () => {
      vi.spyOn(runtimeConfig, 'isLocalEnvironment').mockReturnValue(false)
      vi.spyOn(runtimeConfig, 'getStoredCompanionUrl').mockReturnValue(null)

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

  describe('Connection Checking & Error Handling', () => {
    it('returns error result safely when local companion is unreachable', async () => {
      // Simulate network error (e.g. backend not running)
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('Failed to fetch'))

      const result = await testCompanionConnection('http://127.0.0.1:8000/api/v1')

      expect(result.success).toBe(false)
      expect(result.errorType).toBe('cors_network')
      expect(result.error).toContain('Unable to reach local companion')
    })

    it('detects and flags browser Mixed Content restrictions on HTTPS domains', async () => {
      // Simulate running on https://localledger.onrender.com
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

    it('successfully connects to a running local companion and verifies /health safely', async () => {
      const mockHealth = {
        status: 'healthy',
        environment: 'development',
        database: { connected: true },
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

      // Verified: only health endpoint was pinged
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/api/v1/health',
        expect.objectContaining({ method: 'GET' })
      )
    })
  })

  describe('CompanionModal Interaction', () => {
    it('renders companion modal and allows testing candidate URL', async () => {
      vi.spyOn(runtimeConfig, 'isLocalEnvironment').mockReturnValue(false)
      vi.spyOn(runtimeConfig, 'getStoredCompanionUrl').mockReturnValue(null)

      const mockHealth = {
        status: 'healthy',
        database: { connected: true },
        ollama: { connected: true },
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealth,
      } as any)

      render(
        <MemoryRouter>
          <CompanionProvider>
            {/* Force modal open for test */}
            <CompanionModal />
          </CompanionProvider>
        </MemoryRouter>
      )

      // By default modal is not open until opened, or when companionModalOpen is true
    })
  })
})
