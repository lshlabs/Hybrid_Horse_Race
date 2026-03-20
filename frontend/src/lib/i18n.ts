import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '../locales/en/common.json'
import koCommon from '../locales/ko/common.json'

const FALLBACK_LANGUAGE = 'ko'
const SUPPORTED_LANGUAGES = ['ko', 'en'] as const
const DETECTION_ORDER = ['localStorage', 'navigator'] as const
const DETECTION_CACHES = ['localStorage'] as const

const resources = {
  en: {
    common: enCommon,
  },
  ko: {
    common: koCommon,
  },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: [...DETECTION_ORDER],
      caches: [...DETECTION_CACHES],
    },
  })

export const AVAILABLE_LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
] as const

export default i18n
