import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from './App'
import i18n from './lib/i18n'

describe('App', () => {
  it('renders the dashboard hero title', () => {
    void i18n.changeLanguage('ko')

    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: i18n.t('appTitle', { lng: 'ko' }) }),
    ).toBeInTheDocument()
  })
})
