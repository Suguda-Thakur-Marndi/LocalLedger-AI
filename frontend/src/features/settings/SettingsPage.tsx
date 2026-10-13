import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings,
  Sparkles,
  Cpu,
  HardDrive,
  ShieldCheck,
  Download,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  FileCode,
} from 'lucide-react'
import { api } from '../../lib/api'
import { formatBytes } from '../../lib/utils'

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient()
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)

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
      alert('All local data, database tables, and receipts have been successfully erased.')
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">System & Privacy Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Inspect local engine states, manage privacy parameters, export backups, or wipe local data.
        </p>
      </div>

      {/* Ollama Engine Panel */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Local AI Inference (Ollama)</h2>
              <p className="text-xs text-slate-500">
                Self-hosted open-weight language model for semantic interpretation.
              </p>
            </div>
          </div>

          <button
            onClick={() => checkMutation.mutate()}
            disabled={checkMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Test Connection</span>
          </button>
        </div>

        {checkMessage && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-mono">
            {checkMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
              Connection Status
            </span>
            <span
              className={`font-bold mt-1 inline-block ${
                status?.ollama_connected ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {status?.ollama_connected ? 'Connected (Loopback)' : 'Offline (OCR Fallback Active)'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
              Configured Model
            </span>
            <span className="font-bold text-slate-800 mt-1 inline-block font-mono">
              {status?.ollama_model || 'qwen2.5:3b'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
              Fallback Mechanism
            </span>
            <span className="font-bold text-slate-800 mt-1 inline-block">
              Rule-Based OCR Heuristics
            </span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600">
          <span className="font-semibold text-slate-800 block mb-1">How to enable local Ollama AI:</span>
          Install Ollama from{' '}
          <a
            href="https://ollama.com"
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 underline"
          >
            ollama.com
          </a>
          , then run{' '}
          <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-[11px] text-slate-900">
            ollama run {status?.ollama_model || 'qwen2.5:3b'}
          </code>{' '}
          in your terminal. LocalLedger automatically detects and routes inferences through loopback.
        </div>
      </div>

      {/* Local OCR & Storage Details */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">OCR & Local Storage Engine</h2>
            <p className="text-xs text-slate-500">
              Filesystem and SQLite parameters on your local hard drive.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
              OCR Engine
            </span>
            <span className="font-bold text-slate-800 mt-1 inline-block">
              {status?.ocr_engine_type || 'PyMuPDF Native Text'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
              Storage Directory
            </span>
            <span className="font-bold text-slate-800 mt-1 inline-block font-mono truncate" title={status?.storage_directory}>
              {status?.storage_directory || 'data/uploads'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
              Database Location
            </span>
            <span className="font-bold text-slate-800 mt-1 inline-block font-mono truncate" title={status?.database_path}>
              {status?.database_path || 'data/db/localledger.db'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
              Disk Usage
            </span>
            <span className="font-bold text-slate-800 mt-1 inline-block">
              {formatBytes(status?.storage_size_bytes || 0)} ({status?.total_documents || 0} documents)
            </span>
          </div>
        </div>
      </div>

      {/* Privacy Architecture Manifesto */}
      <div className="bg-brand-50/50 rounded-xl border border-brand-200/80 p-6 space-y-3">
        <div className="flex items-center gap-2.5 text-brand-900 font-bold text-sm">
          <ShieldCheck className="h-5 w-5 text-brand-600" />
          <span>Local-First Privacy Architecture</span>
        </div>
        <p className="text-xs text-brand-950/80 leading-relaxed">
          LocalLedger AI was engineered from the ground up under the principle of complete sovereign
          data custody. Document files never leave your computer. We do not use OpenAI, Anthropic, or
          cloud OCR endpoints. All document hashes, financial records, and embeddings reside exclusively
          within your SQLite database.
        </p>
      </div>

      {/* Backup and Data Maintenance */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900">Data Maintenance & Export</h2>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
          <div>
            <h3 className="text-xs font-semibold text-slate-800">Export Complete JSON Ledger</h3>
            <p className="text-xs text-slate-500">
              Download all transaction records and document metadata in portable JSON format.
            </p>
          </div>
          <a
            href={api.getBackupExportUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
          >
            <Download className="h-4 w-4" />
            <span>Export Backup</span>
          </a>
        </div>

        <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-semibold text-red-600">Delete All Local Financial Data</h3>
            <p className="text-xs text-slate-500">
              Permanently delete all uploaded receipts, SQLite transaction records, and database rows.
            </p>
          </div>
          <button
            onClick={() => {
              setDeleteModalOpen(true)
              setDeleteError(null)
              setConfirmInput('')
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-lg transition-colors shrink-0"
          >
            <Trash2 className="h-4 w-4" />
            <span>Wipe All Data</span>
          </button>
        </div>
      </div>

      {/* Wipe Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Confirm Irreversible Data Deletion</h3>
            <p className="text-xs text-slate-500 mt-2 mb-4 leading-relaxed">
              This will permanently delete all uploaded files and empty your SQLite ledger. To proceed,
              type <span className="font-mono font-bold text-red-600">DELETE LOCAL DATA</span> below:
            </p>

            <form onSubmit={handleDeleteSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="DELETE LOCAL DATA"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono text-center border border-slate-300 rounded-lg focus:border-red-600"
              />

              {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteMutation.isPending || confirmInput.trim() !== 'DELETE LOCAL DATA'}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  {deleteMutation.isPending ? 'Erasing...' : 'Erase Everything'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
