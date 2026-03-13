'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: string
  side?: 'right' | 'left'
}

export function Drawer({ open, onClose, title, children, width = '480px', side = 'right' }: DrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={cn(
          'fixed top-0 z-50 h-full bg-surface border-[var(--border)] shadow-2xl',
          'transition-transform duration-300 ease-in-out flex flex-col',
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          open
            ? 'translate-x-0'
            : side === 'right'
            ? 'translate-x-full'
            : '-translate-x-full'
        )}
        style={{ width }}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          {title && (
            <h3 className="font-syne font-semibold text-text">{title}</h3>
          )}
          <button
            onClick={onClose}
            className="ml-auto text-text3 hover:text-text transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </>
  )
}
