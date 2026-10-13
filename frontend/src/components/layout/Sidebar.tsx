import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  UploadCloud,
  Receipt,
  BarChart3,
  Settings,
  ShieldCheck,
  HardDrive,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'

interface SidebarProps {
  mobileOpen?: boolean
  onCloseMobile?: () => void
}

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Upload & Process', path: '/upload', icon: UploadCloud },
  { name: 'Transactions', path: '/transactions', icon: Receipt },
  { name: 'Reports & Export', path: '/reports', icon: BarChart3 },
  { name: 'Settings', path: '/settings', icon: Settings },
]

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const content = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-64 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white shadow-sm shadow-brand-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-slate-900 leading-none">
              LocalLedger
            </h1>
            <span className="text-xs font-semibold text-brand-600 tracking-wider uppercase">
              Private AI
            </span>
          </div>
        </div>
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-800 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                )
              }
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Local-First Privacy Badge */}
      <div className="p-4 m-3 rounded-xl bg-slate-50 border border-slate-100">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
          <HardDrive className="h-4 w-4 text-brand-600" />
          <span>Local-Only Storage</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
          Zero cloud LLMs or telemetry. Documents stay on your machine.
        </p>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block shrink-0">{content}</aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative z-10">{content}</div>
        </div>
      )}
    </>
  )
}
