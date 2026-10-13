import React from 'react'

export interface StatCardProps {
  title: string
  value: string | number
  icon: string
  trendText?: string
  trendType?: 'positive' | 'neutral' | 'warning'
  subtitle?: string
  footerLeft?: string
  footerRight?: React.ReactNode
  onClick?: () => void
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  trendText,
  trendType = 'positive',
  subtitle,
  footerLeft,
  footerRight,
  onClick,
}) => {
  const trendBg =
    trendType === 'positive'
      ? 'bg-surface-container-low text-primary'
      : trendType === 'warning'
      ? 'bg-surface-container-highest text-tertiary-container'
      : 'bg-surface-container-high text-on-surface-variant'

  return (
    <div
      onClick={onClick}
      className={`bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant tracking-wider">
          {title}
        </span>
        <span className="material-symbols-outlined text-outline text-[18px]">{icon}</span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-headline-lg text-headline-lg font-table-numeric text-on-surface tracking-tight">
            {value}
          </span>
        </div>
        {(trendText || subtitle) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {trendText && (
              <span className={`inline-flex items-center font-label-caps text-label-caps px-1.5 py-0.5 rounded ${trendBg}`}>
                {trendText}
              </span>
            )}
            {subtitle && (
              <span className="text-body-sm text-on-surface-variant text-[11px]">{subtitle}</span>
            )}
          </div>
        )}
      </div>

      {(footerLeft || footerRight) && (
        <div className="mt-3 pt-2 border-t border-surface-container-low text-on-surface-variant font-body-sm text-[12px] flex items-center justify-between">
          <span>{footerLeft}</span>
          <span>{footerRight}</span>
        </div>
      )}
    </div>
  )
}
