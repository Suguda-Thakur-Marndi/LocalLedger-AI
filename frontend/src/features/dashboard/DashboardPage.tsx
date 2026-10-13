import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  UploadCloud,
  TrendingUp,
  Receipt,
  CreditCard,
  ArrowRight,
  Inbox,
  Calendar,
  AlertCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { api } from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/utils'

const CATEGORY_COLORS = [
  '#059669', // emerald-600
  '#0284c7', // sky-600
  '#d97706', // amber-600
  '#7c3aed', // violet-600
  '#db2777', // pink-600
  '#475569', // slate-600
  '#14b8a6', // teal-500
  '#ea580c', // orange-600
]

export const DashboardPage: React.FC = () => {
  const [period, setPeriod] = useState<'30d' | '90d' | 'year' | 'all'>('all')

  const getDateRange = () => {
    const now = new Date()
    if (period === '30d') {
      const past = new Date()
      past.setDate(now.getDate() - 30)
      return { start: past.toISOString().split('T')[0], end: now.toISOString().split('T')[0] }
    }
    if (period === '90d') {
      const past = new Date()
      past.setDate(now.getDate() - 90)
      return { start: past.toISOString().split('T')[0], end: now.toISOString().split('T')[0] }
    }
    if (period === 'year') {
      const past = new Date(now.getFullYear(), 0, 1)
      return { start: past.toISOString().split('T')[0], end: now.toISOString().split('T')[0] }
    }
    return { start: undefined, end: undefined }
  }

  const { start, end } = getDateRange()

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['dashboard-summary', start, end],
    queryFn: () => api.getDashboardSummary(start, end),
  })

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
          <div className="h-32 bg-slate-200 rounded-xl" />
        </div>
        <div className="h-72 bg-slate-200 rounded-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
        <AlertCircle className="h-6 w-6 shrink-0" />
        <div>
          <h3 className="font-semibold">Failed to load dashboard metrics</h3>
          <p className="text-sm mt-0.5">Please check if the backend service is running.</p>
        </div>
      </div>
    )
  }

  const hasData = summary && summary.total_transactions > 0

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header & Period Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time expenses computed securely from your private local database.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs font-medium shadow-2xs">
            {(
              [
                ['30d', '30 Days'],
                ['90d', '90 Days'],
                ['year', 'This Year'],
                ['all', 'All Time'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  period === key
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Upload Receipt</span>
          </Link>
        </div>
      </div>

      {!hasData ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-xs">
          <div className="h-16 w-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-brand-100">
            <Inbox className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">No Transactions Recorded Yet</h2>
          <p className="text-sm text-slate-500 mt-2 mb-6 leading-relaxed">
            LocalLedger stores your financial data entirely on your computer. Upload your first
            invoice or receipt to extract merchant details, line items, and totals automatically.
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Upload Your First Document</span>
          </Link>
        </div>
      ) : (
        <>
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Currency Totals */}
            {summary.currency_totals.map((curr) => (
              <div
                key={curr.currency}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Total Spend ({curr.currency})
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(curr.total_amount, curr.currency)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Avg {formatCurrency(curr.average_amount, curr.currency)} across {curr.transaction_count} tx
                  </div>
                </div>
              </div>
            ))}

            {/* Total Receipts */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Documents Ingested</span>
                <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Receipt className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-slate-900">
                  {summary.total_receipts}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Stored securely in local data directory
                </div>
              </div>
            </div>

            {/* Total Transactions */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Confirmed Records</span>
                <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <CreditCard className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl font-bold text-slate-900">
                  {summary.total_transactions}
                </div>
                <div className="text-xs text-slate-500 mt-1">Verified ledger entries</div>
              </div>
            </div>
          </div>

          {/* Visual Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Trend Area Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Monthly Spending Trend</h2>
                  <p className="text-xs text-slate-500">Historical spend trajectory over time</p>
                </div>
              </div>
              <div className="h-64 w-full">
                {summary.monthly_trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={summary.monthly_trends}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(val: any, _name: any, item: any) => [
                          formatCurrency(val, item.payload.currency),
                          'Spend',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="total_amount"
                        stroke="#059669"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorSpend)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-400">
                    Not enough monthly data points yet
                  </div>
                )}
              </div>
            </div>

            {/* Category Breakdown Donut Chart */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Spending by Category</h2>
                <p className="text-xs text-slate-500 mb-4">Expense distribution breakdown</p>
              </div>
              <div className="h-60 w-full">
                {summary.categories.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={summary.categories}
                        dataKey="total_amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {summary.categories.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(val: any, name: any, item: any) => [
                          formatCurrency(val, item.payload.currency),
                          name,
                        ]}
                      />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-400">
                    No categories registered
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Transactions Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
                <p className="text-xs text-slate-500">Latest confirmed financial records</p>
              </div>
              <Link
                to="/transactions"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Merchant</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.recent_transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {formatDate(tx.transaction_date)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {tx.merchant}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-xs">
                        {tx.invoice_number || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(tx.total, tx.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
