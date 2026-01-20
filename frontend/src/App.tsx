import { Navigate, Route, Routes } from 'react-router-dom'

import { AppFooter } from './components/layout/AppFooter'
import { AppShell } from './components/layout/AppShell'
import { LanguageSwitcher } from './components/ui/LanguageSwitcher'
import { LandingPage } from './pages/LandingPage'
import { LobbyPage } from './pages/LobbyPage'
import { HorseSelectionPage } from './pages/HorseSelectionPage'
import { RacePage } from './pages/RacePage'
import { RacePageTest } from './pages/dev/RacePageTest'
import { HorseSelectionPageTest } from './pages/dev/HorseSelectionPageTest'
import { LandingPageTest } from './pages/dev/LandingPageTest'
import { LobbyPageTest } from './pages/dev/LobbyPageTest'

function App() {
  return (
    <Routes>
      {/* RacePage는 AppShell 밖에서 전체 화면 사용 */}
      <Route path="/race" element={<RacePage />} />
      {/* 개발용 테스트 페이지 (개발 모드에서만 접근 가능) */}
      {import.meta.env.DEV && <Route path="/race-test" element={<RacePageTest />} />}
      {import.meta.env.DEV && (
        <Route path="/horse-selection-test" element={<HorseSelectionPageTest />} />
      )}
      {import.meta.env.DEV && <Route path="/landing-test" element={<LandingPageTest />} />}
      {import.meta.env.DEV && <Route path="/lobby-test" element={<LobbyPageTest />} />}
      {/* 나머지 페이지들은 AppShell 안에서 */}
      <Route
        path="/*"
        element={
          <AppShell topRight={<LanguageSwitcher />} footer={<AppFooter />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/lobby" element={<LobbyPage />} />
              <Route path="/horse-selection" element={<HorseSelectionPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  )
}

export default App
