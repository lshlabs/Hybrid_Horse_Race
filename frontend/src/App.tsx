import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { AppFooter } from './components/layout/AppFooter'
import { AppShell } from './components/layout/AppShell'
import { LanguageSwitcher } from './components/ui/LanguageSwitcher'
import { PWAInstallButton } from './components/ui/PWAInstallButton'
import { devTestRouteElements } from './pages/dev/DevTestRoutes'
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })),
)
const LobbyPage = lazy(() => import('./pages/LobbyPage').then((m) => ({ default: m.LobbyPage })))
const HorseSelectionPage = lazy(() =>
  import('./pages/HorseSelectionPage').then((m) => ({ default: m.HorseSelectionPage })),
)
const RacePage = lazy(() => import('./pages/RacePage').then((m) => ({ default: m.RacePage })))
const RaceResultPage = lazy(() =>
  import('./pages/RaceResultPage').then((m) => ({ default: m.RaceResultPage })),
)

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Loading...
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* RacePage와 RaceResultPage는 AppShell 밖에서 전체 화면 사용 */}
        <Route path="/race" element={<RacePage />} />
        <Route path="/race-result" element={<RaceResultPage />} />

        {/* 나머지 페이지들은 AppShell 안에서 */}
        <Route
          path="/*"
          element={
            <AppShell
              topRight={
                <div className="flex items-center gap-2">
                  <LanguageSwitcher />
                  <PWAInstallButton />
                </div>
              }
              footer={<AppFooter />}
            >
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/lobby" element={<LobbyPage />} />
                <Route path="/horse-selection" element={<HorseSelectionPage />} />
                {/* 개발용 테스트 페이지 (DEV에서만 로드) */}
                {import.meta.env.DEV ? devTestRouteElements : null}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </Suspense>
  )
}

export default App
