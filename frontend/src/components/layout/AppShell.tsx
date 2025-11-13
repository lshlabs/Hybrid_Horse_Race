import type { PropsWithChildren, ReactNode } from 'react'

type AppShellProps = PropsWithChildren<{
  footer?: ReactNode
  topRight?: ReactNode
}>

export function AppShell({ footer, topRight, children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-neutral-100">
      <div className="pointer-events-none absolute inset-0 bg-grid-glow opacity-80" />
      <div className="relative z-10 flex min-h-screen flex-col">
        {topRight ? <div className="flex justify-end px-6 pt-6">{topRight}</div> : null}
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 pb-24 pt-16">
          {children}
        </main>
        {footer}
      </div>
    </div>
  )
}
