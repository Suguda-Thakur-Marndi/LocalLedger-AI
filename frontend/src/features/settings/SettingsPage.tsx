import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { formatBytes } from '../../lib/utils'

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportSuccess, setExportSuccess] = useState<string | null>(null)

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['system-status'],
    queryFn: () => api.getSystemStatus(),
  })

  // Manual Ollama Check Mutation
  const checkMutation = useMutation({
    mutationFn: () => api.checkOllama(),
    onSuccess: (res) => {
      refetch()
      if (res.connected) {
        setCheckMessage(
          `Ollama connection active! Installed models: ${res.models?.join(', ') || 'None found'}.`
        )
      } else {
        setCheckMessage('Ollama daemon could not be reached on local loopback (127.0.0.1:11434).')
      }
    },
    onError: (err: any) => {
      setCheckMessage(`Health check failed: ${err.message}`)
    },
  })

  // Delete All Data Mutation
  const deleteMutation = useMutation({
    mutationFn: (text: string) => api.deleteAllData(text),
    onSuccess: () => {
      queryClient.invalidateQueries()
      setDeleteModalOpen(false)
      setConfirmInput('')
      setDeleteError(null)
      alert('All local data, database records, and receipt files have been permanently erased.')
    },
    onError: (err: any) => {
      setDeleteError(err.message || 'Failed to erase data.')
    },
  })

  const handleDeleteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (confirmInput.trim() !== 'DELETE LOCAL DATA') {
      setDeleteError('Confirmation string must exactly match "DELETE LOCAL DATA"')
      return
    }
    deleteMutation.mutate(confirmInput.trim())
  }

  const handleExportBackup = async () => {
    setIsExporting(true)
    setExportError(null)
    setExportSuccess(null)
    try {
      const { filename, blob } = await api.downloadBackupZip()
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(objectUrl)
      setExportSuccess(
        `Backup archive "${filename}" (${formatBytes(blob.size)}) created and downloaded successfully.`
      )
    } catch (err: any) {
      setExportError(err.message || 'Failed to export vault backup archive.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-space-sm sm:px-space-md lg:px-space-xl py-space-md sm:py-space-lg space-y-space-md sm:space-y-space-lg">
      {/* Header */}
      <div>
        <div className="flex items-center gap-space-xs text-on-surface-variant font-label-caps text-label-caps uppercase tracking-wider">
          <span>Host Machine Configuration</span>
          <span>•</span>
          <span className="text-primary font-semibold">Zero Telemetry</span>
        </div>
        <h1 className="font-display text-2xl sm:text-display text-on-surface tracking-tight mt-1">
          System &amp; Settings
        </h1>
        <p className="font-body-sm sm:font-body-md text-on-surface-variant mt-1">
          Inspect local neural runtime, verify storage parameters, export backups, or manage vault security.
        </p>
      </div>

      {/* Vertical Settings Sections */}
      {isLoading ? (
        <div className="space-y-space-md sm:space-y-space-lg animate-pulse">
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 h-44" />
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 h-44" />
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 h-44" />
        </div>
      ) : (
        <div className="space-y-space-md sm:space-y-space-lg">
          {/* SECTION 1: Ollama & OCR Engine Status */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-xs p-space-md sm:p-space-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">neurology</span>
              </div>
              <div>
                <h2 className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-semibold">
                  Local AI Inference Engine (Ollama)
                </h2>
                <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
                  Host-loopback LLM for document semantic parsing &amp; tax classification.
                </p>
              </div>
            </div>

            <button
              onClick={() => checkMutation.mutate()}
              disabled={checkMutation.isPending}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[44px] bg-surface-container-lowest hover:bg-surface-container-low text-on-surface border border-outline-variant/40 rounded-xl font-body-sm text-xs sm:text-body-sm font-medium transition-all shadow-xs self-start sm:self-auto disabled:opacity-50"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  checkMutation.isPending ? 'animate-spin' : ''
                }`}
              >
                refresh
              </span>
              <span>{checkMutation.isPending ? 'Testing...' : 'Test Connection'}</span>
            </button>
          </div>

          {checkMessage && (
            <div className="p-3 bg-surface-container-low rounded-xl text-xs sm:text-body-sm text-on-surface font-medium border border-primary/20">
              {checkMessage}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-1 text-body-sm">
            <div className="p-3 rounded-xl bg-surface-container-low/60 flex items-center justify-between">
              <span className="text-on-surface-variant text-xs sm:text-body-sm">Daemon Status</span>
              <span
                className={`font-semibold inline-flex items-center gap-1 font-label-caps text-label-caps px-2 py-0.5 rounded ${
                  status?.ollama_connected
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status?.ollama_connected ? 'bg-secondary' : 'bg-tertiary'
                  }`}
                />
                {status?.ollama_connected ? 'Online (Ready)' : 'Offline (Fallback active)'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low/60 flex items-center justify-between">
              <span className="text-on-surface-variant text-xs sm:text-body-sm">Configured Model</span>
              <span className="font-mono text-xs font-semibold text-on-surface">
                {status?.ollama_model || 'llama3.2-vision:11b'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low/60 flex items-center justify-between sm:col-span-2">
              <span className="text-on-surface-variant text-xs sm:text-body-sm">OCR Pipeline</span>
              <span className="font-semibold text-xs text-primary flex items-center gap-1 font-label-caps text-label-caps">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                PyMuPDF + Local Tesseract
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:col-span-2">
              <span className="text-on-surface-variant text-xs sm:text-body-sm">Available Models</span>
              <span className="font-mono text-xs text-on-surface break-all sm:break-normal text-right sm:text-left">
                {status?.ollama_available_models && status.ollama_available_models.length > 0
                  ? status.ollama_available_models.join(', ')
                  : 'None detected via 127.0.0.1:11434'}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Local Storage & Vault Panel */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-xs p-space-md sm:p-space-lg space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface-container-low text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">folder_special</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-semibold">
                Host File Vault &amp; Database
              </h2>
              <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
                Physical filesystem paths where your receipts and SQLite tables reside.
              </p>
            </div>
          </div>

          <div className="space-y-2 text-body-sm">
            <div className="p-3 rounded-xl bg-surface-container-low/60 flex flex-col gap-1">
              <span className="text-on-surface-variant font-medium text-xs">SQLite Database File</span>
              <span className="font-mono text-[11px] text-on-surface bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20 break-all select-all">
                {status?.database_path || 'data/db/localledger.db'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low/60 flex flex-col gap-1">
              <span className="text-on-surface-variant font-medium text-xs">Document Vault Directory</span>
              <span className="font-mono text-[11px] text-on-surface bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/20 break-all select-all">
                {status?.storage_directory || 'data/documents'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm pt-1">
              <div className="p-3 rounded-xl bg-surface-container-low text-center">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">
                  Total Files
                </span>
                <span className="font-headline-sm font-table-numeric font-bold text-on-surface">
                  {status?.total_documents ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low text-center">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">
                  Confirmed Records
                </span>
                <span className="font-headline-sm font-table-numeric font-bold text-on-surface">
                  {status?.total_transactions ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low text-center col-span-2 sm:col-span-1">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase block">
                  Disk Footprint
                </span>
                <span className="font-headline-sm font-table-numeric font-bold text-on-surface">
                  {formatBytes(status?.storage_size_bytes ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Backup & Export */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-xs p-space-md sm:p-space-lg flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-surface-container-low text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">archive</span>
              </div>
              <div>
                <h2 className="font-headline-sm text-sm sm:text-headline-sm text-on-surface font-semibold">
                  Export Vault Backup (ZIP Archive)
                </h2>
                <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
                  Download your entire SQLite database and raw document assets as an offline archive.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isExporting}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl font-body-sm text-xs sm:text-body-sm font-semibold transition-all shadow-xs shrink-0 self-start sm:self-auto ${
                isExporting
                  ? 'bg-primary/60 cursor-not-allowed text-on-primary'
                  : 'bg-primary hover:bg-primary-container text-on-primary active:scale-[0.98]'
              }`}
            >
              {isExporting ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>Generating Archive...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  <span>Download Backup</span>
                </>
              )}
            </button>
          </div>

          {exportSuccess && (
            <div className="flex items-center gap-2 p-3 text-xs sm:text-sm text-primary bg-primary/10 border border-primary/20 rounded-lg">
              <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>
              <span className="font-medium">{exportSuccess}</span>
            </div>
          )}

          {exportError && (
            <div className="flex items-center gap-2 p-3 text-xs sm:text-sm text-error bg-error-container/40 border border-error/30 rounded-lg">
              <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
              <span className="font-medium">{exportError}</span>
            </div>
          )}
        </div>

        {/* SECTION 4: Sovereign Wipe Zone (Danger Section) */}
        <div className="bg-surface-container-lowest rounded-xl border border-error/30 shadow-xs p-space-md sm:p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-error-container text-on-error-container flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">delete_forever</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-sm sm:text-headline-sm text-error font-semibold">
                Purge Local Ledger Data
              </h2>
              <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant">
                Permanently erase all ingested documents, OCR outputs, and ledger database rows.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setDeleteModalOpen(true)
              setConfirmInput('')
              setDeleteError(null)
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-error-container hover:bg-error hover:text-on-error text-on-error-container rounded-xl font-body-sm text-xs sm:text-body-sm font-semibold transition-colors shrink-0 self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            <span>Wipe All Data</span>
          </button>
        </div>
      </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-inverse-surface/40 backdrop-blur-xs">
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl shadow-lg border border-outline-variant/40 p-space-md sm:p-space-lg space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-error">
              <span className="material-symbols-outlined text-[28px]">warning</span>
              <h3 className="font-headline-sm text-headline-sm font-semibold">
                Permanent Data Erase
              </h3>
            </div>

            <p className="font-body-sm text-xs sm:text-body-sm text-on-surface-variant leading-relaxed">
              This action will completely wipe your local SQLite database and all uploaded receipt files. To proceed, please type <strong className="text-on-surface font-mono">DELETE LOCAL DATA</strong> below:
            </p>

            <form onSubmit={handleDeleteSubmit} className="space-y-3">
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="DELETE LOCAL DATA"
                className="w-full bg-surface-container-low px-3 py-2.5 min-h-[44px] rounded-xl font-mono text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-error"
                autoFocus
              />

              {deleteError && (
                <p className="text-xs text-error font-medium">{deleteError}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2.5 min-h-[42px] rounded-xl hover:bg-surface-container text-on-surface-variant font-medium text-xs sm:text-body-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteMutation.isPending || confirmInput !== 'DELETE LOCAL DATA'}
                  className="px-5 py-2.5 min-h-[42px] bg-error hover:bg-error/90 disabled:opacity-40 text-on-error rounded-xl font-medium text-xs sm:text-body-sm transition-colors"
                >
                  {deleteMutation.isPending ? 'Erasing...' : 'Confirm Purge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
