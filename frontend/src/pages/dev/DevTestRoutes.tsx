import { Route } from 'react-router-dom'
import { LandingPageTest } from './LandingPageTest'
import { LobbyPageTest } from './LobbyPageTest'
import { HorseSelectionPageTest } from './HorseSelectionPageTest'
import { RacePageTest } from './RacePageTest'
import { RaceResultPageTest } from './RaceResultPageTest'

export const devTestRouteElements = (
  <>
    <Route path="/landing-test" element={<LandingPageTest />} />
    <Route path="/lobby-test" element={<LobbyPageTest />} />
    <Route path="/race-test" element={<RacePageTest />} />
    <Route path="/race-result-test" element={<RaceResultPageTest />} />
    <Route path="/horse-selection-test" element={<HorseSelectionPageTest />} />
  </>
)

export function DevTestRoutes() {
  return devTestRouteElements
}
