import type { ChangeEvent } from 'react'
import { AVAILABLE_LANGUAGES } from '../../lib/i18n'
import { useTranslation } from 'react-i18next'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value)
  }

  return (
    <label className="ml-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-neutral-300 shadow-sm transition hover:border-white/20">
      <span className="font-medium uppercase tracking-[0.3em] text-primary/80">Lang</span>
      <select
        value={i18n.resolvedLanguage}
        onChange={handleChange}
        className="cursor-pointer bg-transparent text-sm text-neutral-100 outline-none"
      >
        {AVAILABLE_LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code} className="bg-background text-neutral-900">
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  )
}
