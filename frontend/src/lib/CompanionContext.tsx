import React, { useState, useEffect, useCallback } from 'react'
import type { RuntimeMode } from './runtimeConfig'
import {
  getEffectiveApiBase,
  getStoredCompanionUrl,
  isLocalEnvironment,
  setStoredCompanionUrl,
} from './runtimeConfig'
import { testCompanionConnection } from './api'
import type { ConnectionTestResult } from './api'
import { CompanionContext } from './companionContextDef'

export const CompanionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isLocal = isLocalEnvironment()
  const [companionUrl, setCompanionUrl] = useState<string | null>(() => getStoredCompanionUrl())
  const [companionModalOpen, setCompanionModalOpen] = useState(false)

  // Runtime Mode
  const runtimeMode: RuntimeMode = isLocal
    ? 'local_dev'
    : companionUrl
    ? 'companion_connected'
    : 'public_unconnected'

  const isConnected = isLocal || runtimeMode === 'companion_connected'
  const isPublicUnconnected = !isLocal && runtimeMode === 'public_unconnected'
  const effectiveApiBase = getEffectiveApiBase(companionUrl)

  const openCompanionModal = useCallback(() => setCompanionModalOpen(true), [])
  const closeCompanionModal = useCallback(() => setCompanionModalOpen(false), [])

  const connectCompanion = useCallback(async (candidateUrl: string): Promise<ConnectionTestResult> => {
    const result = await testCompanionConnection(candidateUrl)
    if (result.success && result.url) {
      setStoredCompanionUrl(result.url)
      setCompanionUrl(result.url)
    }
    return result
  }, [])

  const disconnectCompanion = useCallback(() => {
    setStoredCompanionUrl(null)
    setCompanionUrl(null)
  }, [])

  // Sync with storage events across tabs if needed
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'localledger_companion_url') {
        setCompanionUrl(e.newValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  return (
    <CompanionContext.Provider
      value={{
        runtimeMode,
        isLocal,
        isConnected,
        isPublicUnconnected,
        companionUrl,
        effectiveApiBase,
        companionModalOpen,
        openCompanionModal,
        closeCompanionModal,
        connectCompanion,
        disconnectCompanion,
      }}
    >
      {children}
    </CompanionContext.Provider>
  )
}
