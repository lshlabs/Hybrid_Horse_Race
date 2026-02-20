export function AppFooter() {
  return (
    <footer className="border-t border-white/5 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Hybrid Horse Race. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">Alpha Build</span>
          <a
            className="rounded-md border border-white/10 px-3 py-1.5 text-foreground transition hover:border-primary/50 hover:text-primary/90"
            href="https://firebase.google.com/"
            target="_blank"
            rel="noreferrer"
          >
            Firebase Status
          </a>
        </div>
      </div>
    </footer>
  )
}
