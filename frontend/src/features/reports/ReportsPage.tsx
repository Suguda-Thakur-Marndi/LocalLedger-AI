import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../../lib/api'
import { formatCurrency } from '../../lib/utils'

export const ReportsPage: React.FC = () => {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const { data: summary, isLoading } = useQuery({
    queryKey: ['reports-summary', startDate, endDate],
    queryFn: () => api.getDashboardSummary(startDate || undefined, endDate || undefined),
  })

  const exportUrl = api.getExportCsvUrl({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  })

  return (
    <div className="max-w-7xl mx-auto px-space-sm sm:px-space-md lg:px-space-xl py-space-md sm:py-space-lg space-y-space-md sm:space-y-space-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
            <span>Sovereign Financial Intelligence</span>
            <span>•</span>
            <span className="text-primary font-semibold">Strict Multi-Currency Isolation</span>
          </div>
          <h1 className="font-display text-2xl sm:text-display text-on-surface tracking-tight mt-1">
            Financial Reports
          </h1>
          <p className="font-body-sm sm:font-body-md text-on-surface-variant mt-1">
            Aggregated analytics computed exclusively on local database tables without cloud ingestion.
          </p>
        </div>

        <a
          href={exportUrl}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-primary hover:bg-primary-container text-on-primary rounded-xl font-body-sm text-xs sm:text-body-sm font-semibold transition-all shadow-xs self-start sm:self-auto active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          <span>Export Filtered CSV</span>
        </a>
      </div>

      {/* Date Range Filter Bar with Natural Wrapping */}
      <div className="bg-surface-container-lowest rounded-xl p-space-sm sm:p-space-md shadow-xs border border-outline-variant/30 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-outline">calendar_today</span>
          <span>Date Period:</span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-surface-container-low text-on-surface px-3 py-2 min-h-[42px] rounded-xl text-body-sm border border-transparent focus:border-primary focus:outline-none flex-1 sm:max-w-[180px]"
            aria-label="Start Date"
          />
          <span className="text-outline text-xs text-center sm:text-left">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-surface-container-low text-on-surface px-3 py-2 min-h-[42px] rounded-xl text-body-sm border border-transparent focus:border-primary focus:outline-none flex-1 sm:max-w-[180px]"
            aria-label="End Date"
          />
        </div>

        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
            }}
            className="text-xs text-primary font-medium hover:underline flex items-center justify-center sm:justify-start gap-1 py-1 min-h-[36px]"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            <span>Clear Dates</span>
          </button>
        )}
      </div>

      {/* Grouped Currency Totals (Stacked on phones, responsive grid on tablets/desktops) */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md animate-pulse">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface-container-lowest rounded-xl p-space-md h-28 border border-outline-variant/30"
            />
          ))}
        </div>
      ) : summary && summary.currency_totals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {summary.currency_totals.map((c) => (
            <div
              key={c.currency}
              className="bg-surface-container-lowest rounded-xl p-space-md shadow-xs border border-outline-variant/30 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-on-surface-variant mb-2">
                <span className="font-label-caps text-label-caps uppercase font-semibold">
                  Total Spend ({c.currency})
                </span>
                <span className="material-symbols-outlined text-outline text-[18px]">payments</span>
              </div>
              <div className="mt-1">
                <div className="font-headline-lg text-2xl sm:text-headline-lg font-table-numeric text-on-surface font-bold truncate">
                  {formatCurrency(c.total_amount, c.currency)}
                </div>
                <div className="font-body-sm text-[12px] text-on-surface-variant mt-1">
                  Average {formatCurrency(c.average_amount, c.currency)} across {c.transaction_count} records
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Analytics Charts & Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md lg:gap-space-lg items-start">
        {/* Monthly Bar Chart (8-col on lg, full-width on mobile) */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-space-md sm:p-space-lg shadow-xs border border-outline-variant/30 flex flex-col gap-space-md">
          <div>
            <h2 className="font-headline-md text-base sm:text-headline-md text-on-surface font-semibold">
              Monthly Expenditure Volume
            </h2>
            <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
              Aggregated monthly totals by calendar period
            </p>
          </div>

          <div className="h-60 sm:h-72 w-full">
            {summary && summary.monthly_trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.monthly_trends}
                  margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    stroke="#6f7a71"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#bec9c0' }}
                  />
                  <YAxis
                    stroke="#6f7a71"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#161d16',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontFamily: 'Inter',
                      fontSize: '11px',
                    }}
                    formatter={(val: any, _name: any, item: any) => [
                      formatCurrency(val, item.payload.currency),
                      'Total Spend',
                    ]}
                  />
                  <Bar dataKey="total_amount" fill="#00603c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-on-surface-variant">
                No monthly data points available for this period.
              </div>
            )}
          </div>
        </div>

        {/* Category Breakdown (4-col on lg, full-width on mobile) */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-space-md sm:p-space-lg shadow-xs border border-outline-variant/30 flex flex-col gap-space-md">
          <div>
            <h2 className="font-headline-md text-base sm:text-headline-md text-on-surface font-semibold">
              Category Distribution
            </h2>
            <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
              Proportional expense breakdown
            </p>
          </div>

          <div className="space-y-3">
            {summary && summary.categories.length > 0 ? (
              summary.categories.map((cat, idx) => {
                const colors = [
                  'bg-primary',
                  'bg-secondary',
                  'bg-primary-container',
                  'bg-tertiary-container',
                  'bg-outline',
                ]
                return (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex items-center justify-between font-body-sm text-xs sm:text-body-sm">
                      <span className="font-medium text-on-surface truncate pr-2">
                        {cat.category}
                      </span>
                      <span className="font-table-numeric text-on-surface font-semibold shrink-0">
                        {formatCurrency(cat.total_amount, cat.currency)}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                      <div
                        className={`h-full ${colors[idx % colors.length]} rounded-full`}
                        style={{ width: `${Math.min(100, Math.max(4, cat.percentage))}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-xs text-on-surface-variant py-6 text-center">
                No category records available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
