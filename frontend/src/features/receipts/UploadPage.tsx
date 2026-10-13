import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  X,
  FileCheck,
} from 'lucide-react'
import { api } from '../../lib/api'
import { formatBytes } from '../../lib/utils'

interface UploadQueueItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'extracted' | 'duplicate' | 'error'
  progress: number
  documentId?: string
  errorMessage?: string
  isDuplicate?: boolean
  existingTxId?: string
}

export const UploadPage: React.FC = () => {
  const [queue, setQueue] = useState<UploadQueueItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleFiles = (files: FileList | null) => {
    if (!files) return

    const newItems: UploadQueueItem[] = Array.from(files).map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      file: f,
      status: 'pending',
      progress: 0,
    }))

    setQueue((prev) => [...prev, ...newItems])
    newItems.forEach(processItem)
  }

  const processItem = async (item: UploadQueueItem) => {
    // Validate file type
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
    if (!validTypes.includes(item.file.type)) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: 'error',
                errorMessage: 'Unsupported format. Please upload PDF, PNG, JPEG, or WebP.',
              }
            : q
        )
      )
      return
    }

    setQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', progress: 50 } : q))
    )

    try {
      const res = await api.uploadDocument(item.file)
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: res.is_duplicate ? 'duplicate' : 'extracted',
                progress: 100,
                documentId: res.document_id,
                isDuplicate: res.is_duplicate,
                existingTxId: res.existing_transaction_id || undefined,
              }
            : q
        )
      )
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: 'error',
                errorMessage: err.message || 'Upload and text extraction failed.',
              }
            : q
        )
      )
    }
  }

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id))
  }

  const retryItem = (item: UploadQueueItem) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: 'pending', errorMessage: undefined } : q))
    )
    processItem(item)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Upload Documents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Select or drag receipt photos or PDF invoices. Text is extracted locally using embedded
          parsers and local OCR.
        </p>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-brand-600 bg-brand-50/50 scale-[1.01]'
            : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-4 border border-brand-100">
          <UploadCloud className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-slate-900">
          Click to browse or drag and drop receipts
        </h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto">
          Supports PDF, PNG, JPEG, and WebP up to 25MB each. Text stays on your device.
        </p>
      </div>

      {/* Upload Queue List */}
      {queue.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          <div className="p-4 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Processing Queue ({queue.length})
            </span>
            <button
              onClick={() => setQueue([])}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium"
            >
              Clear Queue
            </button>
          </div>

          {queue.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{item.file.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(item.file.size)}</p>
                </div>
              </div>

              {/* Status and Actions */}
              <div className="flex items-center gap-3 shrink-0">
                {item.status === 'uploading' && (
                  <div className="flex items-center gap-2 text-xs text-brand-600 font-medium">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Extracting...</span>
                  </div>
                )}

                {item.status === 'extracted' && (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Ready for Review</span>
                    </span>
                    <button
                      onClick={() => navigate(`/review/${item.documentId}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <span>Review</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {item.status === 'duplicate' && (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>Duplicate Document</span>
                    </span>
                    <button
                      onClick={() => navigate(`/review/${item.documentId}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                    >
                      <span>Review Anyway</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {item.status === 'error' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-medium max-w-xs truncate" title={item.errorMessage}>
                      {item.errorMessage}
                    </span>
                    <button
                      onClick={() => retryItem(item)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                      title="Retry upload"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
