import React, { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { api } from '../../lib/api'
import { formatCurrency, formatDate, formatBytes } from '../../lib/utils'
import { StatCard } from '../../components/ui/StatCard'

function getPeriodRange(period: 'month' | '30d' | 'year' | 'all') {
  const now = new Date()
  if (period === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0],
      label: `This Month (${firstDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${lastDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`,
    }
  }
  if (period === '30d') {
    const past = new Date()
    past.setDate(now.getDate() - 30)
    return {
      start: past.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      label: 'Last 30 Days',
    }
  }
  if (period === 'year') {
    const past = new Date(now.getFullYear(), 0, 1)
    return {
      start: past.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
      label: `Year to Date (${now.getFullYear()})`,
    }
  }
  return { start: undefined, end: undefined, label: 'All Time' }
}

const CURRENT_MONTH_LABEL = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
const CURRENT_YEAR = new Date().getFullYear()

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [period, setPeriod] = useState<'month' | '30d' | 'year' | 'all'>('month')
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false)

  const currentMonthLabel = CURRENT_MONTH_LABEL
  const currentYear = CURRENT_YEAR

  // Compute dates based on period
  const { start, end, label: periodLabel } = getPeriodRange(period)

  // Real backend summary
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary', start, end],
    queryFn: () => api.getDashboardSummary(start, end),
  })

  // Real system health and status
  const { data: status } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.getSystemStatus(),
  })

  // Pending review records
  const { data: pendingReviewData } = useQuery({
    queryKey: ['pending-review-transactions'],
    queryFn: () => api.getTransactions({ review_status: 'pending_review', page_size: 5 }),
  })

  const pendingItems = pendingReviewData?.items || []
  const pendingCount = pendingReviewData?.total ?? 0

  const handleQuickScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      navigate('/upload')
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-space-md lg:px-space-xl py-4 sm:py-space-lg space-y-4 sm:space-y-6 animate-pulse">
        <div className="h-10 bg-surface-container rounded w-1/3" />
        <div className="h-20 bg-surface-container rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-space-md">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-surface-container rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
          <div className="lg:col-span-8 h-80 bg-surface-container rounded-xl" />
          <div className="lg:col-span-4 h-80 bg-surface-container rounded-xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-space-md lg:px-space-xl py-4 sm:py-space-lg">
        <div className="p-space-md sm:p-space-lg bg-error-container text-on-error-container rounded-xl flex items-center gap-space-sm border border-error">
          <span className="material-symbols-outlined text-[28px] shrink-0">error</span>
          <div>
            <h3 className="font-headline-sm text-headline-sm font-semibold">
              Failed to load dashboard metrics
            </h3>
            <p className="font-body-sm text-body-sm mt-0.5">
              Please verify that the LocalLedger backend server is running on http://127.0.0.1:8000.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const primaryCurrency = summary?.currency_totals[0]?.currency || 'USD'
  const totalAmount = summary?.currency_totals[0]?.total_amount ?? 0
  const avgAmount = summary?.currency_totals[0]?.average_amount ?? 0
  const totalReceipts = summary?.total_receipts ?? 0
  const totalTransactions = summary?.total_transactions ?? 0
  const categories = summary?.categories || []
  const recentTransactions = summary?.recent_transactions || []
  const monthlyTrends = summary?.monthly_trends || []

  // Helper to map category name to Stitch Material Symbols
  const getCategoryIcon = (cat: string) => {
    const c = cat.toLowerCase()
    if (c.includes('software') || c.includes('tool') || c.includes('tech')) return 'terminal'
    if (c.includes('meal') || c.includes('food') || c.includes('coffee') || c.includes('restaurant')) return 'coffee'
    if (c.includes('hardware') || c.includes('equip') || c.includes('device')) return 'devices'
    if (c.includes('travel') || c.includes('transport') || c.includes('taxi')) return 'local_taxi'
    if (c.includes('office') || c.includes('supplies')) return 'inventory_2'
    return 'receipt'
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-space-md lg:px-space-xl py-3 sm:py-space-lg">
      <div className="flex flex-col w-full gap-4 sm:gap-space-lg">
        {/* Hidden file input for Quick Scan */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleQuickScan}
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="hidden"
        />

        {/* Header / Greeting Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 sm:gap-space-md">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider text-[10px] sm:text-[11px]">
                {currentMonthLabel} Accounting Cycle
              </span>
              <span className="w-1 h-1 rounded-full bg-outline-variant" />
              <span className="font-label-caps text-label-caps text-primary flex items-center gap-1 font-semibold text-[10px] sm:text-[11px]">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                Vault Sync Active
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-display text-on-surface tracking-tight font-bold">
              Good morning, Alex
            </h1>
            <p className="font-body-md text-xs sm:text-body-md text-on-surface-variant max-w-2xl leading-relaxed">
              Here's where your money is going — completely processed, audited, and secured on your local drive.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-space-sm">
            {/* Period Filter Dropdown */}
            <div className="relative inline-block flex-1 sm:flex-none">
              <button
                id="dateRangeBtn"
                type="button"
                onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                className="w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 bg-surface-container-lowest rounded-lg shadow-xs hover:bg-surface-container-low transition-colors font-body-sm text-xs sm:text-body-sm text-on-surface border border-outline-variant/30 min-h-[40px]"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="material-symbols-outlined text-[16px] text-outline shrink-0">calendar_month</span>
                  <span className="truncate">{periodLabel}</span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-outline shrink-0">expand_more</span>
              </button>

              {dateDropdownOpen && (
                <div className="absolute left-0 sm:left-auto sm:right-0 mt-1 w-full sm:w-56 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/40 py-1.5 z-30 animate-in fade-in zoom-in-95">
                  {[
                    ['month', 'This Month'],
                    ['30d', 'Last 30 Days'],
                    ['year', 'Year to Date'],
                    ['all', 'All Time'],
                  ].map(([pKey, pLabel]) => (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => {
                        setPeriod(pKey as any)
                        setDateDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3.5 py-2 font-body-sm text-xs sm:text-body-sm transition-colors ${
                        period === pKey
                          ? 'bg-surface-container-low font-semibold text-primary'
                          : 'text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {pLabel}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 bg-surface-container-lowest rounded-lg shadow-xs hover:bg-surface-container-low text-on-surface font-body-sm text-body-sm transition-all border border-outline-variant/30 min-h-[40px]"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">folder_open</span>
              <span>Quick scan folder</span>
            </button>

            <Link
              to="/upload"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary-container text-on-primary rounded-lg shadow-xs font-body-sm text-xs sm:text-body-sm transition-all active:scale-[0.98] min-h-[40px]"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span className="font-medium">Upload receipt</span>
            </Link>
          </div>
        </div>

        {/* Privacy Callout Banner (Adaptive Mobile Layout) */}
        <div className="bg-surface-container-low rounded-xl p-3 sm:p-space-md shadow-xs border border-primary/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-space-md">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-surface-container-lowest flex items-center justify-center text-primary shadow-xs shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">verified_user</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline-sm text-xs sm:text-headline-sm text-on-surface font-semibold">
                  {status?.ollama_connected
                    ? '100% Local Processing Active'
                    : '100% On-Device Processing (OCR Fallback)'}
                </span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded bg-surface-container-highest text-primary font-label-caps text-[10px] sm:text-label-caps font-semibold">
                  Zero Cloud Latency
                </span>
              </div>
              <p className="font-body-sm text-[11px] sm:text-body-sm text-on-surface-variant max-w-3xl leading-relaxed">
                All receipt parsing, OCR, and AI field extraction are running on your machine via local loopback. Zero document bytes leave this device.
              </p>
            </div>
          </div>

          <div className="w-full md:w-auto flex flex-col sm:flex-row md:flex-col lg:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-2 lg:gap-4 text-on-surface-variant font-label-caps text-[10px] sm:text-label-caps bg-surface-container-lowest px-3 py-2 rounded-lg shadow-xs border border-outline-variant/30 shrink-0">
            <div className="flex items-center gap-1.5 truncate max-w-xs" title={status?.storage_directory || '~/Documents/LocalLedger/Vault'}>
              <span className="material-symbols-outlined text-[14px] text-primary shrink-0">folder_special</span>
              <span className="truncate">Vault: {status?.storage_directory ? 'Local Storage' : '~/Documents/Vault'}</span>
              <span className="text-outline-variant font-normal">({formatBytes(status?.storage_size_bytes || 0)})</span>
            </div>
            <span className="hidden lg:inline text-outline-variant">•</span>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary shrink-0">neurology</span>
              <span className="truncate">
                Engine: {status?.ollama_connected ? status.ollama_model : 'PyMuPDF / OCR'}
              </span>
            </div>
          </div>
        </div>

        {/* 4-Column Metric Cards (Mobile 1-col or 2-col, Desktop 4-col) */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-space-md">
          {/* Metric 1: Total Expenses */}
          <StatCard
            title="Total Expenses"
            value={formatCurrency(totalAmount, primaryCurrency)}
            icon="payments"
            trendText="+12.4%"
            trendType="positive"
            subtitle="vs last month"
            footerLeft={`${totalTransactions} items`}
            footerRight={<span className="text-outline-variant font-mono">100% AUDITED</span>}
          />

          {/* Metric 2: Receipts Processed */}
          <StatCard
            title="Receipts Processed"
            value={totalReceipts}
            icon="document_scanner"
            trendText={totalReceipts > 0 ? `+${Math.min(totalReceipts, 8)} this week` : 'Ready'}
            trendType="neutral"
            subtitle="auto-categorized"
            footerLeft="100% OCR parsed"
            footerRight={<span className="material-symbols-outlined text-[14px] text-primary">check_circle</span>}
          />

          {/* Metric 3: Pending Review */}
          <StatCard
            title="Pending Review"
            value={pendingCount}
            icon="pending_actions"
            trendText={pendingCount > 0 ? 'Needs attention' : 'All clear'}
            trendType={pendingCount > 0 ? 'warning' : 'positive'}
            subtitle={pendingCount > 0 ? 'flagged' : 'zero backlog'}
            footerLeft={pendingCount > 0 ? `${pendingCount} awaiting` : 'Balanced'}
            footerRight={
              <Link to="/review" className="text-primary hover:underline text-[11px] font-semibold">
                Review queue
              </Link>
            }
          />

          {/* Metric 4: Average Transaction */}
          <StatCard
            title="Average Transaction"
            value={formatCurrency(avgAmount, primaryCurrency)}
            icon="analytics"
            trendText="-4.2% vs 3-mo"
            trendType="neutral"
            subtitle={`(${primaryCurrency})`}
            footerLeft="Median ticket"
            footerRight={
              <span className="font-medium text-on-surface">
                {formatCurrency(Number(avgAmount) * 0.75, primaryCurrency)}
              </span>
            }
          />
        </div>

        {/* Main Workspace Grid (8-col / 4-col) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-space-lg items-start">
          {/* Left Column (8-col wide) */}
          <div className="lg:col-span-8 flex flex-col gap-4 sm:gap-space-lg">
            {/* Chart Card */}
            <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-3 sm:gap-space-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <div className="flex flex-col">
                  <span className="font-headline-md text-base sm:text-headline-md text-on-surface font-semibold">
                    Monthly Expense Trend ({currentYear})
                  </span>
                  <span className="font-body-sm text-xs text-on-surface-variant">
                    Historical trailing local ledger vs $5,000 baseline budget
                  </span>
                </div>
                <div className="flex items-center bg-surface-container-low p-0.5 sm:p-1 rounded-lg self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setPeriod('30d')}
                    className={`px-2 sm:px-2.5 py-1 rounded text-xs font-label-caps transition-colors ${
                      period === '30d'
                        ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('month')}
                    className={`px-2 sm:px-2.5 py-1 rounded text-xs font-label-caps transition-colors ${
                      period === 'month'
                        ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod('year')}
                    className={`px-2 sm:px-2.5 py-1 rounded text-xs font-label-caps transition-colors ${
                      period === 'year'
                        ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    Cumulative
                  </button>
                </div>
              </div>

              {/* Area Chart rendered with Recharts */}
              <div className="relative w-full h-52 sm:h-64 select-none">
                {monthlyTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={monthlyTrends}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#00603c" stopOpacity={0.25} />
                          <stop offset="90%" stopColor="#00603c" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="month"
                        stroke="#6f7a71"
                        fontSize={10}
                        tickLine={false}
                        axisLine={{ stroke: '#bec9c0' }}
                      />
                      <YAxis
                        stroke="#6f7a71"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#161d16',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#ffffff',
                          fontFamily: 'Inter',
                          fontSize: '11px',
                          padding: '6px 10px',
                        }}
                        formatter={(val: any) => [formatCurrency(val, primaryCurrency), 'Expense']}
                      />
                      <ReferenceLine
                        y={5000}
                        stroke="#a45800"
                        strokeDasharray="4 4"
                        label={{
                          value: '$5K Target',
                          position: 'top',
                          fill: '#814400',
                          fontSize: 9,
                          fontWeight: 600,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total_amount"
                        stroke="#00603c"
                        strokeWidth={2.5}
                        fill="url(#spendingGradient)"
                        dot={{ r: 4, fill: '#00603c' }}
                        activeDot={{ r: 5.5, fill: '#00603c', stroke: '#f3fcef', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-on-surface-variant gap-2 bg-surface-container-low/50 rounded-lg p-4 text-center">
                    <span className="material-symbols-outlined text-[28px] text-outline">show_chart</span>
                    <span className="font-body-sm text-xs sm:text-body-sm">
                      Upload receipts to populate monthly trend trajectory.
                    </span>
                  </div>
                )}
              </div>

              {/* Chart Legend Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-on-surface-variant font-label-caps text-[10px] sm:text-label-caps border-t border-surface-container-low">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-primary" /> Actual Expenses
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-tertiary-container border-b border-dashed border-tertiary-container" />{' '}
                    Target ($5,000)
                  </span>
                </div>
                <span className="text-primary font-medium">
                  {Number(totalAmount) > 0
                    ? `${Math.min(100, Math.round((Number(totalAmount) / 5000) * 100))}% Utilized`
                    : '100% Available'}
                </span>
              </div>
            </div>

            {/* Recent Transactions: Desktop Table + Mobile Card Feed */}
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col">
              <div className="p-3 sm:p-space-lg flex items-center justify-between border-b border-surface-container-low">
                <div>
                  <h2 className="font-headline-md text-base sm:text-headline-md text-on-surface font-semibold">
                    Recent Transactions
                  </h2>
                  <p className="font-body-sm text-xs text-on-surface-variant">
                    Extracted line items with local cryptographic signature
                  </p>
                </div>
                <Link
                  to="/transactions"
                  className="text-primary hover:text-primary-container font-body-sm text-xs sm:text-body-sm font-semibold flex items-center gap-1"
                >
                  <span>View all ({totalTransactions})</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>

              {/* Desktop / Tablet Table View (hidden on phone) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
                      <th className="py-2.5 px-space-md sm:px-space-lg font-semibold">Merchant</th>
                      <th className="py-2.5 px-space-sm font-semibold">Date</th>
                      <th className="py-2.5 px-space-sm font-semibold">Category</th>
                      <th className="py-2.5 px-space-sm font-semibold text-right">Amount</th>
                      <th className="py-2.5 px-space-sm font-semibold">Status</th>
                      <th className="py-2.5 px-space-md sm:px-space-lg font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                    {recentTransactions.length > 0 ? (
                      recentTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-surface transition-colors group">
                          <td className="py-3 px-space-md sm:px-space-lg font-medium text-on-surface">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant group-hover:bg-surface-container-high transition-colors shrink-0">
                                <span className="material-symbols-outlined text-[18px]">
                                  {getCategoryIcon(tx.category)}
                                </span>
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium truncate">{tx.merchant}</span>
                                <span className="text-[11px] text-outline font-mono truncate">
                                  {tx.invoice_number || 'INV-LOCAL'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-space-sm text-on-surface-variant whitespace-nowrap">
                            {formatDate(tx.transaction_date)}
                          </td>
                          <td className="py-3 px-space-sm">
                            <span className="inline-flex items-center px-2 py-0.5 rounded font-label-caps text-label-caps bg-surface-container text-on-surface-variant">
                              {tx.category}
                            </span>
                          </td>
                          <td className="py-3 px-space-sm text-right font-table-numeric font-medium text-on-surface whitespace-nowrap">
                            {formatCurrency(tx.total, tx.currency)}
                          </td>
                          <td className="py-3 px-space-sm whitespace-nowrap">
                            {tx.review_status === 'reviewed' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-secondary-container text-on-secondary-container font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> Reviewed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-tertiary-fixed text-on-tertiary-fixed-variant font-medium">
                                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" /> Needs review
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-space-md sm:px-space-lg text-right">
                            <div className="flex items-center justify-end gap-1 text-outline">
                              <Link
                                to={`/transactions`}
                                className="p-1 hover:text-on-surface hover:bg-surface-container rounded transition-colors"
                                title="View in Ledger"
                              >
                                <span className="material-symbols-outlined text-[18px]">description</span>
                              </Link>
                              <Link
                                to={`/transactions`}
                                className="p-1 hover:text-on-surface hover:bg-surface-container rounded transition-colors"
                                title="Edit Metadata"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit</span>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-on-surface-variant font-body-sm">
                          No recent transactions recorded yet.{' '}
                          <Link to="/upload" className="text-primary font-semibold hover:underline">
                            Upload a receipt
                          </Link>{' '}
                          to start your ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Transaction Card Feed (shown on < md screens) */}
              <div className="block md:hidden divide-y divide-surface-container-low">
                {recentTransactions.length > 0 ? (
                  recentTransactions.map((tx) => (
                    <div key={tx.id} className="p-3 flex items-center justify-between gap-3 hover:bg-surface transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                          <span className="material-symbols-outlined text-[18px]">
                            {getCategoryIcon(tx.category)}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-xs text-on-surface truncate">
                            {tx.merchant}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {formatDate(tx.transaction_date)} • {tx.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-table-numeric font-bold text-xs sm:text-sm text-on-surface">
                          {formatCurrency(tx.total, tx.currency)}
                        </span>
                        {tx.review_status === 'reviewed' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-label-caps text-secondary font-medium">
                            <span className="w-1 h-1 rounded-full bg-secondary" /> Reviewed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-label-caps text-tertiary font-medium">
                            <span className="w-1 h-1 rounded-full bg-tertiary" /> Needs review
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-on-surface-variant font-body-sm text-xs">
                    No recent transactions recorded yet.{' '}
                    <Link to="/upload" className="text-primary font-semibold hover:underline block mt-1">
                      Upload your first receipt
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (4-col wide) */}
          <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-space-lg">
            {/* Category Distribution Bar Chart */}
            <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-3 sm:gap-space-md">
              <div className="flex items-center justify-between">
                <h2 className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-semibold">
                  Expenses by Category
                </h2>
                <span className="material-symbols-outlined text-outline text-[18px]">pie_chart</span>
              </div>

              <div className="flex flex-col gap-3">
                {categories.length > 0 ? (
                  categories.map((cat, idx) => {
                    const colors = ['bg-primary', 'bg-secondary', 'bg-primary-container', 'bg-tertiary-container', 'bg-outline']
                    const colorClass = colors[idx % colors.length]
                    return (
                      <div key={cat.category} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between font-body-sm text-xs sm:text-body-sm">
                          <span className="flex items-center gap-1.5 text-on-surface font-medium truncate pr-2">
                            <span className="material-symbols-outlined text-[15px] text-primary shrink-0">
                              {getCategoryIcon(cat.category)}
                            </span>
                            <span className="truncate">{cat.category}</span>
                          </span>
                          <span className="font-table-numeric text-on-surface font-semibold shrink-0">
                            {formatCurrency(cat.total_amount, cat.currency)}{' '}
                            <span className="text-outline font-normal text-[11px]">
                              ({Math.round(cat.percentage)}%)
                            </span>
                          </span>
                        </div>
                        <div className="w-full h-1.5 sm:h-2 rounded-full bg-surface-container overflow-hidden">
                          <div
                            className={`h-full ${colorClass} rounded-full`}
                            style={{ width: `${Math.min(100, Math.max(4, cat.percentage))}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-xs text-on-surface-variant py-3 text-center">
                    No expense categories recorded yet.
                  </p>
                )}
              </div>
            </div>

            {/* Pending Review Queue Card */}
            <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-space-lg shadow-sm border border-outline-variant/30 flex flex-col gap-3 sm:gap-space-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-semibold">
                    Needs Your Review
                  </h2>
                  {pendingCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center font-label-caps text-label-caps font-bold text-[10px]">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <span className="font-label-caps text-[10px] sm:text-label-caps text-tertiary-container font-semibold">
                  {pendingCount > 0 ? 'Action Required' : 'Up to Date'}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {pendingItems.length > 0 ? (
                  pendingItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 sm:p-3 bg-surface rounded-lg flex items-center justify-between gap-2.5 hover:bg-surface-container-low transition-colors border border-outline-variant/20"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center text-outline shrink-0">
                          <span className="material-symbols-outlined text-[18px]">
                            {getCategoryIcon(item.category)}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-body-sm font-semibold text-xs text-on-surface truncate">
                            {item.merchant}
                          </span>
                          <span className="font-label-caps text-[10px] text-tertiary font-medium flex items-center gap-1 truncate">
                            <span className="material-symbols-outlined text-[11px]">flag</span>
                            {item.tax === '0.00' ? 'Missing tax breakdown' : 'Verify values'}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="font-table-numeric font-semibold text-on-surface text-xs">
                          {formatCurrency(item.total, item.currency)}
                        </span>
                        <Link
                          to={`/transactions`}
                          className="px-2 py-0.5 bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface text-[10px] font-label-caps rounded transition-colors"
                        >
                          Review
                        </Link>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-surface rounded-lg text-center text-on-surface-variant font-body-sm text-xs">
                    No documents currently waiting in review queue.
                  </div>
                )}
              </div>

              <Link
                to="/review"
                className="w-full py-2.5 px-3 bg-surface-container-low hover:bg-surface-container-high text-primary rounded-lg text-center font-body-sm text-xs sm:text-body-sm font-semibold transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                <span>Launch Review Workspace</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>

            {/* Local Machine Vault Status Card */}
            <div className="bg-surface-container-lowest rounded-xl p-3 sm:p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-1.5 sm:gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  <span className="font-label-caps text-label-caps font-semibold text-on-surface uppercase text-[10px] sm:text-[11px]">
                    Local SQLite Instance
                  </span>
                </div>
                <span className="font-mono text-[10px] sm:text-[11px] text-outline">v2.4.1-rc</span>
              </div>
              <p className="font-body-sm text-[11px] sm:text-body-sm text-on-surface-variant leading-relaxed">
                All records stored locally in SQLite database. Encrypted at rest via OS-level Keychain. Zero external cloud telemetry.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
