/**
 * LocalLedger AI - Runtime Configuration & Local Privacy Sentinel
 *
 * Distinguishes between:
 * 1. 'local_dev': Running on local machine (localhost / 127.0.0.1 / Vite dev / test)
 * 2. 'public_unconnected': Running on a public website (e.g. Render) without an active local companion
 * 3. 'companion_connected': Running on a public website with a verified, user-connected local companion
 *
 * CRITICAL PRIVACY ARCHITECTURE:
 * On public deployments, no requests are EVER silently sent to visitor's localhost.
 */

export type RuntimeMode = 'local_dev' | 'public_unconnected' | 'companion_connected'

export interface RuntimeConfig {
  mode: RuntimeMode
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

/**
 * Checks if the current execution context is local development or automated testing.
 */
export function isLocalEnvironment(): boolean {
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
 * Normalizes user-entered companion API URLs (e.g. adds protocol, strips trailing slash, appends /api/v1 if missing).
 */
export function normalizeApiUrl(rawUrl: string): string {
  let trimmed = rawUrl.trim()
  if (!trimmed) return ''

  // Prepend http:// if protocol omitted
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `http://${trimmed}`
  }

  // Remove trailing slashes
  trimmed = trimmed.replace(/\/+$/, '')

  // If user passed root host without /api/v1, append it
  if (!trimmed.endsWith('/api/v1')) {
    if (trimmed.endsWith('/api')) {
      trimmed = `${trimmed}/v1`
    } else {
      trimmed = `${trimmed}/api/v1`
    }
  }

  return trimmed
}

/**
 * Retrieves the stored companion URL from localStorage if available.
 */
export function getStoredCompanionUrl(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  return window.localStorage.getItem(COMPANION_STORAGE_KEY)
}

/**
 * Saves companion URL to localStorage.
 */
export function setStoredCompanionUrl(url: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (url) {
    window.localStorage.setItem(COMPANION_STORAGE_KEY, normalizeApiUrl(url))
  } else {
    window.localStorage.removeItem(COMPANION_STORAGE_KEY)
  }
}

/**
 * Determines the current runtime mode.
 */
export function determineRuntimeMode(overrideCompanionUrl?: string | null): RuntimeMode {
  if (isLocalEnvironment()) {
    return 'local_dev'
  }

  const activeCompanion =
    overrideCompanionUrl !== undefined ? overrideCompanionUrl : getStoredCompanionUrl()

  if (activeCompanion) {
    return 'companion_connected'
  }

  return 'public_unconnected'
}

/**
 * Resolves the effective API base URL.
 * - In local development: defaults to VITE_API_BASE_URL or 'http://127.0.0.1:8000/api/v1'.
 * - On public website: returns stored companion URL only if connected, otherwise NULL.
 */
export function getEffectiveApiBase(overrideCompanionUrl?: string | null): string | null {
  if (isLocalEnvironment()) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL
    }
    return DEFAULT_LOCAL_API_BASE
  }

  const activeCompanion =
    overrideCompanionUrl !== undefined ? overrideCompanionUrl : getStoredCompanionUrl()

  if (activeCompanion) {
    return normalizeApiUrl(activeCompanion)
  }

  return null
}
