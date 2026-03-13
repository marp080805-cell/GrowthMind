'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
  rightElement?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, icon, rightElement, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-text2 font-syne">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text3">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              'w-full h-10 rounded-[12px] bg-surface border border-[var(--border)] text-text',
              'placeholder:text-text3 focus:outline-none focus:border-accent',
              'transition-colors duration-150 text-sm',
              icon ? 'pl-10' : 'pl-3',
              rightElement ? 'pr-10' : 'pr-3',
              error && 'border-red/50 focus:border-red',
              className
            )}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {rightElement}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
