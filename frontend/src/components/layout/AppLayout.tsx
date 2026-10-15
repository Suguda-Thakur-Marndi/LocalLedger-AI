import React, { useState, useEffect } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { api } from '../../lib/api'
import { useCompanion } from '../../lib/useCompanion'

export const AppLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileSearchVisible, setMobileSearchVisible] = useState(false)
  const navigate = useNavigate()

  const {
    runtimeMode,
    isLocal,
    isConnected,
    isPublicUnconnected,
    status,
    savedUrl,
    openCompanionModal,
  } = useCompanion()

  // Only query system health when running locally or companion is connected
  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.getHealth(),
    enabled: isConnected,
    refetchInterval: isConnected ? 30000 : false,
  })

  const ollamaConnected = health?.ollama?.connected ?? false

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent || '')

  const handleExportBackup = async () => {
    try {
      const { filename, blob } = await api.downloadBackupZip()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      alert(err.message || 'Failed to download backup archive.')
    }
  }

  // Subscribe to native desktop menu events
  useEffect(() => {
    const desktopBridge = (window as any).desktopBridge
    if (!desktopBridge?.onMenuAction) return

    const unsubscribe = desktopBridge.onMenuAction((action: string) => {
      switch (action) {
        case 'add-receipt':
          navigate('/upload')
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('localledger:open-file-picker'))
          }, 60)
          break
        case 'open-settings':
          navigate('/settings')
          break
        case 'open-help':
          setHelpOpen(true)
          break
        case 'export-backup':
          handleExportBackup()
          break
        case 'focus-search': {
          setMobileSearchVisible(true)
          const input = document.getElementById('globalSearchInput') as HTMLInputElement | null
          if (input) {
            input.focus()
            input.select()
          }
          break
        }
      }
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [navigate])

  // Global keyboard shortcuts for Ctrl+K, Ctrl+O, Ctrl+,
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey

      // Ctrl+K: Focus search
      if (isCmdOrCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const input = document.getElementById('globalSearchInput') as HTMLInputElement | null
        if (input) {
          input.focus()
          input.select()
        } else {
          setMobileSearchVisible(true)
        }
      }

      // Ctrl+O: Add Receipt / Upload Files
      if (isCmdOrCtrl && e.key.toLowerCase() === 'o') {
        e.preventDefault()
        navigate('/upload')
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('localledger:open-file-picker'))
        }, 60)
      }

      // Ctrl+,: Open Settings
      if (isCmdOrCtrl && (e.key === ',' || e.code === 'Comma')) {
        e.preventDefault()
        navigate('/settings')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setMobileSearchVisible(false)
      navigate(`/transactions?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <div className="min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col">
      {/* Sidebar (Desktop full + Tablet rail + Mobile drawer) */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenHelp={() => setHelpOpen(true)}
      />

      {/* Main Column */}
      <div className="md:pl-16 lg:pl-60 min-h-screen flex flex-col flex-1">
        {/* Top Header Bar */}
        <header className="fixed top-0 left-0 md:left-16 lg:left-60 right-0 h-16 bg-surface-container-lowest/95 backdrop-blur-md z-30 border-b border-outline-variant/30 shadow-[0_1px_6px_rgba(32,40,32,0.04)]">
          <div className="w-full h-16 px-3 sm:px-space-md lg:px-space-xl flex items-center justify-between gap-2 sm:gap-space-md">
            {/* Mobile Brand / Toggle */}
            <div className="flex items-center gap-2 md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container min-h-[44px] min-w-[44px] flex items-center justify-center -ml-1"
                aria-label="Open full drawer menu"
              >
                <span className="material-symbols-outlined text-[22px]">menu</span>
              </button>

              <Link to="/" className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                </div>
                <span className="font-headline-sm text-body-md font-bold tracking-tight text-on-surface truncate max-w-[120px] sm:max-w-none">
                  LocalLedger
                </span>
              </Link>
            </div>

            {/* Desktop & Tablet Search Bar */}
            <div className="hidden sm:flex items-center gap-space-sm flex-1 max-w-md">
              <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center">
                <span className="material-symbols-outlined absolute left-2.5 text-outline text-[18px]">
                  search
                </span>
                <input
                  id="globalSearchInput"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search receipts, vendors, amounts..."
                  className="w-full bg-surface-container-low pl-8 pr-12 py-2 rounded-lg text-body-sm font-body-sm text-on-surface placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary transition-all border border-transparent focus:border-primary"
                  type="text"
                />
                <kbd className="absolute right-2 px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-caps text-label-caps select-none pointer-events-none">
                  {isMac ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </form>
            </div>

            {/* Right System Badges & Primary Action */}
            <div className="flex items-center gap-1.5 sm:gap-space-md ml-auto">
              {/* Mobile Search Toggle Icon */}
              <button
                type="button"
                onClick={() => setMobileSearchVisible(!mobileSearchVisible)}
                className="sm:hidden p-2 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Search receipts"
              >
                <span className="material-symbols-outlined text-[22px]">search</span>
              </button>

              {/* Status Pill: Local Engine vs Web Preview */}
              {isPublicUnconnected ? (
                <button
                  type="button"
                  onClick={openCompanionModal}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-caps text-label-caps border transition-colors ${
                    status === 'saved'
                      ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                      : status === 'error'
                      ? 'bg-error-container text-on-error-container border-error/40 hover:bg-error-container/80'
                      : 'bg-surface-container-highest text-tertiary-container border-outline-variant hover:bg-surface-container'
                  }`}
                  title={
                    status === 'saved'
                      ? `Companion endpoint saved (${savedUrl}), but not connected. Click to verify.`
                      : status === 'error'
                      ? 'Companion connection failed. Click to inspect and retry.'
                      : 'Running in web preview without connected companion. Click to connect local companion.'
                  }
                >
                  <span
                    className={`material-symbols-outlined text-[14px] ${
                      status === 'saved'
                        ? 'text-amber-700'
                        : status === 'error'
                        ? 'text-error'
                        : 'text-tertiary'
                    }`}
                  >
                    {status === 'saved' ? 'cloud_queue' : status === 'error' ? 'error' : 'cloud_off'}
                  </span>
                  <span className="hidden sm:inline">
                    {status === 'saved'
                      ? 'Saved Companion · Offline'
                      : status === 'error'
                      ? 'Companion Error'
                      : 'Web Preview · No Companion'}
                  </span>
                  <span className="sm:hidden text-[10px]">
                    {status === 'saved' ? 'Saved' : status === 'error' ? 'Error' : 'Preview'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={!isLocal ? openCompanionModal : undefined}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-caps text-label-caps border transition-colors ${
                    ollamaConnected
                      ? 'bg-surface-container-low text-on-surface-variant border-primary/20'
                      : 'bg-surface-container-highest text-tertiary-container border-outline-variant'
                  }`}
                  title={
                    runtimeMode === 'companion_connected'
                      ? 'Connected to local companion. Documents processed on your machine.'
                      : ollamaConnected
                      ? 'Local Ollama is active. Zero documents leave your machine.'
                      : 'Ollama is offline. Rule-based local OCR fallback is active.'
                  }
                >
                  <span
                    className={`material-symbols-outlined text-[14px] ${
                      ollamaConnected ? 'text-primary' : 'text-tertiary'
                    }`}
                  >
                    verified_user
                  </span>
                  <span className="hidden sm:inline">
                    {runtimeMode === 'companion_connected'
                      ? 'Companion Active · Local'
                      : ollamaConnected
                      ? 'Neural Engine · Local'
                      : 'Local OCR · Fallback'}
                  </span>
                  <span className="sm:hidden text-[10px]">
                    {runtimeMode === 'companion_connected'
                      ? 'Companion'
                      : ollamaConnected
                      ? 'Local AI'
                      : 'OCR'}
                  </span>
                </button>
              )}

              {/* Upload Receipt Action */}
              <Link
                to="/upload"
                id="topHeaderUploadBtn"
                className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary px-3 sm:px-3.5 py-2 rounded-lg font-body-sm text-body-sm font-medium transition-all shadow-xs active:scale-[0.98] min-h-[40px]"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span className="hidden xs:inline">Upload</span>
              </Link>
            </div>
          </div>

          {/* Mobile Collapsible Search Drawer */}
          {mobileSearchVisible && (
            <div className="sm:hidden bg-surface-container-lowest px-3 py-2 border-t border-surface-container-low shadow-sm animate-in fade-in slide-in-from-top-2">
              <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center">
                <span className="material-symbols-outlined absolute left-2.5 text-outline text-[18px]">
                  search
                </span>
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search receipts, vendors, amounts..."
                  className="w-full bg-surface-container-low pl-8 pr-10 py-2 rounded-lg text-body-sm font-body-sm text-on-surface placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary"
                  type="text"
                />
                <button
                  type="button"
                  onClick={() => setMobileSearchVisible(false)}
                  className="absolute right-2 p-1 text-on-surface-variant hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </form>
            </div>
          )}
        </header>

        {/* Scrollable Content Body with Safe Bottom Padding */}
        <main className="relative pt-16 pb-24 md:pb-8 flex-1 bg-surface">
          {/* Public Web Preview Top Banner */}
          {isPublicUnconnected && (
            <div className="bg-surface-container-low border-b border-primary/20 px-3 sm:px-space-md lg:px-space-xl py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-on-surface">
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0">
                  privacy_tip
                </span>
                <span>
                  {status === 'saved' ? (
                    <>
                      <strong>Companion Saved (Offline):</strong> An endpoint is saved (<code>{savedUrl}</code>), but not verified in this session. Connect to enable local receipt processing.
                    </>
                  ) : status === 'error' ? (
                    <>
                      <strong>Companion Connection Notice:</strong> Unable to connect to your local companion. Ensure your local backend is running.
                    </>
                  ) : (
                    <>
                      <strong>Web Preview Mode:</strong> Receipt processing and database records run 100% locally on your computer.
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={openCompanionModal}
                className="inline-flex items-center gap-1 font-semibold text-primary hover:underline shrink-0"
              >
                <span>{status === 'saved' ? 'Verify & Connect' : status === 'error' ? 'Retry Connection' : 'Connect Local Companion'}</span>
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>
          )}

          <Outlet />
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <BottomNav onOpenHelp={() => setHelpOpen(true)} />

      {/* Help & Privacy Documentation Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl shadow-xl border border-outline-variant/40 p-space-md sm:p-space-lg space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined text-[20px]">help_outline</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    LocalLedger AI Sovereign Guide
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Private accounting built for complete data sovereignty
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="space-y-3 text-body-sm text-on-surface-variant leading-relaxed">
              <div className="p-3 rounded-lg bg-surface-container-low border border-primary/20 space-y-1">
                <span className="font-semibold text-primary block">
                  100% On-Device AI &amp; Local Storage
                </span>
                <p className="text-xs">
                  All invoice documents, optical character recognition (OCR), and Ollama model interactions happen exclusively inside your host machine loopback. No cloud endpoints receive your financial files.
                </p>
              </div>

              <div>
                <span className="font-semibold text-on-surface block text-xs uppercase tracking-wider mb-1">
                  Public Web vs. Local Companion
                </span>
                <p className="text-xs">
                  When accessing LocalLedger AI through a public web URL, you can explore the dashboard and view reports in demo preview. To process live receipts, connect the web interface to your running local companion backend on 127.0.0.1:8000.
                </p>
              </div>

              <div>
                <span className="font-semibold text-on-surface block text-xs uppercase tracking-wider mb-1">
                  Supported File Types
                </span>
                <p className="text-xs">
                  PDF documents (multi-page invoices), PNG, JPEG, and WebP receipts up to 25 MB.
                </p>
              </div>

              <div>
                <span className="font-semibold text-on-surface block text-xs uppercase tracking-wider mb-1">
                  Keyboard Shortcuts
                </span>
                <ul className="text-xs space-y-1 font-mono">
                  <li><kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">⌘K</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">Ctrl+K</kbd> — Focus search across all ledger items</li>
                  <li><kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">⌘↵</kbd> / <kbd className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface">Ctrl+Enter</kbd> — Save and confirm review transaction</li>
                </ul>
              </div>
            </div>

            <div className="pt-2 border-t border-surface-container flex justify-end">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="px-4 py-2 bg-primary text-on-primary hover:bg-primary-container rounded-lg font-body-sm text-body-sm font-medium transition-all min-h-[44px]"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
