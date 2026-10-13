import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertTriangle,
  Receipt,
  X,
  Check,
} from 'lucide-react'
import { api } from '../../lib/api'
import type { Transaction } from '../../types'
import { formatCurrency, formatDate } from '../../lib/utils'

const CATEGORIES = [
  'All Categories',
  'Meals & Entertainment',
  'Office Supplies',
  'Software & Subscriptions',
  'Travel',
  'Utilities',
  'Professional Services',
  'Equipment',
  'Other',
]

const CURRENCIES = ['All Currencies', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']

export const TransactionsPage: React.FC = () => {
  const queryClient = useQueryClient()

  // Filters & Pagination State
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All Categories')
  const [currency, setCurrency] = useState('All Currencies')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [sortBy, setSortBy] = useState('transaction_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Modals
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', search, category, currency, page, pageSize, sortBy, sortOrder],
    queryFn: () =>
      api.getTransactions({
        search: search.trim() || undefined,
        category: category !== 'All Categories' ? category : undefined,
        currency: currency !== 'All Currencies' ? currency : undefined,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      }),
  })

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setDeletingTx(null)
    },
  })

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Transaction> }) =>
      api.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setEditingTx(null)
    },
  })

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTx) return

    updateMutation.mutate({
      id: editingTx.id,
      data: {
        merchant: editingTx.merchant,
        invoice_number: editingTx.invoice_number,
        transaction_date: editingTx.transaction_date,
        subtotal: editingTx.subtotal,
        tax: editingTx.tax,
        total: editingTx.total,
        currency: editingTx.currency,
        category: editingTx.category,
        payment_method: editingTx.payment_method,
        notes: editingTx.notes,
      },
    })
  }

  const exportUrl = api.getExportCsvUrl({
    category: category !== 'All Categories' ? category : undefined,
    currency: currency !== 'All Currencies' ? currency : undefined,
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transactions Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">
            Browse, filter, edit, and audit verified financial transaction entries.
          </p>
        </div>

        <a
          href={exportUrl}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-lg border border-slate-200 shadow-2xs transition-colors shrink-0"
        >
          <Download className="h-4 w-4" />
          <span>Export CSV</span>
        </a>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by merchant, invoice #, or notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600"
          />
        </div>

        {/* Category Filter */}
        <div className="w-full md:w-48">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600 bg-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Currency Filter */}
        <div className="w-full md:w-40">
          <select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value)
              setPage(1)
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600 bg-white"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                <th
                  onClick={() => {
                    setSortBy('transaction_date')
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  }}
                  className="py-3.5 px-4 cursor-pointer hover:text-slate-900 select-none"
                >
                  Date {sortBy === 'transaction_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-3.5 px-4">Merchant</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Invoice #</th>
                <th
                  onClick={() => {
                    setSortBy('total')
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  }}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  Total {sortBy === 'total' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Loading transactions...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-500">
                    <Receipt className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">No matching transactions found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try adjusting your search criteria or uploading a new receipt.
                    </p>
                  </td>
                </tr>
              ) : (
                data.items.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {formatDate(tx.transaction_date)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{tx.merchant}</div>
                      {tx.notes && (
                        <div className="text-xs text-slate-400 truncate max-w-xs">{tx.notes}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-xs">
                      {tx.invoice_number || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(tx.total, tx.currency)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tx.review_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => setEditingTx(tx)}
                          className="p-1.5 text-slate-400 hover:text-slate-800 rounded-md hover:bg-slate-100"
                          title="Edit transaction"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingTx(tx)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                          title="Delete transaction"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.total_pages > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing page <span className="font-bold">{data.page}</span> of{' '}
              <span className="font-bold">{data.total_pages}</span> ({data.total} total items)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= data.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-base text-slate-900">Edit Transaction Record</h3>
              <button onClick={() => setEditingTx(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Merchant</label>
                <input
                  type="text"
                  required
                  value={editingTx.merchant}
                  onChange={(e) => setEditingTx({ ...editingTx, merchant: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={editingTx.invoice_number || ''}
                    onChange={(e) => setEditingTx({ ...editingTx, invoice_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editingTx.transaction_date}
                    onChange={(e) => setEditingTx({ ...editingTx, transaction_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={editingTx.category}
                    onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {CATEGORIES.filter((c) => c !== 'All Categories').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingTx.total}
                    onChange={(e) => setEditingTx({ ...editingTx, total: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-bold border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editingTx.notes || ''}
                  onChange={(e) => setEditingTx({ ...editingTx, notes: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Delete Transaction?</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6">
              Are you sure you want to delete the record for{' '}
              <span className="font-bold text-slate-800">{deletingTx.merchant}</span> (
              {formatCurrency(deletingTx.total, deletingTx.currency)})? This action cannot be undone.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setDeletingTx(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingTx.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow-xs"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
