import { Navigate, Route, Routes } from 'react-router-dom'

import { AppFooter } from './components/layout/AppFooter'
import { AppShell } from './components/layout/AppShell'
import { LanguageSwitcher } from './components/ui/LanguageSwitcher'
import { LandingPage } from './pages/LandingPage'
import { LobbyPage } from './pages/LobbyPage'
import { HorseSelectionPage } from './pages/HorseSelectionPage'
import { RacePage } from './pages/RacePage'

function App() {
  return (
    <Routes>
      {/* RacePage는 AppShell 밖에서 전체 화면 사용 */}
      <Route path="/race" element={<RacePage />} />
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
