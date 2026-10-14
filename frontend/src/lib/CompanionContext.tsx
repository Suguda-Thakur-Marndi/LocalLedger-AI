import React, { useState, useEffect, useCallback } from 'react'
import type { RuntimeMode, CompanionStatus } from './runtimeConfig'
import {
  getEffectiveApiBase,
  getStoredCompanionUrl,
  isLocalEnvironment,
  isValidApiUrl,
  normalizeApiUrl,
  setActiveVerifiedCompanionUrl,
  setStoredCompanionUrl,
} from './runtimeConfig'
import { testCompanionConnection } from './api'
import type { ConnectionTestResult } from './api'
import { CompanionContext } from './companionContextDef'

export const CompanionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isLocal = isLocalEnvironment()
  const [savedUrl, setSavedUrl] = useState<string | null>(() => getStoredCompanionUrl())
  const [connectedUrl, setConnectedUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<CompanionStatus>(() => {
    if (isLocal) return 'connected'
    return getStoredCompanionUrl() ? 'saved' : 'disconnected'
  })
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastErrorType, setLastErrorType] = useState<string | null>(null)
  const [companionModalOpen, setCompanionModalOpen] = useState(false)

  // Runtime Mode: public deployments are NEVER 'companion_connected' unless verified in session
  const runtimeMode: RuntimeMode = isLocal
    ? 'local_dev'
    : status === 'connected' && connectedUrl
    ? 'companion_connected'
    : 'public_unconnected'

  const isConnected = isLocal || (status === 'connected' && Boolean(connectedUrl))
  const isPublicUnconnected = !isLocal && !isConnected
  const companionUrl = connectedUrl || savedUrl

  const effectiveApiBase = isLocal
    ? getEffectiveApiBase()
    : isConnected && connectedUrl
    ? connectedUrl
    : null

  // Keep in-memory verified URL in sync for callers outside React tree
  useEffect(() => {
    if (isConnected && connectedUrl) {
      setActiveVerifiedCompanionUrl(connectedUrl)
    } else {
      setActiveVerifiedCompanionUrl(null)
    }
  }, [isConnected, connectedUrl])

  const openCompanionModal = useCallback(() => setCompanionModalOpen(true), [])
  const closeCompanionModal = useCallback(() => setCompanionModalOpen(false), [])

  const connectCompanion = useCallback(async (candidateUrl: string): Promise<ConnectionTestResult> => {
    setStatus('connecting')
    setLastError(null)
    setLastErrorType(null)

    const result = await testCompanionConnection(candidateUrl)
    if (result.success && result.url) {
      setStoredCompanionUrl(result.url)
      setSavedUrl(result.url)
      setConnectedUrl(result.url)
      setActiveVerifiedCompanionUrl(result.url)
      setStatus('connected')
    } else {
      setConnectedUrl(null)
      setActiveVerifiedCompanionUrl(null)
      setStatus('error')
      setLastError(result.error || 'Connection failed')
      setLastErrorType(result.errorType || null)

      // Retain formatted candidate URL in storage if syntactically valid so user doesn't lose it
      if (candidateUrl && isValidApiUrl(candidateUrl)) {
        const normalized = normalizeApiUrl(candidateUrl)
        setStoredCompanionUrl(normalized)
        setSavedUrl(normalized)
      }
    }
    return result
  }, [])

  const disconnectCompanion = useCallback(() => {
    setStoredCompanionUrl(null)
    setSavedUrl(null)
    setConnectedUrl(null)
    setActiveVerifiedCompanionUrl(null)
    setStatus(isLocal ? 'connected' : 'disconnected')
    setLastError(null)
    setLastErrorType(null)
  }, [isLocal])

  // Synchronize with storage events across browser tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'localledger_companion_url') {
        const nextSaved = getStoredCompanionUrl()
        setSavedUrl(nextSaved)
        if (!nextSaved) {
          setConnectedUrl(null)
          setActiveVerifiedCompanionUrl(null)
          setStatus(isLocal ? 'connected' : 'disconnected')
        }
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [isLocal])

  return (
    <CompanionContext.Provider
      value={{
        runtimeMode,
        status,
        isLocal,
        isConnected,
        isPublicUnconnected,
        savedUrl,
        connectedUrl,
        companionUrl,
        effectiveApiBase,
        companionModalOpen,
        lastError,
        lastErrorType,
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
