import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'purple' | 'orange' | 'cyan'
  className?: string
}

const variantStyles = {
  default: 'bg-surface2 text-text2 border-[var(--border)]',
  success: 'bg-green/10 text-green border-green/20',
  error: 'bg-red/10 text-red border-red/20',
  warning: 'bg-yellow/10 text-yellow border-yellow/20',
  info: 'bg-accent/10 text-accent border-accent/20',
  purple: 'bg-accent2/10 text-accent2 border-accent2/20',
  orange: 'bg-orange/10 text-orange border-orange/20',
  cyan: 'bg-cyan/10 text-cyan border-cyan/20',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border font-syne',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
