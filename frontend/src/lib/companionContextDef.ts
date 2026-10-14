import { createContext } from 'react'
import type { RuntimeMode, CompanionStatus } from './runtimeConfig'
import type { ConnectionTestResult } from './api'

export interface CompanionContextType {
  runtimeMode: RuntimeMode
  status: CompanionStatus
  isLocal: boolean
  isConnected: boolean
  isPublicUnconnected: boolean
  savedUrl: string | null
  connectedUrl: string | null
  companionUrl: string | null
  effectiveApiBase: string | null
  companionModalOpen: boolean
  lastError: string | null
  lastErrorType?: string | null
  openCompanionModal: () => void
  closeCompanionModal: () => void
  connectCompanion: (candidateUrl: string) => Promise<ConnectionTestResult>
  disconnectCompanion: () => void
}

export const CompanionContext = createContext<CompanionContextType | null>(null)
