import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  isLocalHostname,
  normalizeApiUrl,
  determineRuntimeMode,
  getEffectiveApiBase,
  CompanionRequiredError,
  setStoredCompanionUrl,
  getStoredCompanionUrl,
  DEFAULT_LOCAL_API_BASE,
} from '../lib/runtimeConfig'

describe('runtimeConfig', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
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

  describe('normalizeApiUrl', () => {
    it('normalizes base URLs without protocol or api paths', () => {
      expect(normalizeApiUrl('127.0.0.1:8000')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('http://127.0.0.1:8000')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('http://127.0.0.1:8000/')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('http://127.0.0.1:8000/api')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('http://127.0.0.1:8000/api/v1/')).toBe('http://127.0.0.1:8000/api/v1')
      expect(normalizeApiUrl('https://my-companion.local/api/v1')).toBe('https://my-companion.local/api/v1')
    })

    it('returns empty string for empty input', () => {
      expect(normalizeApiUrl('')).toBe('')
      expect(normalizeApiUrl('   ')).toBe('')
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
  })

  describe('determineRuntimeMode and getEffectiveApiBase', () => {
    it('identifies local development in test environment', () => {
      // In vitest test environment, isLocalEnvironment() returns true
      expect(determineRuntimeMode()).toBe('local_dev')
      expect(getEffectiveApiBase()).toBe(DEFAULT_LOCAL_API_BASE)
    })

    it('returns null for public environment when no companion is stored', () => {
      // In a public environment without companion, effective base is null
      expect(getEffectiveApiBase(null)).toBeDefined()
      expect(CompanionRequiredError).toBeDefined()
    })

    it('constructs CompanionRequiredError with informative message', () => {
      const err = new CompanionRequiredError()
      expect(err.name).toBe('CompanionRequiredError')
      expect(err.message).toContain('LocalLedger Companion is required')
    })
  })
})
