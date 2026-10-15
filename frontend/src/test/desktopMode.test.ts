import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isDesktopEnvironment,
  isLocalEnvironment,
  getEffectiveApiBase,
  setLocalEnvironmentOverride,
} from '../lib/runtimeConfig'

describe('Desktop Environment Bridge & Dynamic Port Resolution', () => {
  beforeEach(() => {
    setLocalEnvironmentOverride(null)
    delete (window as any).desktopBridge
    vi.restoreAllMocks()
  })

  afterEach(() => {
    setLocalEnvironmentOverride(null)
    delete (window as any).desktopBridge
    vi.restoreAllMocks()
  })

  it('detects desktop environment when desktopBridge is injected by Electron preload', () => {
    expect(isDesktopEnvironment()).toBe(false)

    // Inject mock desktop bridge
    ;(window as any).desktopBridge = {
      getApiBaseUrl: () => 'http://127.0.0.1:8942/api/v1',
      getBackendPort: () => 8942,
      isDesktopApp: () => true,
    }

    expect(isDesktopEnvironment()).toBe(true)
    expect(isLocalEnvironment()).toBe(true)
  })

  it('dynamically resolves effective API base URL from desktopBridge', () => {
    ;(window as any).desktopBridge = {
      getApiBaseUrl: () => 'http://127.0.0.1:9234/api/v1',
      getBackendPort: () => 9234,
      isDesktopApp: () => true,
    }

    const effectiveBase = getEffectiveApiBase()
    expect(effectiveBase).toBe('http://127.0.0.1:9234/api/v1')
  })

  it('normalizes desktopBridge candidate URLs if port was given without prefix', () => {
    ;(window as any).desktopBridge = {
      getApiBaseUrl: () => '127.0.0.1:9500',
      getBackendPort: () => 9500,
      isDesktopApp: () => true,
    }

    const effectiveBase = getEffectiveApiBase()
    expect(effectiveBase).toBe('http://127.0.0.1:9500/api/v1')
  })
})
