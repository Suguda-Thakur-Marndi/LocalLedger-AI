/**
 * LocalLedger AI - Runtime Configuration & Local Privacy Sentinel
 *
 * Distinguishes between:
 * 1. 'local_dev': Running on local machine (localhost / 127.0.0.1 / Vite dev / test)
 * 2. 'public_unconnected': Running on a public website (e.g. Render) without an active local companion
 * 3. 'companion_connected': Running on a public website with a verified, user-connected local companion
 *
 * Connection lifecycle states:
 * - 'disconnected': No companion configured or connected
 * - 'saved': A companion URL is saved in settings, but has not completed a verified health check in this session
 * - 'connecting': Live health check is actively in progress
 * - 'connected': Successful live health check verified against /health
 * - 'error': Live health check failed (unreachable, timeout, mixed content, or HTTP error)
 *
 * CRITICAL PRIVACY ARCHITECTURE:
 * On public deployments, no requests are EVER silently sent to visitor's localhost.
 * A companion is ONLY reported as connected after an explicit, successful health check.
 */

export type RuntimeMode = 'local_dev' | 'public_unconnected' | 'companion_connected'
export type CompanionStatus = 'disconnected' | 'saved' | 'connecting' | 'connected' | 'error'

export interface RuntimeConfig {
  mode: RuntimeMode
  status: CompanionStatus
  apiBaseUrl: string | null
  isLocal: boolean
  isConnected: boolean
  companionUrl: string | null
}

export class CompanionRequiredError extends Error {
  constructor(
    message = 'LocalLedger Companion is required for this action. Please connect your local companion to proceed.'
  ) {
    super(message)
    this.name = 'CompanionRequiredError'
  }
}

export const COMPANION_STORAGE_KEY = 'localledger_companion_url'
export const DEFAULT_LOCAL_API_BASE = 'http://127.0.0.1:8000/api/v1'

// In-memory session tracking of verified active companion URL
let _activeVerifiedCompanionUrl: string | null = null

export function getActiveVerifiedCompanionUrl(): string | null {
  return _activeVerifiedCompanionUrl
}

export function setActiveVerifiedCompanionUrl(url: string | null): void {
  if (url) {
    const normalized = normalizeApiUrl(url)
    _activeVerifiedCompanionUrl = normalized || null
  } else {
    _activeVerifiedCompanionUrl = null
  }
}

/**
 * Checks whether a given hostname is a local loopback origin.
 */
export function isLocalHostname(hostname: string): boolean {
  if (!hostname) return false
  const lower = hostname.toLowerCase()
  return (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '[::1]' ||
    lower === '::1' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local')
  )
}

let _localEnvOverride: boolean | null = null

export function setLocalEnvironmentOverride(override: boolean | null): void {
  _localEnvOverride = override
}

/**
 * Checks if the current execution context is local development or automated testing.
 */
export function isLocalEnvironment(): boolean {
  if (_localEnvOverride !== null) {
    return _localEnvOverride
  }

  // If in Vitest / Jest test runner
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.MODE === 'test') {
      return true
    }
    // If in Vite dev server (npm run dev)
    if (import.meta.env.DEV) {
      return true
    }
  }

  // If in browser, inspect window location hostname
  if (typeof window !== 'undefined' && window.location) {
    return isLocalHostname(window.location.hostname)
  }

  return false
}

/**
 * Validates whether a candidate string is a well-formed HTTP/HTTPS URL.
 */
export function isValidApiUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  const trimmed = rawUrl.trim()
  if (!trimmed) return false

  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false
    }
    if (!parsed.hostname || parsed.hostname === 'undefined' || parsed.hostname.includes(' ')) {
      return false
    }
    return true
  } catch {
    return false
  }
}

/**
 * Normalizes user-entered companion API URLs:
 * - Prepends http:// if protocol is omitted
 * - Strips trailing slashes
 * - Strips /health if user typed full health endpoint
 * - Ensures /api/v1 suffix
 * - Returns empty string for invalid URLs
 */
export function normalizeApiUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return ''
  let trimmed = rawUrl.trim()
  if (!trimmed) return ''

  if (!isValidApiUrl(trimmed)) {
    return ''
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`
  }

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return ''
    }

    let pathname = parsed.pathname.replace(/\/+$/, '')

    // Strip trailing /health if present
    if (pathname.endsWith('/health')) {
      pathname = pathname.substring(0, pathname.length - '/health'.length).replace(/\/+$/, '')
    }

    // Ensure /api/v1 suffix
    if (pathname.endsWith('/api/v1')) {
      // already normalized
    } else if (pathname.endsWith('/api')) {
      pathname = `${pathname}/v1`
    } else if (pathname === '' || pathname === '/') {
      pathname = '/api/v1'
    } else {
      pathname = `${pathname}/api/v1`
    }

    return `${parsed.protocol}//${parsed.host}${pathname}`
  } catch {
    return ''
  }
}

/**
 * Retrieves the stored companion URL from localStorage if available and valid.
 * Automatically cleans up invalid or corrupted entries.
 */
export function getStoredCompanionUrl(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const stored = window.localStorage.getItem(COMPANION_STORAGE_KEY)
    if (!stored) return null
    const normalized = normalizeApiUrl(stored)
    if (!normalized) {
      window.localStorage.removeItem(COMPANION_STORAGE_KEY)
      return null
    }
    return normalized
  } catch {
    return null
  }
}

/**
 * Saves companion URL to localStorage.
 */
export function setStoredCompanionUrl(url: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    if (url) {
      const normalized = normalizeApiUrl(url)
      if (normalized) {
        window.localStorage.setItem(COMPANION_STORAGE_KEY, normalized)
      } else {
        window.localStorage.removeItem(COMPANION_STORAGE_KEY)
      }
    } else {
      window.localStorage.removeItem(COMPANION_STORAGE_KEY)
    }
  } catch {
    // ignore storage quota / sandbox errors
  }
}

/**
 * Determines the current runtime mode.
 * On a public website, a companion is ONLY connected if explicitly verified.
 */
export function determineRuntimeMode(
  overrideConnectedUrl?: string | null,
  isVerified?: boolean
): RuntimeMode {
  if (isLocalEnvironment()) {
    return 'local_dev'
  }

  if (overrideConnectedUrl !== undefined) {
    const verified = isVerified !== undefined ? isVerified : Boolean(overrideConnectedUrl)
    if (verified && overrideConnectedUrl && normalizeApiUrl(overrideConnectedUrl)) {
      return 'companion_connected'
    }
    return 'public_unconnected'
  }

  if (_activeVerifiedCompanionUrl) {
    return 'companion_connected'
  }

  return 'public_unconnected'
}

/**
 * Resolves the effective API base URL.
 * - In local development: defaults to VITE_API_BASE_URL or 'http://127.0.0.1:8000/api/v1'.
 * - On public website: returns verified companion URL ONLY if connected, otherwise NULL.
 * - Stored but unverified URLs ALWAYS return NULL to prevent silent localhost traffic.
 */
export function getEffectiveApiBase(
  overrideUrl?: string | null,
  isVerified?: boolean
): string | null {
  if (isLocalEnvironment()) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL
    }
    return DEFAULT_LOCAL_API_BASE
  }

  if (overrideUrl !== undefined) {
    const verified = isVerified !== undefined ? isVerified : Boolean(overrideUrl)
    if (verified && overrideUrl) {
      return normalizeApiUrl(overrideUrl) || null
    }
    return null
  }

  if (_activeVerifiedCompanionUrl) {
    return _activeVerifiedCompanionUrl
  }

  return null
}
