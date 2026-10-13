import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  PieChart as PieIcon,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react'
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Aggregated analytics grouped strictly by currency to prevent inaccurate multi-currency sums.
          </p>
        </div>

        <a
          href={exportUrl}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors shrink-0"
        >
          <Download className="h-4 w-4" />
          <span>Export Filtered CSV</span>
        </a>
      </div>

      {/* Date Range Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>Date Range:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:border-brand-600"
          />
          <span className="text-slate-400 text-xs">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:border-brand-600"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => {
              setStartDate('')
              setEndDate('')
            }}
            className="text-xs text-brand-600 hover:underline font-medium"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Grouped Currency Totals */}
      {summary && summary.currency_totals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {summary.currency_totals.map((c) => (
            <div
              key={c.currency}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Total Spending ({c.currency})
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
                  {c.transaction_count} Transactions
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-slate-900">
                  {formatCurrency(c.total_amount, c.currency)}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Average: {formatCurrency(c.average_amount, c.currency)} / tx
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Breakdown Table & Bar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Expenses by Category</h2>
            <span className="text-xs text-slate-500">Ranked by total volume</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase">
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-center">Tx Count</th>
                  <th className="py-2.5 px-4 text-right">Total Amount</th>
                  <th className="py-2.5 px-4 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!summary || summary.categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-xs text-slate-400">
                      No expenses registered for the chosen period.
                    </td>
                  </tr>
                ) : (
                  summary.categories.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{cat.category}</td>
                      <td className="py-2.5 px-4 text-center text-slate-600 font-mono text-xs">
                        {cat.transaction_count}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(cat.total_amount, cat.currency)}
                      </td>
                      <td className="py-2.5 px-4 text-right text-xs text-slate-500">
                        {cat.percentage}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">Category Volume Comparison</h2>
            <p className="text-xs text-slate-500">Spending across top expense channels</p>
          </div>
          <div className="h-64 w-full">
            {summary && summary.categories.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.categories.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <XAxis
                    dataKey="category"
                    stroke="#94a3b8"
                    fontSize={10}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    tickLine={false}
                  />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(val: any, _name: any, item: any) => [
                      formatCurrency(val, item.payload.currency),
                      'Total',
                    ]}
                  />
                  <Bar dataKey="total_amount" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-400">
                No expense categories to chart
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
