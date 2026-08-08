import { forwardRef, type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'sm' | 'lg' | 'default'
}

const variantClasses: Record<string, string> = {
  default: 'bg-primary text-primary-foreground hover:opacity-90',
  ghost: 'bg-transparent hover:bg-white/5',
  outline: 'bg-transparent border border-border hover:bg-white/5',
}

const sizeClasses: Record<string, string> = {
  sm: 'h-9 px-3 text-sm',
  default: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
