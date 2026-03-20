import i18next from 'i18next'

export interface NicknameData {
  adjIndex: number
  nounIndex: number
}

const ADJECTIVE_COUNT = 19
const NOUN_COUNT = 18
const KOREAN_LANGUAGE_CODE = 'ko'

function randomInt(max: number): number {
  return Math.floor(Math.random() * max)
}

export function generateNicknameData(): NicknameData {
  return {
    adjIndex: randomInt(ADJECTIVE_COUNT),
    nounIndex: randomInt(NOUN_COUNT),
  }
}

function getDictionary(): { adjectives: string[]; nouns: string[] } {
  return {
    adjectives: i18next.t('nickname.adjectives', { returnObjects: true }) as string[],
    nouns: i18next.t('nickname.nouns', { returnObjects: true }) as string[],
  }
}

function toDisplayNickname(adjective: string, noun: string): string {
  if (i18next.language === KOREAN_LANGUAGE_CODE) {
    return `${adjective}${noun}`
  }
  return `${adjective} ${noun}`
}

export function formatNickname(data: NicknameData): string {
  const { adjectives, nouns } = getDictionary()

  const adjective = adjectives[data.adjIndex] ?? adjectives[0] ?? ''
  const noun = nouns[data.nounIndex] ?? nouns[0] ?? ''

  return toDisplayNickname(adjective, noun)
}

export function generateNickname(): string {
  return formatNickname(generateNicknameData())
}
