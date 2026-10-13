import React from 'react'

export interface PrivacyBadgeProps {
  ollamaConnected?: boolean
  modelName?: string | null
  className?: string
  showModel?: boolean
}

export const PrivacyBadge: React.FC<PrivacyBadgeProps> = ({
  ollamaConnected = false,
  modelName = 'llama3.2-vision:11b',
  className = '',
  showModel = false,
}) => {
  if (ollamaConnected) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-low text-primary text-label-caps font-label-caps border border-primary/20 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span>Local processing active</span>
        {showModel && modelName && (
          <span className="text-on-surface-variant font-normal">({modelName})</span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-highest text-tertiary-container text-label-caps font-label-caps border border-outline-variant ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
      <span>Ollama Offline · OCR Fallback Active</span>
    </div>
  )
}
