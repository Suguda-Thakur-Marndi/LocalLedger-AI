import React from 'react'
import { NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useCompanion } from '../../lib/useCompanion'

interface SidebarProps {
  mobileOpen?: boolean
  onCloseMobile?: () => void
  onOpenHelp?: () => void
}

const navItems = [
  { name: 'Overview', path: '/', icon: 'dashboard' },
  { name: 'Receipts', path: '/receipts', icon: 'receipt_long' },
  { name: 'Upload Queue', path: '/upload', icon: 'upload_file' },
  { name: 'Review', path: '/review', icon: 'rate_review' },
  { name: 'Transactions', path: '/transactions', icon: 'table_chart' },
  { name: 'Reports', path: '/reports', icon: 'analytics' },
]

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile, onOpenHelp }) => {
  const { isConnected, isLocal, runtimeMode, status, openCompanionModal } = useCompanion()

  const { data: health } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => api.getHealth(),
    enabled: isConnected,
    refetchInterval: isConnected ? 30000 : false,
  })

  const ollamaConnected = health?.ollama?.connected ?? false
  const modelName = health?.ollama?.model_configured || 'Qwen2.5 / llama3.2'

  const content = (
    <div className="h-full w-full bg-surface-container-lowest flex flex-col justify-between border-r border-outline-variant/30 shadow-[0_1px_8px_rgba(32,40,32,0.04)] select-none">
      <div className="flex flex-col">
        {/* Brand Logo & Local Status */}
        <div className="p-space-md pb-space-sm flex flex-col gap-space-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-xs shrink-0">
                <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              </div>
              <span className="font-headline-md text-headline-md text-on-surface tracking-tight font-bold hidden lg:inline">
                LocalLedger AI
              </span>
            </div>
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="md:hidden p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            )}
          </div>

          {/* Local Status Indicator */}
          {isConnected ? (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-low text-primary text-label-caps font-label-caps">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  ollamaConnected ? 'bg-primary animate-pulse' : 'bg-tertiary'
                }`}
              />
              <span className="truncate">
                {runtimeMode === 'companion_connected'
                  ? 'Companion Bridge Active'
                  : ollamaConnected
                  ? 'Local processing active'
                  : 'Ollama Offline (OCR Mode)'}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={openCompanionModal}
              className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-label-caps font-label-caps text-left ${
                status === 'saved'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                  : status === 'error'
                  ? 'bg-error-container text-on-error-container hover:bg-error-container/80'
                  : 'bg-surface-container-highest text-tertiary-container hover:bg-surface-container'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  status === 'saved' ? 'bg-amber-600' : status === 'error' ? 'bg-error' : 'bg-tertiary'
                }`}
              />
              <span className="truncate">
                {status === 'saved'
                  ? 'Saved Companion · Offline'
                  : status === 'error'
                  ? 'Companion Error · Retry'
                  : 'Web Preview · Connect Companion'}
              </span>
            </button>
          )}
        </div>

        {/* Section Header */}
        <div className="px-space-md py-space-2xs hidden lg:block">
          <span className="text-label-caps font-label-caps text-on-surface-variant uppercase tracking-wider">
            Workspace
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="px-2 lg:px-space-sm flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onCloseMobile}
              title={item.name}
              className={({ isActive }) =>
                `flex items-center justify-center lg:justify-start gap-space-xs px-2.5 lg:px-3 py-2.5 transition-all font-body-md text-body-md rounded-lg min-h-[44px] ${
                  isActive
                    ? 'bg-primary text-on-primary font-medium shadow-[0_1px_3px_rgba(32,40,32,0.05)]'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
              <span className="hidden lg:inline">{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer Area: Model status, Settings, User profile */}
      <div className="flex flex-col gap-space-xs p-2 lg:p-space-sm">
        {/* Model Indicator (Desktop Only) */}
        {isConnected ? (
          <div className="mx-2 p-2 rounded-lg bg-surface-container-low hidden lg:flex items-center justify-between">
            <div className="flex items-center gap-1.5 truncate pr-1">
              <span className="material-symbols-outlined text-primary text-[16px] shrink-0">memory</span>
              <span className="font-label-caps text-label-caps text-on-surface-variant truncate">
                {modelName}
              </span>
            </div>
            <span
              className={`font-label-caps text-label-caps shrink-0 font-semibold ${
                ollamaConnected ? 'text-primary' : 'text-tertiary-container'
              }`}
            >
              {ollamaConnected ? 'Ready' : 'OCR Fallback'}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={openCompanionModal}
            className="mx-2 p-2 rounded-lg bg-surface-container-low hover:bg-surface-container hidden lg:flex items-center justify-between transition-colors text-left"
          >
            <div className="flex items-center gap-1.5 truncate pr-1">
              <span className="material-symbols-outlined text-tertiary text-[16px] shrink-0">power_off</span>
              <span className="font-label-caps text-label-caps text-on-surface-variant truncate">
                Local Companion
              </span>
            </div>
            <span className="font-label-caps text-label-caps shrink-0 font-semibold text-primary">
              Connect
            </span>
          </button>
        )}

        {/* Secondary Nav: Settings & Help */}
        <nav className="flex flex-col gap-0.5">
          <NavLink
            to="/settings"
            onClick={onCloseMobile}
            title="Settings"
            className={({ isActive }) =>
              `flex items-center justify-center lg:justify-start gap-space-xs px-2.5 lg:px-3 py-2 rounded-lg transition-all font-body-sm text-body-sm min-h-[44px] ${
                isActive
                  ? 'bg-primary text-on-primary font-medium'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">settings</span>
            <span className="hidden lg:inline">Settings</span>
          </NavLink>
          <button
            onClick={() => {
              if (onOpenHelp) onOpenHelp()
              if (onCloseMobile) onCloseMobile()
            }}
            type="button"
            title="Help & Docs"
            className="flex items-center justify-center lg:justify-start gap-space-xs px-2.5 lg:px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all font-body-sm text-body-sm text-left w-full min-h-[44px]"
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">help_outline</span>
            <span className="hidden lg:inline">Help &amp; Docs</span>
          </button>
        </nav>

        {/* User Profile Pill */}
        <div className="pt-space-xs flex items-center justify-center lg:justify-between px-2 py-1.5 rounded-lg hover:bg-surface-container-high transition-colors">
          <div className="flex items-center gap-space-xs">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
              AR
            </div>
            <div className="hidden lg:flex flex-col min-w-0">
              <span className="font-body-sm text-body-sm font-semibold text-on-surface leading-tight truncate">
                Alex Rivera
              </span>
              <span className="font-label-caps text-label-caps text-on-surface-variant leading-tight truncate">
                {isLocal ? 'Local Vault' : status === 'connected' ? 'Connected Companion' : status === 'saved' ? 'Saved (Offline)' : 'Web Preview'}
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-[18px] cursor-pointer hover:text-on-surface hidden lg:inline">
            more_vert
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar (Tablet: 64px rail, Desktop: 240px full) */}
      <aside className="fixed left-0 top-0 h-full md:w-16 lg:w-60 z-30 hidden md:block transition-all">
        {content}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-64 h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  )
}
