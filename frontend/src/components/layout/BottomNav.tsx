import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useCompanion } from '../../lib/useCompanion'

interface BottomNavProps {
  onOpenHelp?: () => void
}

export const BottomNav: React.FC<BottomNavProps> = ({ onOpenHelp }) => {
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)
  const location = useLocation()
  const { isConnected, openCompanionModal } = useCompanion()

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.getHealth(),
    enabled: isConnected,
  })

  const ollamaConnected = health?.ollama?.connected ?? false
  const isMoreActive =
    location.pathname === '/settings' ||
    location.pathname === '/upload' ||
    location.pathname.startsWith('/review')

  const navItems = [
    { name: 'Overview', path: '/', icon: 'dashboard' },
    { name: 'Receipts', path: '/receipts', icon: 'receipt_long' },
    { name: 'Ledger', path: '/transactions', icon: 'table_chart' },
    { name: 'Reports', path: '/reports', icon: 'analytics' },
  ]

  return (
    <>
      {/* Fixed Bottom Navigation Bar (Mobile / Tablet < md) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/30 safe-bottom-nav shadow-[0_-2px_10px_rgba(32,40,32,0.06)]"
      >
        <div className="grid grid-cols-5 h-16 items-center px-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              <span className="material-symbols-outlined text-[22px] mb-0.5">
                {item.icon}
              </span>
              <span className="text-[11px] font-label-caps tracking-tight truncate max-w-[64px]">
                {item.name}
              </span>
            </NavLink>
          ))}

          {/* More / Menu Action */}
          <button
            type="button"
            onClick={() => setMoreDrawerOpen(true)}
            className={`flex flex-col items-center justify-center py-1 transition-colors min-h-[44px] ${
              isMoreActive || moreDrawerOpen
                ? 'text-primary font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[22px] mb-0.5">
              more_horiz
            </span>
            <span className="text-[11px] font-label-caps tracking-tight">
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile More Sheet / Drawer */}
      {moreDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMoreDrawerOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="relative z-10 bg-surface-container-lowest rounded-t-2xl shadow-xl border-t border-outline-variant/30 p-space-md space-y-4 max-h-[85vh] overflow-y-auto safe-bottom animate-in slide-in-from-bottom duration-200">
            {/* Grab Handle */}
            <div className="w-12 h-1.5 bg-outline-variant rounded-full mx-auto" />

            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    LocalLedger AI
                  </h3>
                  <span className="text-[11px] font-label-caps text-primary flex items-center gap-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isConnected && ollamaConnected
                          ? 'bg-primary animate-pulse'
                          : isConnected
                          ? 'bg-secondary'
                          : 'bg-tertiary'
                      }`}
                    />
                    {isConnected
                      ? ollamaConnected
                        ? 'Local inference active'
                        : 'Local OCR fallback active'
                      : 'Web Preview · No Companion'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMoreDrawerOpen(false)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Quick Actions List */}
            <div className="grid grid-cols-2 gap-2.5">
              <NavLink
                to="/upload"
                onClick={() => setMoreDrawerOpen(false)}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors min-h-[44px]"
              >
                <span className="material-symbols-outlined text-primary text-[22px]">upload_file</span>
                <div className="text-left">
                  <span className="block font-body-sm font-semibold text-on-surface text-xs">
                    Upload Queue
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-label-caps">
                    Ingest invoices
                  </span>
                </div>
              </NavLink>

              <NavLink
                to="/review"
                onClick={() => setMoreDrawerOpen(false)}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors min-h-[44px]"
              >
                <span className="material-symbols-outlined text-primary text-[22px]">rate_review</span>
                <div className="text-left">
                  <span className="block font-body-sm font-semibold text-on-surface text-xs">
                    Review Queue
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-label-caps">
                    Audit receipts
                  </span>
                </div>
              </NavLink>

              <NavLink
                to="/settings"
                onClick={() => setMoreDrawerOpen(false)}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors min-h-[44px]"
              >
                <span className="material-symbols-outlined text-primary text-[22px]">settings</span>
                <div className="text-left">
                  <span className="block font-body-sm font-semibold text-on-surface text-xs">
                    Settings
                  </span>
                  <span className="text-[10px] text-on-surface-variant font-label-caps">
                    Engine &amp; vault
                  </span>
                </div>
              </NavLink>

              {!isConnected ? (
                <button
                  type="button"
                  onClick={() => {
                    setMoreDrawerOpen(false)
                    openCompanionModal()
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors min-h-[44px] text-left"
                >
                  <span className="material-symbols-outlined text-primary text-[22px]">laptop_mac</span>
                  <div className="text-left">
                    <span className="block font-body-sm font-semibold text-on-surface text-xs">
                      Companion
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-label-caps">
                      Connect local app
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMoreDrawerOpen(false)
                    if (onOpenHelp) onOpenHelp()
                  }}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors min-h-[44px] text-left"
                >
                  <span className="material-symbols-outlined text-primary text-[22px]">help_outline</span>
                  <div className="text-left">
                    <span className="block font-body-sm font-semibold text-on-surface text-xs">
                      Help &amp; Docs
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-label-caps">
                      Privacy guide
                    </span>
                  </div>
                </button>
              )}
            </div>

            {/* Offline Vault & Host Profile */}
            <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px]">
                  AR
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-on-surface">Alex Rivera</span>
                  <span className="text-[10px] text-on-surface-variant">
                    {isConnected ? 'Local Vault Active' : 'Web Preview Mode'}
                  </span>
                </div>
              </div>
              <span className="font-mono text-[10px] text-outline">v2.4.1-rc</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
