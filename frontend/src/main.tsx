import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/i18n'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { ensureUserSession } from './lib/user-id'

function setupServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return
  }

  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[main] Service Worker registration failed:', error)
      })
    })
    return
  }

  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) =>
      Promise.all(registrations.map((registration) => registration.unregister())),
    )
    .catch(() => undefined)
}

async function bootstrap() {
  try {
    await ensureUserSession()
  } catch (error) {
    console.warn('[main] Failed to bootstrap guest session:', error)
  }

  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Root element not found')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

setupServiceWorker()
void bootstrap()
