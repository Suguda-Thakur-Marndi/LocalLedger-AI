import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
    if (!files || files.length === 0) return

    const newItems: UploadQueueItem[] = Array.from(files).map((f) => ({
      id: `${f.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      file: f,
      status: 'pending',
      progress: 0,
    }))

    setQueue((prev) => [...newItems, ...prev])
    newItems.forEach(processItem)
  }

  const processItem = async (item: UploadQueueItem) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/jpg']
    if (!validTypes.includes(item.file.type) && !item.file.name.match(/\.(pdf|png|jpe?g|webp)$/i)) {
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
      prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', progress: 45 } : q))
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
                errorMessage: err.message || 'Local upload and text extraction failed.',
              }
            : q
        )
      )
    }
  }

  const retryItem = (item: UploadQueueItem) => {
    processItem(item)
  }

  const removeItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="max-w-4xl mx-auto px-space-sm sm:px-space-md lg:px-space-xl py-space-md sm:py-space-lg space-y-space-md sm:space-y-space-lg">
      {/* Header */}
      <div>
        <div className="flex items-center gap-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
          <span>Ingestion Pipeline</span>
          <span>•</span>
          <span className="text-primary font-semibold">100% On-Device OCR</span>
        </div>
        <h1 className="font-display text-2xl sm:text-display text-on-surface tracking-tight mt-1">
          Upload Receipts
        </h1>
        <p className="font-body-sm sm:font-body-md text-on-surface-variant mt-1">
          Select or drop receipts and invoices for optical character recognition and local neural extraction.
        </p>
      </div>

      {/* Full-width Responsive Touch-Optimized Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative w-full cursor-pointer rounded-2xl border-2 border-dashed p-6 sm:p-10 text-center transition-all ${
          isDragging
            ? 'border-primary bg-surface-container-low shadow-sm'
            : 'border-outline-variant hover:border-primary bg-surface-container-lowest shadow-xs active:bg-surface-container-low'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,image/png,image/jpeg,image/webp,image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-surface-container-low text-primary flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[28px] sm:text-[32px]">upload_file</span>
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-semibold">
              Drop invoices or receipts here, or browse files
            </h3>
            <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
              PDF documents, PNG, JPEG, or WebP up to 25 MB. Every byte stays on your local device.
            </p>
          </div>

          <button
            type="button"
            className="mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-primary hover:bg-primary-container text-on-primary rounded-xl font-body-sm text-body-sm font-medium transition-all shadow-xs active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[18px]">folder_open</span>
            <span>Browse Files</span>
          </button>
        </div>
      </div>

      {/* Active Processing Queue */}
      {queue.length > 0 && (
        <div className="space-y-space-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-semibold">
              Ingestion Queue ({queue.length})
            </h2>
            <button
              onClick={() => setQueue([])}
              className="text-xs text-on-surface-variant hover:text-on-surface hover:underline font-medium p-1 min-h-[36px] flex items-center"
            >
              Clear Queue
            </button>
          </div>

          <div className="space-y-2.5">
            {queue.map((item) => (
              <div
                key={item.id}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-space-sm sm:p-space-md shadow-xs flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-low text-primary flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[20px]">
                        {item.file.type === 'application/pdf' ? 'picture_as_pdf' : 'image'}
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-body-sm font-semibold text-on-surface truncate">
                        {item.file.name}
                      </span>
                      <span className="text-[12px] text-on-surface-variant font-mono">
                        {formatBytes(item.file.size)}
                      </span>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      removeItem(item.id)
                    }}
                    className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-outline hover:text-on-surface rounded-lg hover:bg-surface-container transition-colors shrink-0"
                    title="Remove from queue"
                    aria-label={`Remove ${item.file.name}`}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                {/* Progress Bar for Uploading State */}
                {item.status === 'uploading' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs text-primary font-medium">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] animate-spin">
                          progress_activity
                        </span>
                        <span>Extracting OCR &amp; AI...</span>
                      </span>
                      <span className="font-mono">{item.progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Status Indicator & Action Bar */}
                <div className="flex items-center justify-between pt-1 border-t border-surface-container-low gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    {item.status === 'pending' && (
                      <span className="text-xs text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        Queued for processing
                      </span>
                    )}

                    {item.status === 'duplicate' && (
                      <span className="inline-flex items-center gap-1 font-label-caps text-label-caps px-2 py-0.5 rounded bg-tertiary-fixed text-on-tertiary-fixed-variant">
                        <span className="material-symbols-outlined text-[14px]">warning</span>
                        Duplicate Hash
                      </span>
                    )}

                    {item.status === 'extracted' && (
                      <span className="inline-flex items-center gap-1 font-label-caps text-label-caps px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Extracted Successfully
                      </span>
                    )}

                    {item.status === 'error' && (
                      <span className="font-label-caps text-label-caps text-error bg-error-container px-2 py-1 rounded">
                        {item.errorMessage || 'Extraction error'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === 'error' && (
                      <button
                        onClick={() => retryItem(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[38px] bg-surface-container-low hover:bg-surface-container text-on-surface rounded-lg text-xs font-medium transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">refresh</span>
                        <span>Retry</span>
                      </button>
                    )}

                    {item.status === 'duplicate' && item.documentId && (
                      <button
                        onClick={() => navigate(`/review/${item.documentId}`)}
                        className="px-3 py-1.5 min-h-[38px] bg-surface-container-highest hover:bg-primary hover:text-on-primary text-on-surface text-xs font-medium rounded-lg transition-colors"
                      >
                        Review Anyway
                      </button>
                    )}

                    {item.status === 'extracted' && item.documentId && (
                      <button
                        onClick={() => navigate(`/review/${item.documentId}`)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] bg-primary hover:bg-primary-container text-on-primary rounded-lg font-body-sm text-xs sm:text-body-sm font-medium transition-all shadow-xs active:scale-[0.98]"
                      >
                        <span>Open Review Workspace</span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Card on Privacy */}
      <div className="bg-surface-container-low rounded-xl p-space-md border border-primary/20 flex items-start gap-3">
        <span className="material-symbols-outlined text-primary text-[20px] sm:text-[22px] shrink-0 mt-0.5">
          security
        </span>
        <div className="space-y-0.5">
          <h4 className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-semibold">
            Confidential Document Safety
          </h4>
          <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant leading-relaxed">
            All document bytes are hashed using SHA-256 for duplicate detection and written to your local SQLite and file vault. No network sockets are opened outside localhost during ingestion.
          </p>
        </div>
      </div>
    </div>
  )
}
