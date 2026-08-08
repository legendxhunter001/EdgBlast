import type { LabelHTMLAttributes } from 'react'

export function Label({ className = '', children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`block text-xs font-medium text-muted-foreground ${className}`} {...props}>
      {children}
    </label>
  )
}
