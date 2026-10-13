import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Sparkles, Cpu, CheckCircle2, AlertCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { api } from '../../lib/api'

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.getHealth(),
    refetchInterval: 30000,
  })

  const ollamaConnected = health?.ollama?.connected ?? false
  const ocrReady = health?.ocr_engine?.available ?? true

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-xs font-medium text-slate-500 hidden sm:inline-block">
              Hacktoberfest Edition • Local-First Financial Engine
            </span>
          </div>

          {/* Engine Status Indicators */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {/* Ollama Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                ollamaConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title={
                ollamaConnected
                  ? `Ollama model active: ${health?.ollama?.model_configured}`
                  : 'Ollama is offline. OCR-only heuristic fallback active.'
              }
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="font-medium hidden sm:inline">Ollama AI:</span>
              <span className="font-semibold">
                {ollamaConnected ? 'Online' : 'Offline (OCR Fallback)'}
              </span>
            </div>

            {/* OCR Status Badge */}
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-slate-50 text-slate-700 border-slate-200"
              title={health?.ocr_engine?.engine || 'Local Document Extractor'}
            >
              <Cpu className="h-3.5 w-3.5 text-slate-500" />
              <span>OCR:</span>
              <span className="font-medium">
                {ocrReady ? 'Ready' : 'PDF Native'}
              </span>
            </div>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
