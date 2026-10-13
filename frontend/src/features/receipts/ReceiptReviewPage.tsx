import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Cpu,
  Info,
  ArrowLeft,
  Save,
  ZoomIn,
  ZoomOut,
  RotateCw,
} from 'lucide-react'
import { api } from '../../lib/api'
import type { ConfirmReceiptRequest } from '../../types'

const CATEGORIES = [
  'Meals & Entertainment',
  'Office Supplies',
  'Software & Subscriptions',
  'Travel',
  'Utilities',
  'Professional Services',
  'Equipment',
  'Other',
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CHF', 'INR']

export const ReceiptReviewPage: React.FC = () => {
  const { documentId } = useParams<{ documentId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [zoom, setZoom] = useState<number>(100)
  const [rotation, setRotation] = useState<number>(0)
  const [showOcrText, setShowOcrText] = useState<boolean>(false)

  // Form state
  const [merchant, setMerchant] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [transactionDate, setTransactionDate] = useState('')
  const [subtotal, setSubtotal] = useState<string>('0.00')
  const [tax, setTax] = useState<string>('0.00')
  const [total, setTotal] = useState<string>('0.00')
  const [currency, setCurrency] = useState('USD')
  const [category, setCategory] = useState('Other')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [notes, setNotes] = useState('')

  const { data: reviewData, isLoading, error } = useQuery({
    queryKey: ['receipt-review', documentId],
    queryFn: () => api.getDocumentReview(documentId!),
    enabled: !!documentId,
  })

  // Pre-populate form once review data is loaded
  useEffect(() => {
    if (reviewData) {
      const ext = reviewData.extracted
      setMerchant(ext.merchant || '')
      setInvoiceNumber(ext.invoice_number || '')
      setTransactionDate(ext.transaction_date ? String(ext.transaction_date) : '')
      setSubtotal(String(ext.subtotal || '0.00'))
      setTax(String(ext.tax || '0.00'))
      setTotal(String(ext.total || '0.00'))
      setCurrency(ext.currency || 'USD')
      setCategory(ext.category || 'Other')
      setPaymentMethod(ext.payment_method || '')
      setNotes(ext.notes || '')
    }
  }, [reviewData])

  const confirmMutation = useMutation({
    mutationFn: (payload: ConfirmReceiptRequest) => api.confirmReceipt(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      navigate('/transactions')
    },
  })

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!documentId) return

    const payload: ConfirmReceiptRequest = {
      document_id: documentId,
      merchant: merchant.trim() || 'Unknown Merchant',
      invoice_number: invoiceNumber.trim() || null,
      transaction_date: transactionDate || new Date().toISOString().split('T')[0],
      subtotal: parseFloat(subtotal) || 0,
      tax: parseFloat(tax) || 0,
      total: parseFloat(total) || 0,
      currency: currency.toUpperCase(),
      category: category || 'Other',
      payment_method: paymentMethod.trim() || null,
      notes: notes.trim() || null,
    }

    confirmMutation.mutate(payload)
  }

  // Check subtotal + tax = total
  const numSubtotal = parseFloat(subtotal) || 0
  const numTax = parseFloat(tax) || 0
  const numTotal = parseFloat(total) || 0
  const sumDiff = Math.abs(numSubtotal + numTax - numTotal)
  const hasMismatch = numSubtotal > 0 && numTotal > 0 && sumDiff > 0.05

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Running AI interpretation & OCR analysis...</p>
      </div>
    )
  }

  if (error || !reviewData) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 max-w-xl mx-auto">
        <AlertCircle className="h-6 w-6 shrink-0" />
        <div>
          <h3 className="font-semibold">Failed to load document review</h3>
          <p className="text-sm mt-0.5">{(error as any)?.message || 'Document could not be found.'}</p>
          <button
            onClick={() => navigate('/upload')}
            className="mt-3 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-semibold rounded"
          >
            Back to Upload
          </button>
        </div>
      </div>
    )
  }

  const fileUrl = api.getDocumentFileUrl(documentId!)
  const isPdf = reviewData.mime_type === 'application/pdf'

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/upload')}
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
            title="Back to Upload"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <span>Review Receipt Details</span>
              {reviewData.ollama_used ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <Sparkles className="h-3 w-3" />
                  <span>Ollama AI Interpreted</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  <Cpu className="h-3 w-3" />
                  <span>Rule-Based OCR Heuristics</span>
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify and adjust the extracted figures before saving to your verified ledger.
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={confirmMutation.isPending}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
        >
          <Save className="h-4 w-4" />
          <span>{confirmMutation.isPending ? 'Saving Record...' : 'Confirm & Save Transaction'}</span>
        </button>
      </div>

      {/* Warnings Banner if any */}
      {reviewData.warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <Info className="h-4 w-4 text-amber-700" />
            <span>Mathematical Validation Notice</span>
          </div>
          {reviewData.warnings.map((w, idx) => (
            <p key={idx} className="text-xs text-amber-800 ml-6">
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Split Review Layout: Document Preview (Left) vs Form (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Document Preview */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[750px]">
          {/* Preview Toolbar */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={reviewData.original_filename}>
              {reviewData.original_filename}
            </span>

            <div className="flex items-center gap-1.5">
              {!isPdf && (
                <>
                  <button
                    onClick={() => setZoom((prev) => Math.max(prev - 25, 50))}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="text-[11px] font-mono text-slate-500 w-10 text-center">{zoom}%</span>
                  <button
                    onClick={() => setZoom((prev) => Math.min(prev + 25, 200))}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-200"
                    title="Rotate 90deg"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => setShowOcrText(!showOcrText)}
                className={`ml-2 px-2.5 py-1 rounded font-medium transition-colors ${
                  showOcrText ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-700'
                }`}
              >
                {showOcrText ? 'Show Visual' : 'Show Raw Text'}
              </button>
            </div>
          </div>

          {/* Preview Body */}
          <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4">
            {showOcrText ? (
              <div className="w-full h-full bg-white p-4 font-mono text-xs text-slate-700 whitespace-pre-wrap overflow-y-auto rounded-lg border border-slate-200 shadow-2xs">
                {reviewData.ocr_text_preview || 'No raw text available.'}
              </div>
            ) : isPdf ? (
              <iframe
                src={`${fileUrl}#toolbar=1`}
                className="w-full h-full rounded border-0 bg-white"
                title="PDF Document Preview"
              />
            ) : (
              <div className="overflow-auto flex items-center justify-center w-full h-full">
                <img
                  src={fileUrl}
                  alt="Receipt Preview"
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transition: 'transform 0.15s ease',
                  }}
                  className="max-w-full max-h-full object-contain rounded shadow-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Editable Financial Form */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-xs p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Transaction Details
            </h2>

            {/* Merchant Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Merchant Name <span className="text-red-500">*</span>
                </label>
                {reviewData.suggestions.merchant && (
                  <span className="text-[10px] text-slate-500">
                    Source: {reviewData.suggestions.merchant.source} (
                    {Math.round(reviewData.suggestions.merchant.confidence * 100)}%)
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Acme Coffee Roasters"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600"
              />
            </div>

            {/* Invoice Number & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice / Receipt #
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-9901"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Transaction Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600"
                />
              </div>
            </div>

            {/* Currency & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600 bg-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600 bg-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Monetary Amounts: Subtotal, Tax, Total */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Financial Breakdown
              </span>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Subtotal</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={subtotal}
                    onChange={(e) => setSubtotal(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Tax</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    Total <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm font-bold border border-slate-300 rounded-lg bg-white font-mono text-slate-900"
                  />
                </div>
              </div>

              {hasMismatch && (
                <div className="flex items-center justify-between text-xs text-amber-700 pt-1">
                  <span>Subtotal + Tax ({numSubtotal + numTax}) != Total ({numTotal})</span>
                  <button
                    type="button"
                    onClick={() => setTotal((numSubtotal + numTax).toFixed(2))}
                    className="text-xs font-bold underline hover:text-amber-900"
                  >
                    Sync Total
                  </button>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="e.g. Visa ending in 4242"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Business purpose, client attendee, or tax deductible memo..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-brand-600"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={confirmMutation.isPending}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-xs transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {confirmMutation.isPending ? 'Committing to SQLite...' : 'Confirm & Save to Ledger'}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
