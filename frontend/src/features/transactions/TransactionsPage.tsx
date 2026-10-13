import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import type { Transaction } from '../../types'
import { formatCurrency, formatDate } from '../../lib/utils'

const CATEGORIES = [
  'All Categories',
  'Software & Subscriptions',
  'Hardware & Equipment',
  'Office Supplies & Stationery',
  'Travel & Transportation',
  'Client Meals & Entertainment',
  'Utilities & Services',
  'Professional Services',
  'Other',
]

const CURRENCIES = ['All Currencies', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']

export const TransactionsPage: React.FC = () => {
  const queryClient = useQueryClient()

  // Filters & Pagination State
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All Categories')
  const [currency, setCurrency] = useState('All Currencies')
  const [reviewStatus, setReviewStatus] = useState<'all' | 'reviewed' | 'pending_review'>('all')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(15)
  const [sortBy, setSortBy] = useState('transaction_date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Mobile Filter Drawer Toggle
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  // Modals
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', search, category, currency, reviewStatus, page, pageSize, sortBy, sortOrder],
    queryFn: () =>
      api.getTransactions({
        search: search.trim() || undefined,
        category: category !== 'All Categories' ? category : undefined,
        currency: currency !== 'All Currencies' ? currency : undefined,
        review_status: reviewStatus !== 'all' ? reviewStatus : undefined,
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

  const getCategoryIcon = (cat: string) => {
    const c = cat.toLowerCase()
    if (c.includes('software') || c.includes('tool') || c.includes('tech')) return 'terminal'
    if (c.includes('meal') || c.includes('food') || c.includes('coffee') || c.includes('restaurant'))
      return 'coffee'
    if (c.includes('hardware') || c.includes('equip') || c.includes('device')) return 'devices'
    if (c.includes('travel') || c.includes('transport') || c.includes('taxi')) return 'local_taxi'
    if (c.includes('office') || c.includes('supplies')) return 'inventory_2'
    return 'receipt'
  }

  const transactions = data?.items || []
  const total = data?.total || 0
  const totalPages = data?.total_pages || 1

  const activeFiltersCount =
    (category !== 'All Categories' ? 1 : 0) +
    (currency !== 'All Currencies' ? 1 : 0) +
    (reviewStatus !== 'all' ? 1 : 0) +
    (search ? 1 : 0)

  return (
    <div className="max-w-7xl mx-auto px-space-sm sm:px-space-md lg:px-space-xl py-space-md sm:py-space-lg space-y-space-md sm:space-y-space-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
            <span>Sovereign Financial Ledger</span>
            <span>•</span>
            <span className="text-primary font-semibold">Local SQLite DB</span>
          </div>
          <h1 className="font-display text-2xl sm:text-display text-on-surface tracking-tight mt-1">
            Transactions
          </h1>
          <p className="font-body-sm sm:font-body-md text-on-surface-variant mt-1">
            Confirmed audit records stored in your encrypted local database.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={exportUrl}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[44px] bg-surface-container-lowest hover:bg-surface-container-low text-on-surface border border-outline-variant/30 rounded-xl font-body-sm text-xs sm:text-body-sm font-medium transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px] text-outline">download</span>
            <span>Export CSV</span>
          </a>

          <Link
            to="/upload"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-primary hover:bg-primary-container text-on-primary rounded-xl font-body-sm text-xs sm:text-body-sm font-medium transition-all shadow-xs active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Upload receipt</span>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar: Responsive on Mobile & Desktop */}
      <div className="bg-surface-container-lowest rounded-xl p-space-sm sm:p-space-md shadow-xs border border-outline-variant/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search merchant, notes, invoice #..."
              className="w-full bg-surface-container-low pl-9 pr-8 py-2 min-h-[42px] rounded-xl text-body-sm font-body-sm text-on-surface placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary transition-all border border-transparent focus:border-primary"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>

          {/* Mobile Filter Sheet Toggle Button (Visible on phones < md) */}
          <button
            type="button"
            onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
            className={`md:hidden inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[42px] rounded-xl border text-body-sm font-medium transition-colors ${
              activeFiltersCount > 0
                ? 'border-primary bg-primary/10 text-primary font-semibold'
                : 'border-outline-variant/40 bg-surface-container-low text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Desktop/Tablet Filter Selectors (Hidden on phones < md) */}
        <div className="hidden md:flex flex-wrap items-center gap-space-sm">
          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            className="bg-surface-container-low text-on-surface px-3 py-2 min-h-[40px] rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-transparent focus:border-primary"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Currency Filter */}
          <select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value)
              setPage(1)
            }}
            className="bg-surface-container-low text-on-surface px-3 py-2 min-h-[40px] rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-transparent focus:border-primary"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={reviewStatus}
            onChange={(e) => {
              setReviewStatus(e.target.value as any)
              setPage(1)
            }}
            className="bg-surface-container-low text-on-surface px-3 py-2 min-h-[40px] rounded-lg font-body-sm text-body-sm focus:outline-none focus:ring-1 focus:ring-primary border border-transparent focus:border-primary"
          >
            <option value="all">All Statuses</option>
            <option value="reviewed">Reviewed</option>
            <option value="pending_review">Needs Review</option>
          </select>

          {/* Clear Filters button */}
          {activeFiltersCount > 0 && (
            <button
              onClick={() => {
                setSearch('')
                setCategory('All Categories')
                setCurrency('All Currencies')
                setReviewStatus('all')
                setPage(1)
              }}
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1 min-h-[36px]"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer (Expandable Sheet on phones) */}
      {mobileFilterOpen && (
        <div className="md:hidden bg-surface-container-lowest rounded-xl p-space-md shadow-md border border-outline-variant/30 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 border-b border-surface-container">
            <span className="font-headline-sm text-body-md font-semibold text-on-surface">
              Filter &amp; Sort Ledger
            </span>
            <button
              type="button"
              onClick={() => setMobileFilterOpen(false)}
              className="p-1 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="font-label-md text-xs text-on-surface-variant block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-surface-container-low text-on-surface px-3 py-2.5 min-h-[44px] rounded-xl text-body-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-label-md text-xs text-on-surface-variant block mb-1">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value)
                  setPage(1)
                }}
                className="w-full bg-surface-container-low text-on-surface px-3 py-2.5 min-h-[44px] rounded-xl text-body-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-label-md text-xs text-on-surface-variant block mb-1">
                Review Status
              </label>
              <select
                value={reviewStatus}
                onChange={(e) => {
                  setReviewStatus(e.target.value as any)
                  setPage(1)
                }}
                className="w-full bg-surface-container-low text-on-surface px-3 py-2.5 min-h-[44px] rounded-xl text-body-sm"
              >
                <option value="all">All Statuses</option>
                <option value="reviewed">Reviewed</option>
                <option value="pending_review">Needs Review</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="font-label-md text-xs text-on-surface-variant block mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full bg-surface-container-low text-on-surface px-3 py-2 min-h-[42px] rounded-xl text-body-sm"
                >
                  <option value="transaction_date">Date</option>
                  <option value="merchant">Merchant</option>
                  <option value="total">Amount</option>
                </select>
              </div>

              <div>
                <label className="font-label-md text-xs text-on-surface-variant block mb-1">
                  Direction
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  className="w-full bg-surface-container-low text-on-surface px-3 py-2 min-h-[42px] rounded-xl text-body-sm"
                >
                  <option value="desc">Newest / High</option>
                  <option value="asc">Oldest / Low</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-surface-container">
              <button
                type="button"
                onClick={() => {
                  setCategory('All Categories')
                  setCurrency('All Currencies')
                  setReviewStatus('all')
                  setSearch('')
                  setPage(1)
                }}
                className="text-xs text-on-surface-variant hover:text-on-surface font-medium min-h-[40px] px-2"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-semibold min-h-[40px]"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE FEED: Responsive Transaction Cards (Visible on phones < md) */}
      <div className="block md:hidden space-y-3">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-surface-container rounded-xl" />
            ))}
          </div>
        ) : transactions.length > 0 ? (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-space-md shadow-xs flex flex-col gap-2.5"
            >
              {/* Header: Vendor, Category Icon & Status Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                    <span className="material-symbols-outlined text-[18px]">
                      {getCategoryIcon(tx.category)}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-body-md text-on-surface truncate">
                      {tx.merchant}
                    </span>
                    <span className="text-[11px] text-outline font-mono truncate">
                      {tx.invoice_number ? `#${tx.invoice_number}` : tx.original_filename}
                    </span>
                  </div>
                </div>

                {tx.review_status === 'reviewed' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-label-caps bg-secondary-container text-on-secondary-container font-medium shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Reviewed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-label-caps bg-tertiary-fixed text-on-tertiary-fixed-variant font-medium shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                    Needs review
                  </span>
                )}
              </div>

              {/* Amount, Date & Category */}
              <div className="py-2 border-y border-surface-container-low flex items-center justify-between text-body-sm">
                <div>
                  <span className="text-on-surface-variant text-[11px] font-label-caps uppercase block">
                    Amount
                  </span>
                  <span className="font-table-numeric text-headline-sm font-semibold text-on-surface">
                    {formatCurrency(tx.total, tx.currency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-on-surface-variant text-[11px] font-label-caps uppercase block">
                    Date
                  </span>
                  <span className="text-on-surface font-medium text-xs">
                    {formatDate(tx.transaction_date)}
                  </span>
                </div>
              </div>

              {/* Bottom Actions: Edit, Delete, or Audit */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-label-caps text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded truncate max-w-[130px]">
                  {tx.category}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingTx(tx)}
                    className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors"
                    title="Edit Record"
                    aria-label={`Edit ${tx.merchant}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>

                  <button
                    onClick={() => setDeletingTx(tx)}
                    className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container rounded-lg transition-colors"
                    title="Delete Record"
                    aria-label={`Delete ${tx.merchant}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl border border-outline-variant/30 space-y-2">
            <span className="material-symbols-outlined text-[32px] text-outline">receipt</span>
            <p className="font-body-sm">No transactions match your criteria.</p>
          </div>
        )}
      </div>

      {/* DESKTOP/TABLET TABLE: Preserved Efficient Data Table (Hidden on phones < md) */}
      <div className="hidden md:block bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
                <th
                  onClick={() => {
                    setSortBy('merchant')
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  }}
                  className="py-3 px-space-md sm:px-space-lg font-semibold cursor-pointer hover:text-on-surface"
                >
                  <div className="flex items-center gap-1">
                    <span>Merchant</span>
                    {sortBy === 'merchant' && (
                      <span className="material-symbols-outlined text-[14px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>
                <th
                  onClick={() => {
                    setSortBy('transaction_date')
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  }}
                  className="py-3 px-space-sm font-semibold cursor-pointer hover:text-on-surface"
                >
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    {sortBy === 'transaction_date' && (
                      <span className="material-symbols-outlined text-[14px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-space-sm font-semibold">Category</th>
                <th className="py-3 px-space-sm font-semibold">Invoice #</th>
                <th
                  onClick={() => {
                    setSortBy('total')
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  }}
                  className="py-3 px-space-sm font-semibold text-right cursor-pointer hover:text-on-surface"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Amount</span>
                    {sortBy === 'total' && (
                      <span className="material-symbols-outlined text-[14px]">
                        {sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="py-3 px-space-sm font-semibold">Status</th>
                <th className="py-3 px-space-md sm:px-space-lg font-semibold text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-on-surface-variant font-body-sm"
                  >
                    Loading transactions...
                  </td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface transition-colors group">
                    <td className="py-3.5 px-space-md sm:px-space-lg font-medium text-on-surface">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant group-hover:bg-surface-container-high transition-colors shrink-0">
                          <span className="material-symbols-outlined text-[18px]">
                            {getCategoryIcon(tx.category)}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-on-surface truncate">
                            {tx.merchant}
                          </span>
                          <span className="text-[11px] text-outline font-mono truncate">
                            {tx.original_filename}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-space-sm text-on-surface-variant whitespace-nowrap">
                      {formatDate(tx.transaction_date)}
                    </td>

                    <td className="py-3.5 px-space-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-label-caps text-label-caps bg-surface-container text-on-surface-variant">
                        {tx.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-space-sm text-outline font-mono text-[12px]">
                      {tx.invoice_number || '—'}
                    </td>

                    <td className="py-3.5 px-space-sm text-right font-table-numeric font-semibold text-on-surface whitespace-nowrap">
                      {formatCurrency(tx.total, tx.currency)}
                    </td>

                    <td className="py-3.5 px-space-sm whitespace-nowrap">
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

                    <td className="py-3.5 px-space-md sm:px-space-lg text-right">
                      <div className="flex items-center justify-end gap-1 text-outline">
                        <button
                          onClick={() => setEditingTx(tx)}
                          className="p-1 hover:text-on-surface hover:bg-surface-container rounded transition-colors"
                          title="Edit Transaction"
                        >
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>

                        <button
                          onClick={() => setDeletingTx(tx)}
                          className="p-1 hover:text-error hover:bg-error-container rounded transition-colors"
                          title="Delete Record"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-on-surface-variant font-body-sm"
                  >
                    No transactions match the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer: Touch friendly on all screens */}
      {total > pageSize && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-space-sm sm:p-space-md flex flex-col sm:flex-row items-center justify-between gap-3 font-body-sm text-body-sm text-on-surface-variant">
          <span className="text-xs sm:text-body-sm text-center sm:text-left">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} records
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              className="px-4 py-2 min-h-[42px] rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-40 transition-colors font-medium text-xs sm:text-body-sm"
            >
              Previous
            </button>
            <span className="px-3 font-medium font-table-numeric text-on-surface text-xs sm:text-body-sm">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              className="px-4 py-2 min-h-[42px] rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface disabled:opacity-40 transition-colors font-medium text-xs sm:text-body-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-inverse-surface/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest max-w-lg w-full max-h-[92vh] overflow-y-auto rounded-2xl shadow-lg border border-outline-variant/40 p-space-md sm:p-space-lg space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Edit Transaction Metadata
              </h3>
              <button
                onClick={() => setEditingTx(null)}
                className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3 font-body-sm text-body-sm">
              <div>
                <label className="font-label-md text-label-md text-on-surface block mb-1">
                  Merchant
                </label>
                <input
                  type="text"
                  value={editingTx.merchant}
                  onChange={(e) => setEditingTx({ ...editingTx, merchant: e.target.value })}
                  className="w-full bg-surface-container-low px-3 py-2.5 min-h-[42px] rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-label-md text-label-md text-on-surface block mb-1">
                    Invoice #
                  </label>
                  <input
                    type="text"
                    value={editingTx.invoice_number || ''}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, invoice_number: e.target.value })
                    }
                    className="w-full bg-surface-container-low px-3 py-2.5 min-h-[42px] rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editingTx.transaction_date}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, transaction_date: e.target.value })
                    }
                    className="w-full bg-surface-container-low px-3 py-2 min-h-[42px] rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-label-md text-label-md text-on-surface block mb-1">
                    Subtotal
                  </label>
                  <input
                    type="text"
                    value={editingTx.subtotal}
                    onChange={(e) => setEditingTx({ ...editingTx, subtotal: e.target.value })}
                    className="w-full bg-surface-container-low px-3 py-2.5 min-h-[42px] rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-table-numeric"
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface block mb-1">
                    Tax
                  </label>
                  <input
                    type="text"
                    value={editingTx.tax}
                    onChange={(e) => setEditingTx({ ...editingTx, tax: e.target.value })}
                    className="w-full bg-surface-container-low px-3 py-2.5 min-h-[42px] rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary font-table-numeric"
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface block mb-1 font-semibold">
                    Total
                  </label>
                  <input
                    type="text"
                    value={editingTx.total}
                    onChange={(e) => setEditingTx({ ...editingTx, total: e.target.value })}
                    className="w-full bg-surface-container-low px-3 py-2.5 min-h-[42px] rounded-xl text-primary font-bold focus:outline-none focus:ring-2 focus:ring-primary font-table-numeric"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface block mb-1">
                  Category
                </label>
                <select
                  value={editingTx.category}
                  onChange={(e) => setEditingTx({ ...editingTx, category: e.target.value })}
                  className="w-full bg-surface-container-low px-3 py-2.5 min-h-[42px] rounded-xl text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIES.filter((c) => c !== 'All Categories').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-surface-container flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2.5 min-h-[42px] rounded-xl hover:bg-surface-container text-on-surface-variant font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-5 py-2.5 min-h-[42px] bg-primary hover:bg-primary-container text-on-primary rounded-xl font-medium transition-all shadow-xs"
                >
                  {updateMutation.isPending ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-inverse-surface/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl shadow-lg border border-outline-variant/40 p-space-md sm:p-space-lg space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-outlined text-[28px]">warning</span>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                Confirm Record Deletion
              </h3>
            </div>

            <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
              Are you sure you want to delete the transaction from{' '}
              <strong className="text-on-surface">{deletingTx.merchant}</strong> for{' '}
              <strong className="text-on-surface">
                {formatCurrency(deletingTx.total, deletingTx.currency)}
              </strong>
              ? This will remove the record from your local database.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingTx(null)}
                className="px-4 py-2.5 min-h-[42px] rounded-xl hover:bg-surface-container text-on-surface-variant font-medium text-xs sm:text-body-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingTx.id)}
                className="px-5 py-2.5 min-h-[42px] bg-error hover:bg-error-container hover:text-on-error-container text-on-error rounded-xl font-medium text-xs sm:text-body-sm transition-colors"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
