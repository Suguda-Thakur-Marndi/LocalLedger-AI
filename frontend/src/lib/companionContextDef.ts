import { createContext } from 'react'
import type { RuntimeMode } from './runtimeConfig'
import type { ConnectionTestResult } from './api'

export interface CompanionContextType {
  runtimeMode: RuntimeMode
  isLocal: boolean
  isConnected: boolean
  isPublicUnconnected: boolean
  companionUrl: string | null
  effectiveApiBase: string | null
  companionModalOpen: boolean
  openCompanionModal: () => void
  closeCompanionModal: () => void
  connectCompanion: (candidateUrl: string) => Promise<ConnectionTestResult>
  disconnectCompanion: () => void
}

export const CompanionContext = createContext<CompanionContextType | null>(null)
