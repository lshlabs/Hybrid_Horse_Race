import type { PropsWithChildren, ReactNode } from 'react'

type AppShellProps = PropsWithChildren<{
  footer?: ReactNode
  topRight?: ReactNode
}>

const TOP_RIGHT_CONTAINER_CLASS = 'flex justify-end px-6 pt-6'
const MAIN_CONTAINER_CLASS = 'mx-auto flex w-full max-w-8xl flex-1 flex-col gap-8 px-8 py-16'

export function AppShell({ footer, topRight, children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-grid-glow opacity-80" />
      <div className="relative z-10 flex min-h-screen flex-col">
        {topRight ? <div className={TOP_RIGHT_CONTAINER_CLASS}>{topRight}</div> : null}
        <main className={MAIN_CONTAINER_CLASS}>{children}</main>
        {footer}
      </div>
    </div>
  )
}
