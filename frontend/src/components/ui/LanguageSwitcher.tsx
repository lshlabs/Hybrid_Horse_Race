import { Languages } from 'lucide-react'
import { AVAILABLE_LANGUAGES } from '../../lib/i18n'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

export function LanguageSwitcher() {
  const { i18n } = useTranslation()

  const handleValueChange = (value: string) => {
    void i18n.changeLanguage(value)
  }

  return (
    <Select value={i18n.resolvedLanguage || 'ko'} onValueChange={handleValueChange}>
      <SelectTrigger className="ml-auto inline-flex h-auto w-auto items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground shadow-sm transition hover:border-white/20 [&>span]:line-clamp-none">
        <Languages className="h-4 w-4" />
        <SelectValue className="text-sm" />
      </SelectTrigger>
      <SelectContent className="bg-secondary border-none">
        {AVAILABLE_LANGUAGES.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
