import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/utils'

export const ReceiptsPage: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'reviewed' | 'pending_review'>('all')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['receipts-gallery', filter, search],
    queryFn: () =>
      api.getTransactions({
        search: search.trim() || undefined,
        review_status: filter !== 'all' ? filter : undefined,
        page_size: 50,
      }),
  })

  const transactions = data?.items || []

  return (
    <div className="max-w-7xl mx-auto px-space-sm sm:px-space-md lg:px-space-xl py-space-md sm:py-space-lg space-y-space-md sm:space-y-space-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
        <div>
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
            <span>Local Encrypted Vault</span>
            <span>•</span>
            <span className="text-primary font-semibold">Offline Access</span>
          </div>
          <h1 className="font-display text-2xl sm:text-display text-on-surface tracking-tight mt-1">
            Receipts Archive
          </h1>
          <p className="font-body-sm sm:font-body-md text-on-surface-variant mt-1">
            Browse ingested receipts and invoices stored in your local computer filesystem.
          </p>
        </div>

        <Link
          to="/upload"
          className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-4 py-2.5 min-h-[44px] rounded-xl font-body-sm text-body-sm font-medium transition-all shadow-xs self-start sm:self-auto active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Upload Receipt</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest rounded-xl p-space-sm sm:p-space-md shadow-xs border border-outline-variant/30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Tabs */}
        <div className="flex items-center bg-surface-container-low p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
          {[
            ['all', 'All Receipts'],
            ['reviewed', 'Reviewed'],
            ['pending_review', 'Needs Review'],
          ].map(([fKey, fLabel]) => (
            <button
              key={fKey}
              onClick={() => setFilter(fKey as any)}
              className={`flex-1 md:flex-none px-3 sm:px-4 py-2 min-h-[40px] rounded-lg font-body-sm text-xs sm:text-body-sm transition-all font-medium whitespace-nowrap text-center ${
                filter === fKey
                  ? 'bg-surface-container-lowest text-primary shadow-xs font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {fLabel}
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-outline text-[18px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor or file..."
            className="w-full bg-surface-container-low pl-9 pr-3 py-2 min-h-[42px] rounded-xl text-body-sm font-body-sm text-on-surface placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary transition-all border border-transparent focus:border-primary"
          />
        </div>
      </div>

      {/* Receipts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-surface-container rounded-xl" />
          ))}
        </div>
      ) : transactions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-space-md shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-space-sm group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-low text-primary flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">
                      {tx.original_filename.endsWith('.pdf') ? 'picture_as_pdf' : 'image'}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-headline-sm text-body-md sm:text-headline-sm text-on-surface font-semibold truncate">
                      {tx.merchant}
                    </span>
                    <span className="font-label-caps text-[11px] text-outline font-mono truncate">
                      {tx.original_filename}
                    </span>
                  </div>
                </div>

                {tx.review_status === 'reviewed' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-secondary-container text-on-secondary-container font-medium shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                    Reviewed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-caps font-label-caps bg-tertiary-fixed text-on-tertiary-fixed-variant font-medium shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                    Needs Review
                  </span>
                )}
              </div>

              {/* Amount & Metadata */}
              <div className="py-2 border-y border-surface-container-low flex items-center justify-between text-body-sm">
                <div>
                  <span className="text-on-surface-variant font-label-caps text-label-caps uppercase block">
                    Total Invoiced
                  </span>
                  <span className="font-table-numeric text-lg sm:text-headline-sm font-semibold text-on-surface">
                    {formatCurrency(tx.total, tx.currency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-on-surface-variant font-label-caps text-label-caps uppercase block">
                    Tx Date
                  </span>
                  <span className="text-on-surface font-medium text-xs sm:text-body-sm">
                    {formatDate(tx.transaction_date)}
                  </span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-1 font-body-sm text-body-sm">
                <span className="font-label-caps text-label-caps text-on-surface-variant bg-surface-container px-2 py-0.5 rounded truncate max-w-[140px]">
                  {tx.category}
                </span>

                <div className="flex items-center gap-2">
                  <Link
                    to={`/transactions`}
                    className="inline-flex items-center gap-1 text-primary hover:text-primary-container font-medium text-xs py-1.5 px-2.5 rounded-lg hover:bg-surface-container transition-colors min-h-[36px]"
                  >
                    <span>Inspect Ledger</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-xl bg-surface-container-low text-primary flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[28px]">receipt_long</span>
          </div>
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              No receipts found
            </h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              {search || filter !== 'all'
                ? 'Try adjusting your filters or search keywords.'
                : 'Upload your first invoice or receipt to populate the local vault archive.'}
            </p>
          </div>
          <Link
            to="/upload"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-primary hover:bg-primary-container text-on-primary rounded-xl text-body-sm font-medium transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span>
            <span>Upload Receipt</span>
          </Link>
        </div>
      )}
    </div>
  )
}
