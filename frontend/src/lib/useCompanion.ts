import { useContext } from 'react'
import { CompanionContext } from './companionContextDef'
import type { CompanionContextType } from './companionContextDef'
import {
  determineRuntimeMode,
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
    const mode = determineRuntimeMode(stored)
    return {
      runtimeMode: mode,
      isLocal,
      isConnected: isLocal || mode === 'companion_connected',
      isPublicUnconnected: !isLocal && mode === 'public_unconnected',
      companionUrl: stored,
      effectiveApiBase: getEffectiveApiBase(stored),
      companionModalOpen: false,
      openCompanionModal: () => {},
      closeCompanionModal: () => {},
      connectCompanion: async (url: string) => testCompanionConnection(url),
      disconnectCompanion: () => {},
    }
  }
  return context
}
