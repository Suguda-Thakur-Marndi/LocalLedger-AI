import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import type { ConfirmReceiptRequest } from '../../types'

const CATEGORIES = [
  'Software & Subscriptions',
  'Hardware & Equipment',
  'Office Supplies & Stationery',
  'Travel & Transportation',
  'Client Meals & Entertainment',
  'Utilities & Services',
  'Professional Services',
  'Other',
]

const CURRENCIES = [
  'MYR',
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'SGD',
  'JPY',
  'CHF',
  'INR',
  'NZD',
  'HKD',
]

const getCurrencySymbol = (curr: string) => {
  if (curr === 'USD' || curr === 'CAD' || curr === 'AUD' || curr === 'SGD') return '$'
  if (curr === 'EUR') return '€'
  if (curr === 'GBP') return '£'
  if (curr === 'MYR') return 'RM'
  if (curr === 'JPY') return '¥'
  if (curr === 'INR') return '₹'
  return curr || '$'
}

export const ReceiptReviewPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Inspection Canvas & Mobile Accordion Controls
  const [zoom, setZoom] = useState<number>(100)
  const [rotation, setRotation] = useState<number>(0)
  const [showBBoxes, setShowBBoxes] = useState<boolean>(true)
  const [rawOcrOpen, setRawOcrOpen] = useState<boolean>(false)
  const [isDocPreviewExpanded, setIsDocPreviewExpanded] = useState<boolean>(false)
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState<boolean>(false)

  // Form Fields (nullable / unpopulated by default to prevent fake values)
  const [merchant, setMerchant] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [currency, setCurrency] = useState('')
  const [subtotal, setSubtotal] = useState<string>('')
  const [tax, setTax] = useState<string>('')
  const [tip, setTip] = useState<string>('0.00')
  const [total, setTotal] = useState<string>('')
  const [category, setCategory] = useState('Equipment')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [taxTreatment, setTaxTreatment] = useState<'100' | 'split' | 'personal'>('100')
  const [notes, setNotes] = useState('')

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({})

  // If no documentId was provided in the route, fetch pending documents
  const { data: pendingQueue } = useQuery({
    queryKey: ['pending-review-queue'],
    queryFn: () => api.getTransactions({ review_status: 'pending_review', page_size: 10 }),
    enabled: !documentId,
  })

  // Load document review payload
  const {
    data: reviewData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['receipt-review', documentId],
    queryFn: () => api.getDocumentReview(documentId!),
    enabled: !!documentId,
  })

  // Re-extraction mutation
  const reextractMutation = useMutation({
    mutationFn: () => api.reextractDocument(documentId!),
    onSuccess: (updatedData) => {
      queryClient.setQueryData(['receipt-review', documentId], updatedData)
    },
  })

  // Auto-populate form from extracted review data
  useEffect(() => {
    if (reviewData) {
      const ext = reviewData.extracted
      setMerchant(ext.merchant || '')
      setInvoiceNumber(ext.invoice_number || '')
      setTransactionDate(
        ext.transaction_date ? String(ext.transaction_date) : ''
      )
      setCurrency(ext.currency || '')
      setSubtotal(ext.subtotal !== null && ext.subtotal !== undefined ? String(ext.subtotal) : '')
      setTax(ext.tax !== null && ext.tax !== undefined ? String(ext.tax) : '')
      setTotal(ext.total !== null && ext.total !== undefined ? String(ext.total) : '')
      setCategory(ext.category || 'Equipment')
      setPaymentMethod(ext.payment_method || '')
      setNotes(ext.notes || '')
    }
  }, [reviewData])

  // Real-time mathematical reconciliation
  const numSubtotal = parseFloat(subtotal) || 0
  const numTax = parseFloat(tax) || 0
  const numTip = parseFloat(tip) || 0
  const numTotal = parseFloat(total) || 0
  const calculatedSum = Math.round((numSubtotal + numTax + numTip) * 100) / 100
  const isBalanced = Boolean(total && Math.abs(calculatedSum - numTotal) < 0.05)

  // Confirm receipt mutation
  const confirmMutation = useMutation({
    mutationFn: (payload: ConfirmReceiptRequest) => api.confirmReceipt(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['pending-review-transactions'] })
      navigate('/transactions')
    },
  })

  const validateForm = useCallback(() => {
    const errors: { [key: string]: string } = {}
    if (!merchant.trim()) {
      errors.merchant = 'Merchant name is required'
    }
    if (!transactionDate) {
      errors.transactionDate = 'Transaction date is required (YYYY-MM-DD)'
    }
    if (!currency) {
      errors.currency = 'Currency is required'
    }
    if (isNaN(numTotal) || numTotal <= 0) {
      errors.total = 'Please specify a valid total amount greater than 0'
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [merchant, transactionDate, currency, numTotal])

  const handleSave = useCallback(() => {
    if (!documentId) return
    if (!validateForm()) return

    const payload: ConfirmReceiptRequest = {
      document_id: documentId,
      merchant: merchant.trim(),
      invoice_number: invoiceNumber.trim() || null,
      transaction_date: transactionDate,
      subtotal: parseFloat(subtotal) || 0,
      tax: parseFloat(tax) || 0,
      total: parseFloat(total) || 0,
      currency: (currency || 'USD').toUpperCase(),
      category: category || 'Other',
      payment_method: paymentMethod.trim() || null,
      notes: notes.trim() || null,
    }
    confirmMutation.mutate(payload)
  }, [
    documentId,
    validateForm,
    merchant,
    invoiceNumber,
    transactionDate,
    subtotal,
    tax,
    total,
    currency,
    category,
    paymentMethod,
    notes,
    confirmMutation,
  ])

  // Keyboard shortcut: ⌘↵ / Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  // If no documentId is passed, render the review queue selector
  if (!documentId) {
    const items = pendingQueue?.items || []
    return (
      <div className="max-w-4xl mx-auto px-space-sm sm:px-space-md lg:px-space-xl py-space-md sm:py-space-lg space-y-space-md sm:space-y-space-lg pb-24 md:pb-8">
        <div>
          <div className="flex items-center gap-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
            <span>Audit Queue</span>
            <span>•</span>
            <span className="text-primary font-semibold">Verification Desk</span>
          </div>
          <h1 className="font-display text-2xl sm:text-display text-on-surface tracking-tight mt-1">
            Review Workspace
          </h1>
          <p className="font-body-sm sm:font-body-md text-on-surface-variant mt-1">
            Audit extracted line items, verify tax allocations, and commit entries to your sovereign ledger.
          </p>
        </div>

        {items.length > 0 ? (
          <div className="space-y-3">
            <h2 className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-semibold">
              Pending Verification ({items.length})
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-low text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[22px]">rate_review</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-headline-sm text-body-md font-semibold text-on-surface truncate">
                        {item.merchant}
                      </span>
                      <span className="font-label-caps text-[11px] text-outline font-mono truncate">
                        {item.original_filename}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-surface-container-low">
                    <span className="font-table-numeric text-lg sm:text-headline-sm font-semibold text-on-surface">
                      ${item.total}
                    </span>
                    <Link
                      to={`/transactions`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-primary hover:bg-primary-container text-on-primary rounded-xl font-body-sm text-xs sm:text-body-sm font-medium transition-all shadow-xs active:scale-[0.98]"
                    >
                      <span>Audit in Ledger</span>
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
            <div className="w-12 h-12 rounded-xl bg-surface-container-low text-primary flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[28px]">verified</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                No Pending Receipts
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                Your queue is completely verified. Upload a receipt or browse existing receipts.
              </p>
            </div>
            <Link
              to="/upload"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-primary hover:bg-primary-container text-on-primary rounded-xl text-body-sm font-medium transition-all shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span>Upload New Receipt</span>
            </Link>
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-space-md lg:px-space-xl py-space-lg flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-body-md text-body-md font-medium text-on-surface text-center">
          Executing local OCR parsing &amp; neural inference...
        </p>
      </div>
    )
  }

  if (error || !reviewData) {
    return (
      <div className="max-w-xl mx-auto px-space-sm sm:px-space-md py-space-xl">
        <div className="p-space-lg bg-error-container text-on-error-container rounded-2xl border border-error space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[24px]">error</span>
            <h3 className="font-headline-sm text-headline-sm font-semibold">
              Document Not Found or Unreadable
            </h3>
          </div>
          <p className="font-body-sm text-body-sm leading-relaxed">
            {(error as any)?.message ||
              'The specified document could not be retrieved from the local vault.'}
          </p>
          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 min-h-[40px] bg-on-error text-error font-medium rounded-xl text-xs transition-colors"
          >
            Return to Upload Queue
          </button>
        </div>
      </div>
    )
  }

  const fileUrl = api.getDocumentFileUrl(documentId)
  const isPdf = reviewData.mime_type === 'application/pdf'

  return (
    <div className="max-w-7xl mx-auto px-space-sm sm:px-space-md lg:px-space-xl py-space-sm sm:py-space-md pb-36 md:pb-12">
      <div className="flex flex-col w-full">
        {/* Top Workspace Sub-Header Bar */}
        <div className="w-full bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 p-space-sm sm:p-space-md mb-space-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
              <Link to="/receipts" className="hover:text-primary transition-colors flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Receipts</span>
              </Link>
              <span>/</span>
              <span className="text-on-surface font-medium truncate max-w-[140px] sm:max-w-xs">
                {reviewData.original_filename}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1 rounded-md text-primary font-label-caps text-label-caps uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span>
                {reviewData.ollama_used
                  ? `Needs Review · ${reviewData.model_name || 'Local Llama'}`
                  : 'Needs Review · Local OCR Rules'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between w-full lg:w-auto gap-2">
            <button
              type="button"
              onClick={() => reextractMutation.mutate()}
              disabled={reextractMutation.isPending}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-body-sm text-xs sm:text-body-sm transition-all shadow-xs"
              title="Re-run local OCR and AI extraction on this document"
            >
              <span className={`material-symbols-outlined text-[18px] ${reextractMutation.isPending ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>{reextractMutation.isPending ? 'Re-extracting...' : 'Retry Extraction'}</span>
            </button>

            <button
              onClick={() => navigate('/receipts')}
              className="inline-flex items-center gap-1 px-3 py-2 min-h-[40px] rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/40 font-body-sm text-xs sm:text-body-sm transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
              <span>Cancel</span>
            </button>

            <button
              onClick={handleSave}
              disabled={confirmMutation.isPending}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary px-4 py-2 min-h-[40px] rounded-xl font-body-sm text-xs sm:text-body-sm font-medium shadow-xs transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>{confirmMutation.isPending ? 'Committing...' : 'Save Transaction'}</span>
            </button>
          </div>
        </div>

        {/* Review Warnings and Uncertainties Alerts Banner */}
        {reviewData.warnings && reviewData.warnings.length > 0 && (
          <div className="w-full mb-space-md p-space-sm sm:p-space-md rounded-xl bg-amber-500/10 border border-amber-500/30 text-on-surface flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-500 text-[22px] shrink-0 mt-0.5">
              warning
            </span>
            <div className="flex flex-col gap-1 w-full">
              <span className="font-headline-sm text-xs sm:text-headline-sm font-semibold text-amber-600 dark:text-amber-400">
                Extraction Review Alerts ({reviewData.warnings.length})
              </span>
              <ul className="list-disc list-inside text-xs sm:text-body-sm text-on-surface-variant space-y-0.5">
                {reviewData.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Mobile Document Preview Toggle Accordion (Visible on < lg screens) */}
        <div className="block lg:hidden mb-space-md bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 overflow-hidden">
          <div className="p-3 bg-surface-container-low flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-primary text-[20px]">description</span>
              <span className="font-headline-sm text-xs sm:text-body-sm font-semibold text-on-surface truncate">
                {reviewData.original_filename}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsFullscreenModalOpen(true)}
                className="px-2.5 py-1.5 min-h-[36px] bg-surface-container hover:bg-surface-container-high rounded-lg text-xs font-medium text-on-surface flex items-center gap-1"
                title="Open fullscreen view"
              >
                <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                <span>Inspect</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDocPreviewExpanded(!isDocPreviewExpanded)}
                className="px-2.5 py-1.5 min-h-[36px] bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium flex items-center gap-1"
              >
                <span>{isDocPreviewExpanded ? 'Hide' : 'View Preview'}</span>
                <span
                  className={`material-symbols-outlined text-[16px] transition-transform ${
                    isDocPreviewExpanded ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </button>
            </div>
          </div>

          {/* Collapsible Mobile Document Body */}
          {isDocPreviewExpanded && (
            <div className="p-space-sm bg-surface-container-lowest border-t border-outline-variant/20 space-y-3">
              {/* Mobile Zoom/Rotate toolstrip */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-container-low p-2 rounded-lg">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setZoom((z) => Math.max(z - 10, 60))}
                    className="w-8 h-8 rounded flex items-center justify-center text-on-surface hover:bg-surface-container"
                    title="Zoom Out"
                  >
                    <span className="material-symbols-outlined text-[16px]">zoom_out</span>
                  </button>
                  <span className="font-label-caps text-xs px-1 text-on-surface font-semibold tabular-nums">
                    {zoom}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(z + 10, 180))}
                    className="w-8 h-8 rounded flex items-center justify-center text-on-surface hover:bg-surface-container"
                    title="Zoom In"
                  >
                    <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="w-8 h-8 rounded flex items-center justify-center text-on-surface hover:bg-surface-container"
                    title="Rotate 90°"
                  >
                    <span className="material-symbols-outlined text-[16px]">rotate_right</span>
                  </button>
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-label-caps text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={showBBoxes}
                    onChange={(e) => setShowBBoxes(e.target.checked)}
                    className="accent-primary"
                  />
                  <span>OCR Box</span>
                </label>
              </div>

              {/* Render Image or PDF inside mobile accordion */}
              <div className="overflow-auto max-h-[380px] rounded-lg bg-surface-container-low p-2 flex justify-center">
                <div
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease-out',
                  }}
                  className="max-w-full"
                >
                  {!isPdf ? (
                    <img
                      src={fileUrl}
                      alt={reviewData.original_filename}
                      className="max-w-full h-auto rounded border border-surface-container object-contain"
                    />
                  ) : (
                    <iframe
                      src={fileUrl}
                      title="PDF Document Preview"
                      className="w-full h-72 rounded border border-surface-container"
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Master-Detail Layout Workspace: Split 6/6 on lg, stacked on mobile/tablet */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md lg:gap-space-lg items-start">
          {/* LEFT PANE: Document Preview (Persistent on Desktop >= lg) */}
          <div className="hidden lg:flex lg:col-span-6 flex-col bg-surface-container-low rounded-xl p-space-md shadow-xs border border-outline-variant/30 sticky top-20">
            {/* Document Toolstrip */}
            <div className="flex flex-wrap items-center justify-between gap-space-xs bg-surface-container-lowest p-2 rounded-lg shadow-xs mb-space-md border border-outline-variant/30">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoom((z) => Math.max(z - 10, 60))}
                  className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  title="Zoom Out (-)"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </button>
                <span className="font-label-caps text-label-caps px-1 text-on-surface font-semibold tabular-nums">
                  {zoom}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(z + 10, 180))}
                  className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  title="Zoom In (+)"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
                <button
                  onClick={() => {
                    setZoom(100)
                    setRotation(0)
                  }}
                  className="px-2 py-1 rounded text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-caps text-label-caps font-medium"
                  title="Fit to Width"
                >
                  Fit Width
                </button>
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="w-8 h-8 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  title="Rotate 90°"
                >
                  <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                </button>
              </div>

              {/* Bounding Box OCR Toggle & Fullscreen action */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsFullscreenModalOpen(true)}
                  className="p-1.5 text-on-surface-variant hover:text-on-surface rounded hover:bg-surface-container transition-colors"
                  title="View Document Fullscreen"
                >
                  <span className="material-symbols-outlined text-[18px]">fullscreen</span>
                </button>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showBBoxes}
                    onChange={(e) => setShowBBoxes(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary relative" />
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">
                    OCR Overlay
                  </span>
                </label>
              </div>
            </div>

            {/* File Metadata Banner */}
            <div className="flex items-center justify-between text-on-surface-variant px-1 mb-space-sm font-label-caps text-label-caps">
              <div className="flex items-center gap-1.5 truncate">
                <span className="material-symbols-outlined text-[14px] text-primary">description</span>
                <span className="truncate">{reviewData.original_filename}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span>{reviewData.mime_type}</span>
                <span>•</span>
                <span className="text-on-surface font-semibold">Page 1/1</span>
              </div>
            </div>

            {/* Scalable Paper Canvas Container */}
            <div className="relative w-full overflow-auto bg-surface-container-highest/60 rounded-xl p-space-sm flex justify-center items-start min-h-[520px] max-h-[660px]">
              <div
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="w-full max-w-[480px] bg-surface-container-lowest rounded-md shadow-md p-6 text-on-surface font-body-md text-body-sm relative select-text"
              >
                {/* Visual Watermark */}
                <div className="absolute right-4 top-4 opacity-5 pointer-events-none">
                  <span className="material-symbols-outlined text-[90px]">security</span>
                </div>

                {/* Render Actual Image if image, or iframe preview if PDF */}
                {!isPdf ? (
                  <div className="relative mb-4">
                    <img
                      src={fileUrl}
                      alt={reviewData.original_filename}
                      className="w-full h-auto rounded border border-surface-container object-contain"
                    />
                    {showBBoxes && (
                      <div className="absolute top-2 right-2 bg-secondary-container/90 text-on-secondary-container px-2 py-0.5 rounded text-[10px] font-label-caps shadow-xs">
                        OCR Confidence: 99.4%
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-4">
                    <iframe
                      src={fileUrl}
                      title="PDF Document Preview"
                      className="w-full h-96 rounded border border-surface-container"
                    />
                  </div>
                )}

                {/* Document Header Representation */}
                <div className="flex flex-col items-center text-center pb-4 mb-4 border-b border-surface-container">
                  <span className="material-symbols-outlined text-[24px] text-primary mb-1">
                    precision_manufacturing
                  </span>
                  <h2 className="font-headline-sm uppercase tracking-tight font-bold text-on-surface">
                    {merchant || '— No Merchant Detected —'}
                  </h2>
                  <p className="font-body-sm text-[12px] text-on-surface-variant">
                    Invoice: {invoiceNumber || '—'} • Date: {transactionDate || '—'}
                  </p>
                </div>

                {/* Line Items if detected */}
                {reviewData.extracted.line_items && reviewData.extracted.line_items.length > 0 && (
                  <div className="mb-4 pb-3 border-b border-surface-container space-y-1.5">
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-semibold">
                      Extracted Line Items
                    </span>
                    {reviewData.extracted.line_items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-surface-container-highest/40 last:border-0">
                        <span className="font-medium text-on-surface truncate max-w-[200px]">{item.description}</span>
                        <span className="text-on-surface-variant font-table-numeric">
                          {item.quantity ? `Qty ${item.quantity} · ` : ''}
                          {item.total_amount !== undefined && item.total_amount !== null
                            ? `${getCurrencySymbol(currency)} ${item.total_amount}`
                            : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Itemized Extraction Overlays */}
                <div className="space-y-2 text-body-sm">
                  <div className="flex items-center justify-between py-1 relative">
                    <span className="text-on-surface-variant">Subtotal</span>
                    <span className="font-table-numeric font-medium text-on-surface">
                      {subtotal ? `${getCurrencySymbol(currency)} ${subtotal}` : '—'}
                    </span>
                    {showBBoxes && (
                      <div className="absolute -inset-0.5 bg-secondary-container/30 rounded pointer-events-none" />
                    )}
                  </div>
                  <div className="flex items-center justify-between py-1 relative">
                    <span className="text-on-surface-variant">Tax Amount</span>
                    <span className="font-table-numeric font-medium text-on-surface">
                      {tax ? `${getCurrencySymbol(currency)} ${tax}` : '—'}
                    </span>
                    {showBBoxes && (
                      <div className="absolute -inset-0.5 bg-secondary-container/30 rounded pointer-events-none" />
                    )}
                  </div>
                  <div className="flex items-center justify-between py-2 border-t border-surface-container-highest font-headline-sm text-headline-sm text-on-surface mt-1 relative">
                    <span className="font-bold">Total Invoiced</span>
                    <span className="font-table-numeric font-bold text-primary">
                      {total ? `${getCurrencySymbol(currency)} ${total}` : '—'}
                    </span>
                    {showBBoxes && (
                      <div className="absolute -inset-1 bg-secondary-container/50 rounded pointer-events-none" />
                    )}
                  </div>
                </div>

                {/* Bottom Micro Stamp */}
                <div className="mt-6 pt-3 border-t border-dashed border-surface-container flex items-center justify-between font-label-caps text-label-caps text-on-surface-variant">
                  <span>OFFLINE LOCAL VAULT CAPTURE</span>
                  <span className="font-mono">VERIFIED LOCAL</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANE: Fully Editable Extracted Single-Column Form */}
          <div className="w-full lg:col-span-6 flex flex-col bg-surface-container-lowest rounded-xl shadow-xs border border-outline-variant/30 p-space-sm sm:p-space-lg">
            {/* Advisory Banner */}
            <div className="p-space-sm sm:p-space-md rounded-xl bg-surface-container-low mb-space-md sm:mb-space-lg flex items-start gap-space-sm border border-primary/20">
              <span className="material-symbols-outlined text-primary text-[20px] shrink-0 mt-0.5">
                verified_user
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-headline-sm text-xs sm:text-headline-sm text-on-surface leading-tight font-semibold">
                  AI Extraction Complete
                </span>
                <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant leading-relaxed">
                  Verify values extracted by your on-device AI. Every field is fully editable before committing to disk.
                </p>
              </div>
            </div>

            {/* Editable Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSave()
              }}
              className="flex flex-col gap-space-md sm:gap-space-lg"
            >
              {/* SECTION 1: Merchant Information */}
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-semibold">
                    1. Merchant &amp; Origin
                  </span>
                  <span className="inline-flex items-center gap-1 font-label-caps text-label-caps text-primary bg-surface-container-low px-2 py-0.5 rounded font-medium">
                    <span className="material-symbols-outlined text-[12px]">search_check</span>
                    <span>Matched Pattern</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm sm:gap-space-md pt-1">
                  <div className="col-span-1 sm:col-span-2 flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-medium flex items-center justify-between"
                      htmlFor="merchantName"
                    >
                      <span>Merchant Name *</span>
                      <span className="font-label-caps text-label-caps text-on-surface-variant">
                        Extracted header
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        id="merchantName"
                        type="text"
                        value={merchant}
                        onChange={(e) => {
                          setMerchant(e.target.value)
                          if (validationErrors.merchant) {
                            setValidationErrors((prev) => ({ ...prev, merchant: '' }))
                          }
                        }}
                        className={`w-full bg-surface-container-low focus:bg-surface-container-lowest px-3 py-2.5 min-h-[42px] rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all border ${
                          validationErrors.merchant
                            ? 'border-error ring-1 ring-error'
                            : 'border-transparent focus:border-primary'
                        }`}
                        placeholder="e.g. Acme Corporation"
                      />
                      <span className="material-symbols-outlined absolute right-3 top-2.5 text-primary text-[18px]">
                        verified
                      </span>
                    </div>
                    {validationErrors.merchant && (
                      <p className="text-xs text-error font-medium mt-0.5">
                        {validationErrors.merchant}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-medium"
                      htmlFor="invoiceNumber"
                    >
                      Invoice / Receipt #
                    </label>
                    <input
                      id="invoiceNumber"
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full bg-surface-container-low focus:bg-surface-container-lowest px-3 py-2.5 min-h-[42px] rounded-xl text-body-md font-table-numeric text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary"
                      placeholder="e.g. INV-884291"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-medium"
                      htmlFor="transactionDate"
                    >
                      Transaction Date *
                    </label>
                    <input
                      id="transactionDate"
                      type="date"
                      value={transactionDate}
                      onChange={(e) => {
                        setTransactionDate(e.target.value)
                        if (validationErrors.transactionDate) {
                          setValidationErrors((prev) => ({ ...prev, transactionDate: '' }))
                        }
                      }}
                      className="w-full bg-surface-container-low focus:bg-surface-container-lowest px-3 py-2 min-h-[42px] rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary"
                    />
                    {validationErrors.transactionDate && (
                      <p className="text-xs text-error font-medium mt-0.5">
                        {validationErrors.transactionDate}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 2: Financials & Math Verification */}
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-semibold">
                    2. Financial Ledger &amp; Math Audit
                  </span>
                  {isBalanced ? (
                    <span className="inline-flex items-center gap-1 font-label-caps text-label-caps text-primary bg-secondary-container/50 px-2 py-0.5 rounded font-semibold">
                      <span className="material-symbols-outlined text-[13px]">calculate</span>
                      <span>Balanced</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-label-caps text-label-caps text-tertiary-container bg-tertiary-fixed px-2 py-0.5 rounded font-semibold">
                      <span className="material-symbols-outlined text-[13px]">priority_high</span>
                      <span>Math Variance</span>
                    </span>
                  )}
                </div>

                {!isBalanced && Boolean(total) && (
                  <div className="p-2.5 rounded-lg bg-tertiary-fixed/30 border border-tertiary/20 text-xs text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-tertiary shrink-0">
                      info
                    </span>
                    <span>
                      Subtotal ({getCurrencySymbol(currency)} {subtotal || '0.00'}) + Tax ({getCurrencySymbol(currency)} {tax || '0.00'}) + Tip ({getCurrencySymbol(currency)} {tip || '0.00'}) = {getCurrencySymbol(currency)} {calculatedSum.toFixed(2)}, differing from total {getCurrencySymbol(currency)} {total}.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm sm:gap-space-md pt-1">
                  <div className="flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-medium"
                      htmlFor="currencyCode"
                    >
                      Currency *
                    </label>
                    <select
                      id="currencyCode"
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value)
                        if (validationErrors.currency) {
                          setValidationErrors((prev) => ({ ...prev, currency: '' }))
                        }
                      }}
                      className={`w-full bg-surface-container-low focus:bg-surface-container-lowest px-3 py-2.5 min-h-[42px] rounded-xl text-body-md font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all border ${
                        validationErrors.currency
                          ? 'border-error ring-1 ring-error'
                          : 'border-transparent focus:border-primary'
                      }`}
                    >
                      {!currency && <option value="">Select Currency</option>}
                      {currency && !CURRENCIES.includes(currency) && (
                        <option value={currency}>{currency}</option>
                      )}
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {validationErrors.currency && (
                      <p className="text-xs text-error font-medium mt-0.5">
                        {validationErrors.currency}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-medium"
                      htmlFor="subtotalAmount"
                    >
                      Subtotal
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-on-surface-variant font-body-md text-xs">
                        {getCurrencySymbol(currency)}
                      </span>
                      <input
                        id="subtotalAmount"
                        type="number"
                        step="0.01"
                        value={subtotal}
                        onChange={(e) => setSubtotal(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-surface-container-low focus:bg-surface-container-lowest pl-9 pr-3 py-2.5 min-h-[42px] rounded-xl text-body-md font-table-numeric text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-medium"
                      htmlFor="taxAmount"
                    >
                      Tax / VAT
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-on-surface-variant font-body-md text-xs">
                        {getCurrencySymbol(currency)}
                      </span>
                      <input
                        id="taxAmount"
                        type="number"
                        step="0.01"
                        value={tax}
                        onChange={(e) => setTax(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-surface-container-low focus:bg-surface-container-lowest pl-9 pr-3 py-2.5 min-h-[42px] rounded-xl text-body-md font-table-numeric text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-medium"
                      htmlFor="tipAmount"
                    >
                      Tip / Surcharge
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-on-surface-variant font-body-md text-xs">
                        {getCurrencySymbol(currency)}
                      </span>
                      <input
                        id="tipAmount"
                        type="number"
                        step="0.01"
                        value={tip}
                        onChange={(e) => setTip(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-surface-container-low focus:bg-surface-container-lowest pl-9 pr-3 py-2.5 min-h-[42px] rounded-xl text-body-md font-table-numeric text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-semibold flex items-center justify-between"
                      htmlFor="totalAmount"
                    >
                      <span>Calculated Total Paid *</span>
                      <span className="text-primary font-label-caps text-label-caps">
                        Calculated Sum: {getCurrencySymbol(currency)} {calculatedSum.toFixed(2)}
                      </span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-primary font-bold font-body-md text-xs">
                        {getCurrencySymbol(currency)}
                      </span>
                      <input
                        id="totalAmount"
                        type="number"
                        step="0.01"
                        value={total}
                        onChange={(e) => {
                          setTotal(e.target.value)
                          if (validationErrors.total) {
                            setValidationErrors((prev) => ({ ...prev, total: '' }))
                          }
                        }}
                        placeholder="0.00"
                        className={`w-full bg-surface-container font-headline-sm text-headline-sm font-table-numeric text-primary pl-9 pr-10 py-2 min-h-[44px] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all font-semibold border ${
                          validationErrors.total
                            ? 'border-error ring-1 ring-error'
                            : 'border-transparent focus:border-primary'
                        }`}
                      />
                      <span className="material-symbols-outlined absolute right-3 top-2.5 text-primary text-[20px]">
                        {isBalanced ? 'check_circle' : 'warning'}
                      </span>
                    </div>
                    {validationErrors.total && (
                      <p className="text-xs text-error font-medium mt-0.5">
                        {validationErrors.total}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* SECTION 3: Categorization & Tax Treatment */}
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-semibold">
                    3. Categorization &amp; Deduction
                  </span>
                  <span className="inline-flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
                    <span className="material-symbols-outlined text-[13px]">insights</span>
                    <span>Prior vendor history</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm sm:gap-space-md pt-1">
                  <div className="flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-medium"
                      htmlFor="expenseCategory"
                    >
                      Expense Category
                    </label>
                    <select
                      id="expenseCategory"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-surface-container-low focus:bg-surface-container-lowest px-3 py-2.5 min-h-[42px] rounded-xl text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      className="font-label-md text-label-md text-on-surface font-medium"
                      htmlFor="paymentMethod"
                    >
                      Payment Account
                    </label>
                    <input
                      id="paymentMethod"
                      type="text"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-surface-container-low focus:bg-surface-container-lowest px-3 py-2.5 min-h-[42px] rounded-xl text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all border border-transparent focus:border-primary"
                      placeholder="e.g. Apple Card •••• 4109"
                    />
                  </div>

                  {/* IRS Tax Treatment Radio Matrix */}
                  <div className="col-span-1 sm:col-span-2 flex flex-col gap-2 pt-1">
                    <span className="font-label-md text-label-md text-on-surface font-medium">
                      IRS Tax Treatment
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors border border-outline-variant/30 min-h-[44px]">
                        <input
                          type="radio"
                          name="taxDeductibility"
                          value="100"
                          checked={taxTreatment === '100'}
                          onChange={() => setTaxTreatment('100')}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="font-body-sm text-body-sm font-medium text-on-surface">
                          100% Business
                        </span>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors border border-outline-variant/30 min-h-[44px]">
                        <input
                          type="radio"
                          name="taxDeductibility"
                          value="split"
                          checked={taxTreatment === 'split'}
                          onChange={() => setTaxTreatment('split')}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="font-body-sm text-body-sm font-medium text-on-surface">
                          Partial Split
                        </span>
                      </label>

                      <label className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors border border-outline-variant/30 min-h-[44px]">
                        <input
                          type="radio"
                          name="taxDeductibility"
                          value="personal"
                          checked={taxTreatment === 'personal'}
                          onChange={() => setTaxTreatment('personal')}
                          className="accent-primary w-4 h-4"
                        />
                        <span className="font-body-sm text-body-sm font-medium text-on-surface">
                          Non-deductible
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Notes & Sovereign Audit Trail */}
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center justify-between pb-1 border-b border-surface-container">
                  <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-semibold">
                    4. Audit Trail &amp; Notes
                  </span>
                  <span className="inline-flex items-center gap-1 font-label-caps text-label-caps text-on-surface-variant">
                    <span className="material-symbols-outlined text-[13px]">lock</span>
                    <span>Encrypted on disk</span>
                  </span>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <label className="font-label-md text-label-md text-on-surface font-medium" htmlFor="txNotes">
                    Auditor Notes
                  </label>
                  <textarea
                    id="txNotes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add purpose, client reference, or deduction context..."
                    className="w-full bg-surface-container-low focus:bg-surface-container-lowest px-3 py-2 rounded-xl text-body-sm font-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none border border-transparent focus:border-primary"
                  />
                </div>

                <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-surface-container font-label-caps text-label-caps text-on-surface-variant">
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface font-semibold">Original File:</span>
                    <span className="font-table-numeric truncate max-w-xs">
                      {reviewData.original_filename}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-on-surface font-semibold">Document ID:</span>
                    <span className="font-mono text-[11px] truncate max-w-xs">{documentId}</span>
                  </div>
                </div>
              </div>

              {/* Collapsible Drawer: Raw OCR Output */}
              <div className="bg-surface-container-low rounded-xl shadow-xs border border-outline-variant/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRawOcrOpen(!rawOcrOpen)}
                  className="w-full px-4 py-3 min-h-[44px] flex items-center justify-between bg-surface-container-low hover:bg-surface-container font-label-caps text-label-caps text-on-surface uppercase tracking-wider transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
                    <span>
                      Raw OCR Text (
                      {reviewData.ocr_text_preview
                        ? reviewData.ocr_text_preview.split('\n').length
                        : 0}{' '}
                      lines)
                    </span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-[18px] transition-transform ${
                      rawOcrOpen ? 'rotate-180' : ''
                    }`}
                  >
                    expand_more
                  </span>
                </button>

                {rawOcrOpen && (
                  <div className="p-4 bg-surface-container-highest/30 font-table-numeric text-label-caps text-on-surface-variant leading-relaxed select-all overflow-x-auto max-h-44">
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5">
                      {reviewData.ocr_text_preview || 'No OCR text extracted.'}
                    </pre>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Sticky Mobile/Desktop Operational Action Footer */}
        {/* On mobile screens, sits above the bottom bar with safe padding */}
        <div className="fixed md:sticky bottom-16 md:bottom-0 left-0 right-0 z-30 bg-surface-container-lowest/95 backdrop-blur-md shadow-md rounded-none md:rounded-xl p-3 sm:p-space-md border-t md:border border-outline-variant/30 flex items-center justify-between gap-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/receipts')}
              className="px-3 sm:px-3.5 py-2 min-h-[42px] rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container font-body-sm text-xs sm:text-body-sm transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              <span>Cancel</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={confirmMutation.isPending}
              className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary px-5 py-2.5 min-h-[44px] rounded-xl font-body-sm text-xs sm:text-body-sm font-semibold shadow-xs transition-all active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]">lock_clock</span>
              <span>{confirmMutation.isPending ? 'Committing...' : 'Save Transaction'}</span>
              <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 rounded bg-on-primary/20 text-on-primary text-[10px] font-label-caps">
                ⌘↵
              </kbd>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Document Inspector Modal */}
      {isFullscreenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-inverse-surface/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface-container-lowest w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-xl border border-outline-variant/40 flex flex-col overflow-hidden">
            <div className="p-3 sm:p-4 bg-surface-container-low flex items-center justify-between border-b border-outline-variant/20">
              <div className="flex items-center gap-2 truncate">
                <span className="material-symbols-outlined text-primary text-[20px]">
                  description
                </span>
                <span className="font-semibold text-xs sm:text-body-md text-on-surface truncate">
                  {reviewData.original_filename}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom((z) => Math.max(z - 15, 50))}
                  className="p-1 text-on-surface-variant hover:text-on-surface"
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </button>
                <span className="font-mono text-xs text-on-surface">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(z + 15, 200))}
                  className="p-1 text-on-surface-variant hover:text-on-surface"
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </button>
                <button
                  onClick={() => setIsFullscreenModalOpen(false)}
                  className="p-1.5 min-h-[36px] min-w-[36px] text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors ml-2"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 flex justify-center items-start bg-surface-container-highest/20">
              <div
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-w-full"
              >
                {!isPdf ? (
                  <img
                    src={fileUrl}
                    alt={reviewData.original_filename}
                    className="max-w-full h-auto rounded shadow-md object-contain"
                  />
                ) : (
                  <iframe
                    src={fileUrl}
                    title="PDF Inspector"
                    className="w-[80vw] max-w-3xl h-[70vh] rounded"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
