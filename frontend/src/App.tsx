import { Navigate, Route, Routes } from 'react-router-dom'

import { AppFooter } from './components/layout/AppFooter'
import { AppShell } from './components/layout/AppShell'
import { LanguageSwitcher } from './components/ui/LanguageSwitcher'
import { PWAInstallButton } from './components/ui/PWAInstallButton'
import { LandingPage } from './pages/LandingPage'
import { LobbyPage } from './pages/LobbyPage'
import { HorseSelectionPage } from './pages/HorseSelectionPage'
import { RacePage } from './pages/RacePage'
import { RaceResultPage } from './pages/RaceResultPage'
import { RacePageTest } from './pages/dev/RacePageTest'
import { RaceResultPageTest } from './pages/dev/RaceResultPageTest'
import { HorseSelectionPageTest } from './pages/dev/HorseSelectionPageTest'
import { LandingPageTest } from './pages/dev/LandingPageTest'
import { LobbyPageTest } from './pages/dev/LobbyPageTest'

function App() {
  return (
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
              {/* 개발용 테스트 페이지 (AppShell 안에서) */}
              {import.meta.env.DEV && <Route path="/landing-test" element={<LandingPageTest />} />}
              {import.meta.env.DEV && <Route path="/lobby-test" element={<LobbyPageTest />} />}
              {import.meta.env.DEV && <Route path="/race-test" element={<RacePageTest />} />}
              {import.meta.env.DEV && (
                <Route path="/race-result-test" element={<RaceResultPageTest />} />
              )}
              {import.meta.env.DEV && (
                <Route path="/horse-selection-test" element={<HorseSelectionPageTest />} />
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  )
}

export default App
