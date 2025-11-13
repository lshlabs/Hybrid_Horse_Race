import { Navigate, Route, Routes } from 'react-router-dom'

import { AppFooter } from './components/layout/AppFooter'
import { AppShell } from './components/layout/AppShell'
import { LanguageSwitcher } from './components/ui/LanguageSwitcher'
import { LandingPage } from './pages/LandingPage'
import { LobbyPage } from './pages/LobbyPage'
import { HorseSelectionPage } from './pages/HorseSelectionPage'

function App() {
  return (
    <AppShell topRight={<LanguageSwitcher />} footer={<AppFooter />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/horse-selection" element={<HorseSelectionPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}

export default App
