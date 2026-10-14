import { useContext } from 'react'
import { CompanionContext } from './companionContextDef'
import type { CompanionContextType } from './companionContextDef'
import type { CompanionStatus } from './runtimeConfig'
import {
  getActiveVerifiedCompanionUrl,
  getEffectiveApiBase,
  getStoredCompanionUrl,
  isLocalEnvironment,
} from './runtimeConfig'
import { testCompanionConnection } from './api'

export function useCompanion(): CompanionContextType {
  const context = useContext(CompanionContext)
  if (!context) {
    // Graceful fallback for tests that might render a component directly
    const isLocal = isLocalEnvironment()
    const stored = getStoredCompanionUrl()
    const active = getActiveVerifiedCompanionUrl()
    const isConnected = isLocal || Boolean(active)
    const mode = isLocal
      ? 'local_dev'
      : active
      ? 'companion_connected'
      : 'public_unconnected'
    const status: CompanionStatus = isLocal
      ? 'connected'
      : active
      ? 'connected'
      : stored
      ? 'saved'
      : 'disconnected'

    return {
      runtimeMode: mode,
      status,
      isLocal,
      isConnected,
      isPublicUnconnected: !isLocal && !isConnected,
      savedUrl: stored,
      connectedUrl: active,
      companionUrl: active || stored,
      effectiveApiBase: getEffectiveApiBase(active, Boolean(active)),
      companionModalOpen: false,
      lastError: null,
      lastErrorType: null,
      openCompanionModal: () => {},
      closeCompanionModal: () => {},
      connectCompanion: async (url: string) => testCompanionConnection(url),
      disconnectCompanion: () => {},
    }
  }
  return context
}
