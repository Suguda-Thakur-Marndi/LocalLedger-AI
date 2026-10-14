import React, { useState } from 'react'
import { useCompanion } from '../lib/useCompanion'
import { DEFAULT_LOCAL_API_BASE } from '../lib/runtimeConfig'

export const CompanionModal: React.FC = () => {
  const {
    companionModalOpen,
    closeCompanionModal,
    status,
    savedUrl,
    connectedUrl,
    companionUrl,
    connectCompanion,
    disconnectCompanion,
    isLocal,
  } = useCompanion()

  const [inputUrl, setInputUrl] = useState(connectedUrl || savedUrl || DEFAULT_LOCAL_API_BASE)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    errorType?: string
  } | null>(null)



  if (!companionModalOpen) return null

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsTesting(true)
    setTestResult(null)

    const res = await connectCompanion(inputUrl)
    setIsTesting(false)

    if (res.success) {
      setTestResult({
        success: true,
        message: `Successfully connected to local companion at ${res.url}! Receipt processing and local vault access are now active.`,
      })
    } else {
      setTestResult({
        success: false,
        message: res.error || 'Failed to connect to local companion.',
        errorType: res.errorType,
      })
    }
  }

  const handleDisconnect = () => {
    disconnectCompanion()
    setTestResult(null)
    setInputUrl(DEFAULT_LOCAL_API_BASE)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-inverse-surface/40 backdrop-blur-xs">
      <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl shadow-xl border border-outline-variant/40 p-space-md sm:p-space-lg space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-start justify-between pb-2 border-b border-surface-container">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-surface-container-low text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">laptop_mac</span>
            </div>
            <div>
              <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
                Local Companion Connection
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Zero-telemetry bridge to your local machine
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCompanionModal}
            className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg hover:bg-surface-container min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Privacy Promise Notice */}
        <div className="p-3 rounded-xl bg-surface-container-low border border-primary/20 space-y-1">
          <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span>Local-First Privacy Architecture</span>
          </div>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            LocalLedger AI never transmits receipts or ledger transactions to external servers. All OCR parsing, Ollama neural models, and SQLite tables run 100% on your local computer.
          </p>
        </div>

        {/* Current Connection Status */}
        <div className="p-3 rounded-xl bg-surface-container-low/60 flex items-center justify-between text-xs sm:text-sm">
          <span className="text-on-surface-variant">Connection Status:</span>
          <span
            className={`font-semibold inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-label-caps ${
              isLocal || status === 'connected'
                ? 'bg-secondary-container text-on-secondary-container'
                : status === 'connecting'
                ? 'bg-primary-container text-on-primary-container'
                : status === 'saved'
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : status === 'error'
                ? 'bg-error-container text-on-error-container'
                : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isLocal || status === 'connected'
                  ? 'bg-secondary animate-pulse'
                  : status === 'connecting'
                  ? 'bg-primary animate-ping'
                  : status === 'saved'
                  ? 'bg-amber-600'
                  : status === 'error'
                  ? 'bg-error'
                  : 'bg-tertiary'
              }`}
            />
            {isLocal
              ? 'Local Machine (Development)'
              : status === 'connected'
              ? 'Companion Connected'
              : status === 'connecting'
              ? 'Verifying Connection...'
              : status === 'saved'
              ? 'Saved URL (Not Connected)'
              : status === 'error'
              ? 'Connection Failed'
              : 'Web Preview (Disconnected)'}
          </span>
        </div>

        {/* Saved status notification */}
        {status === 'saved' && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0">info</span>
            <span>
              A companion URL is saved in your browser ({savedUrl}), but has not completed a live health check in this session. Click <strong>Test &amp; Connect</strong> to verify it.
            </span>
          </div>
        )}

        {/* Connection Form */}
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <label
              htmlFor="companionUrlInput"
              className="font-label-md text-xs sm:text-sm font-medium text-on-surface block mb-1"
            >
              Local Companion Endpoint URL
            </label>
            <div className="relative">
              <input
                id="companionUrlInput"
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://127.0.0.1:8000/api/v1"
                className="w-full bg-surface-container-low px-3 py-2.5 min-h-[44px] rounded-xl font-mono text-xs sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary border border-outline-variant/30"
              />
              <span className="material-symbols-outlined absolute right-3 top-3 text-outline text-[18px]">
                link
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Standard local endpoint: <code className="font-mono">http://127.0.0.1:8000/api/v1</code>
            </p>
          </div>

          {/* Test Result Feedback Alert */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs sm:text-sm space-y-1.5 border ${
                testResult.success
                  ? 'bg-secondary-container/40 border-secondary text-on-secondary-container'
                  : 'bg-error-container/40 border-error/40 text-on-error-container'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <span className="material-symbols-outlined text-[18px]">
                  {testResult.success ? 'check_circle' : 'error'}
                </span>
                <span>{testResult.success ? 'Connection Verified' : 'Connection Failed'}</span>
              </div>
              <p className="text-xs leading-relaxed">{testResult.message}</p>

              {testResult.errorType === 'mixed_content' && (
                <div className="pt-1 text-[11px] text-on-surface-variant bg-surface-container-lowest p-2 rounded-lg border border-outline-variant/30 space-y-1">
                  <span className="font-semibold text-on-surface block">
                    Browser Mixed Content &amp; Security Boundary:
                  </span>
                  <p>
                    Modern browsers prohibit public HTTPS sites from fetching insecure plaintext HTTP endpoints on <code>localhost</code> (Mixed Content).
                  </p>
                  <p className="font-medium text-on-surface pt-1">
                    Recommended Secure Approaches:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-on-surface-variant">
                    <li>
                      <strong>Direct Local Use (Recommended):</strong> Clone the repository and run both frontend and backend locally (e.g. <code>http://localhost:5173</code>) where no cross-origin Mixed Content barriers exist.
                    </li>
                    <li>
                      <strong>HTTPS Local Reverse Proxy:</strong> Wrap your local companion with an HTTPS proxy (e.g. Caddy or mkcert with a trusted local certificate) and configure backend <code>ALLOWED_ORIGINS</code>.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            {status === 'connected' || status === 'saved' || Boolean(companionUrl) ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-3 py-2 text-xs text-error hover:bg-error-container/40 rounded-lg font-medium transition-colors min-h-[40px]"
              >
                Forget / Disconnect
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeCompanionModal}
                className="px-4 py-2 min-h-[42px] rounded-xl hover:bg-surface-container text-on-surface-variant font-medium text-xs sm:text-body-sm transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isTesting || !inputUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[42px] bg-primary hover:bg-primary-container disabled:opacity-50 text-on-primary rounded-xl font-body-sm text-xs sm:text-body-sm font-semibold transition-all shadow-xs active:scale-[0.98]"
              >
                {isTesting ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">sync</span>
                    <span>Test &amp; Connect</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Local Startup Guide Collapsible / Help */}
        <div className="pt-3 border-t border-surface-container text-xs space-y-2">
          <span className="font-semibold text-on-surface uppercase tracking-wider text-[11px] block">
            How to launch the local companion backend:
          </span>
          <div className="bg-surface-container-low p-2.5 rounded-xl font-mono text-[11px] text-on-surface space-y-1">
            <div className="text-on-surface-variant"># In repository root:</div>
            <div>cd backend</div>
            <div>.\.venv\Scripts\Activate.ps1</div>
            <div>uvicorn app.main:app --host 127.0.0.1 --port 8000</div>
          </div>
        </div>
      </div>
    </div>
  )
}
