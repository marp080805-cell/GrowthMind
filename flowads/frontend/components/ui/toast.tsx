'use client'

import { useToastStore } from '@/hooks/use-toast'
import { CheckCircle, XCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-start gap-3 p-4 rounded-[12px] border shadow-xl',
            'bg-surface border-[var(--border)] text-text',
            'animate-in slide-in-from-bottom-4 fade-in duration-300'
          )}
        >
          {toast.variant === 'success' && (
            <CheckCircle size={18} className="text-green shrink-0 mt-0.5" />
          )}
          {toast.variant === 'error' && (
            <XCircle size={18} className="text-red shrink-0 mt-0.5" />
          )}
          {toast.variant === 'default' && (
            <Info size={18} className="text-accent shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-syne font-semibold">{toast.title}</p>
            {toast.description && (
              <p className="text-xs text-text2 mt-0.5">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-text3 hover:text-text transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
