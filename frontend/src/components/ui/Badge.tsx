import React from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'warning' | 'error' | 'neutral' | 'success'
  children: React.ReactNode
  size?: 'sm' | 'md'
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center gap-1 font-label-caps text-label-caps rounded font-medium'
  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'

  const variantMap = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary-container text-on-secondary-container',
    warning: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    error: 'bg-error-container text-on-error-container',
    neutral: 'bg-surface-container text-on-surface-variant',
    success: 'bg-secondary-container text-on-secondary-container',
  }

  return (
    <span
      className={`${baseClasses} ${sizeClasses} ${variantMap[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
