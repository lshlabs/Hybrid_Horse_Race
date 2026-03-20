import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type NeonCardProps = PropsWithChildren<
  HTMLAttributes<HTMLElement> & {
    title?: string
    description?: ReactNode
    accent?: 'primary' | 'accent' | 'success' | 'warning'
    className?: string
  }
>

const accentRing: Record<NonNullable<NeonCardProps['accent']>, string> = {
  primary: 'ring-primary/60 shadow-neon',
  accent: 'ring-accent/60 shadow-[0_0_48px_rgba(244,114,182,0.35)]',
  success: 'ring-success/60 shadow-[0_0_42px_rgba(52,211,153,0.35)]',
  warning: 'ring-warning/60 shadow-[0_0_42px_rgba(251,146,60,0.3)]',
}
const CARD_BASE_CLASS =
  'relative overflow-hidden rounded-3xl border border-white/10 bg-surface/80 p-6 ring-1 ring-inset transition duration-300 ease-gentle-in-out'
const CARD_OVERLAY_CLASS =
  'pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/10 opacity-70'
const CARD_CONTENT_CLASS = 'relative z-10 flex flex-col gap-3'

export function NeonCard({
  title,
  description,
  accent = 'primary',
  className,
  children,
  ...rest
}: NeonCardProps) {
  return (
    <section className={cn(CARD_BASE_CLASS, accentRing[accent], className)} {...rest}>
      <div className={CARD_OVERLAY_CLASS} />
      <div className={CARD_CONTENT_CLASS}>
        {title ? (
          <header className="text-center">
            <h2 className="text-lg font-display uppercase tracking-[0.35em] text-white">{title}</h2>
            {description ? (
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </header>
        ) : null}
        <div className="flex flex-1 flex-col gap-4">{children}</div>
      </div>
    </section>
  )
}
