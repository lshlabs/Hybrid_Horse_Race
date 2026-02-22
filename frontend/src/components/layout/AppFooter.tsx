export function AppFooter() {
  return (
    <footer className="border-t border-white/5 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl px-6 py-6 text-sm text-muted-foreground sm:justify-between">
        <p>© {new Date().getFullYear()} Hybrid Horse Race. All rights reserved.</p>
      </div>
    </footer>
  )
}
