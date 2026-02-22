import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './lib/i18n'
import App from './App.tsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { ensureUserSession } from './lib/user-id'

// Service Worker는 production에서만 등록한다.
// 개발 환경에서는 기존 등록을 해제해 네트워크/캐시 간섭을 방지한다.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration)
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error)
        })
    })
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister()
        }
      })
      .catch(() => {
        // noop
      })
  }
}

async function bootstrap() {
  try {
    await ensureUserSession()
  } catch (error) {
    console.warn('[main] Failed to bootstrap guest session:', error)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
}

void bootstrap()
