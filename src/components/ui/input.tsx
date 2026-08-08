import { forwardRef, type InputHTMLAttributes } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full h-10 rounded-lg px-3 text-sm bg-card border border-border text-foreground outline-none focus:border-primary transition-colors ${className}`}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
