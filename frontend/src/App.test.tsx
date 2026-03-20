import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from './App'
import i18n from './lib/i18n'

describe('App', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ko')
  })

  it('renders the dashboard hero title', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: i18n.t('appTitle', { lng: 'ko' }) }),
    ).toBeInTheDocument()
  })
})
