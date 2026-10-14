import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isLocalHostname,
  isLocalEnvironment,
  isValidApiUrl,
  normalizeApiUrl,
  determineRuntimeMode,
  getEffectiveApiBase,
  CompanionRequiredError,
  setStoredCompanionUrl,
  getStoredCompanionUrl,
  setActiveVerifiedCompanionUrl,
  getActiveVerifiedCompanionUrl,
  DEFAULT_LOCAL_API_BASE,
  COMPANION_STORAGE_KEY,
} from '../lib/runtimeConfig'

describe('runtimeConfig', () => {
  beforeEach(() => {
    localStorage.clear()
    setActiveVerifiedCompanionUrl(null)
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    setActiveVerifiedCompanionUrl(null)
    vi.restoreAllMocks()
  })

  describe('isLocalHostname', () => {
    it('recognizes loopback and local hostnames', () => {
      expect(isLocalHostname('localhost')).toBe(true)
      expect(isLocalHostname('127.0.0.1')).toBe(true)
      expect(isLocalHostname('::1')).toBe(true)
      expect(isLocalHostname('[::1]')).toBe(true)
      expect(isLocalHostname('app.localhost')).toBe(true)
      expect(isLocalHostname('device.local')).toBe(true)
    })

    it('rejects external public hostnames', () => {
      expect(isLocalHostname('localledger.onrender.com')).toBe(false)
      expect(isLocalHostname('render.com')).toBe(false)
      expect(isLocalHostname('example.com')).toBe(false)
      expect(isLocalHostname('')).toBe(false)
    })
  })

  describe('isValidApiUrl', () => {
    it('validates well-formed HTTP and HTTPS URLs', () => {
      expect(isValidApiUrl('http://127.0.0.1:8000')).toBe(true)
      expect(isValidApiUrl('https://companion.internal/api/v1')).toBe(true)
      expect(isValidApiUrl('localhost:8000')).toBe(true)
    })

    it('rejects malformed or invalid URLs', () => {
      expect(isValidApiUrl('')).toBe(false)
      expect(isValidApiUrl('   ')).toBe(false)
      expect(isValidApiUrl('javascript:alert(1)')).toBe(false)
      expect(isValidApiUrl('undefined')).toBe(false)
      expect(isValidApiUrl('invalid ::: syntax')).toBe(false)
    })
  })

  describe('normalizeApiUrl', () => {
    it('normalizes base URLs without protocol or api paths', () => {
      expect(normalizeApiUrl('127.0.0.1:8000')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('http://127.0.0.1:8000')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('http://127.0.0.1:8000/')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('http://127.0.0.1:8000/api')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('http://127.0.0.1:8000/api/v1/')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('https://my-companion.local/api/v1')).toBe('https://my-companion.local/api/v1')
    })

    it('strips redundant /health suffix if entered by user', () => {
      expect(normalizeApiUrl('http://127.0.0.1:8000/api/v1/health')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('http://127.0.0.1:8000/health')).toBe('http://127.0.0.1:8000/api/v1')
    })

    it('returns empty string for invalid URLs', () => {
      expect(normalizeApiUrl('')).toBe('')
      expect(normalizeApiUrl('   ')).toBe('')
      expect(normalizeApiUrl('javascript:alert(1)')).toBe('')
      expect(normalizeApiUrl('invalid :// url')).toBe('')
    })
  })

  describe('Storage of Companion URL', () => {
    it('saves and clears stored companion url in localStorage', () => {
      expect(getStoredCompanionUrl()).toBeNull()
      setStoredCompanionUrl('http://127.0.0.1:8000')
      expect(getStoredCompanionUrl()).toBe('http://127.0.0.1:8000/api/v1')

      setStoredCompanionUrl(null)
      expect(getStoredCompanionUrl()).toBeNull()
    })

    it('safely handles and cleans corrupted or malformed stored values', () => {
      localStorage.setItem(COMPANION_STORAGE_KEY, 'corrupted ::: malformed')
      expect(getStoredCompanionUrl()).toBeNull()
      // Verifies malformed item was removed from localStorage
      expect(localStorage.getItem(COMPANION_STORAGE_KEY)).toBeNull()
    })
  })

  describe('Local Development vs Public Website Modes', () => {
    it('identifies local development environment and defaults to local API base', () => {
      expect(isLocalEnvironment()).toBe(true)
      expect(determineRuntimeMode()).toBe('local_dev')
      expect(getEffectiveApiBase()).toBe(DEFAULT_LOCAL_API_BASE)
    })

    it('on a public website with no saved URL: returns public_unconnected and null base', () => {
      // Force non-local environment
      const originalDev = import.meta.env.DEV
      const originalMode = import.meta.env.MODE
      try {
        (import.meta.env as any).DEV = false;
        (import.meta.env as any).MODE = 'production';

        const originalLocation = window.location
        Object.defineProperty(window, 'location', {
          value: new URL('https://localledger.onrender.com'),
          writable: true,
          configurable: true,
        })

        expect(isLocalEnvironment()).toBe(false)
        expect(determineRuntimeMode()).toBe('public_unconnected')
        expect(getEffectiveApiBase()).toBeNull()

        Object.defineProperty(window, 'location', {
          value: originalLocation,
          writable: true,
          configurable: true,
        })
      } finally {
        (import.meta.env as any).DEV = originalDev;
        (import.meta.env as any).MODE = originalMode;
      }
    })

    it('on a public website with saved but unverified URL: does NOT report connected and returns null base', () => {
      const originalDev = import.meta.env.DEV
      const originalMode = import.meta.env.MODE
      try {
        (import.meta.env as any).DEV = false;
        (import.meta.env as any).MODE = 'production';

        const originalLocation = window.location
        Object.defineProperty(window, 'location', {
          value: new URL('https://localledger.onrender.com'),
          writable: true,
          configurable: true,
        })

        // Storing a companion URL in localStorage
        setStoredCompanionUrl('http://127.0.0.1:8000')

        // Privacy sentinel check: A stored URL without verified session health check MUST NOT be connected!
        expect(determineRuntimeMode()).toBe('public_unconnected')
        expect(getEffectiveApiBase()).toBeNull()

        Object.defineProperty(window, 'location', {
          value: originalLocation,
          writable: true,
          configurable: true,
        })
      } finally {
        (import.meta.env as any).DEV = originalDev;
        (import.meta.env as any).MODE = originalMode;
      }
    })

    it('on a public website after successful verification: reports companion_connected and returns effective base', () => {
      const originalDev = import.meta.env.DEV
      const originalMode = import.meta.env.MODE
      try {
        (import.meta.env as any).DEV = false;
        (import.meta.env as any).MODE = 'production';

        const originalLocation = window.location
        Object.defineProperty(window, 'location', {
          value: new URL('https://localledger.onrender.com'),
          writable: true,
          configurable: true,
        })

        // Verify companion in session
        setActiveVerifiedCompanionUrl('http://127.0.0.1:8000')

        expect(getActiveVerifiedCompanionUrl()).toBe('http://127.0.0.1:8000/api/v1')
        expect(determineRuntimeMode()).toBe('companion_connected')
        expect(getEffectiveApiBase()).toBe('http://127.0.0.1:8000/api/v1')

        Object.defineProperty(window, 'location', {
          value: originalLocation,
          writable: true,
          configurable: true,
        })
      } finally {
        (import.meta.env as any).DEV = originalDev;
        (import.meta.env as any).MODE = originalMode;
      }
    })
  })

  describe('CompanionRequiredError', () => {
    it('constructs CompanionRequiredError with informative message', () => {
      const err = new CompanionRequiredError()
      expect(err.name).toBe('CompanionRequiredError')
      expect(err.message).toContain('LocalLedger Companion is required')
    })
  })
})
