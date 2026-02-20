/**
 * 자동 닉네임 생성기
 * 구조: [형용사] + [명사]
 * - 인덱스 기반 저장으로 다국어 지원
 * - 표시 시 현재 언어로 번역
 * - 숫자 / 특수문자 없음
 * - 중복 허용
 */

import i18next from 'i18next'

/**
 * 닉네임 데이터 (인덱스 쌍)
 */
export interface NicknameData {
  adjIndex: number
  nounIndex: number
}

/**
 * 배열 크기 (한국어/영어 배열 크기가 동일해야 함)
 */
const ADJECTIVE_COUNT = 19
const NOUN_COUNT = 18

/**
 * 랜덤 정수 생성 (0 ~ max-1)
 */
function randomInt(max: number): number {
  return Math.floor(Math.random() * max)
}

/**
 * 닉네임 데이터 생성 (인덱스만 저장)
 * @returns 닉네임 인덱스 쌍
 */
export function generateNicknameData(): NicknameData {
  return {
    adjIndex: randomInt(ADJECTIVE_COUNT),
    nounIndex: randomInt(NOUN_COUNT),
  }
}

/**
 * 닉네임 데이터를 현재 언어로 포맷
 * @param data 닉네임 인덱스 쌍
 * @returns 현재 언어로 포맷된 닉네임
 */
export function formatNickname(data: NicknameData): string {
  const adjectives = i18next.t('nickname.adjectives', { returnObjects: true }) as string[]
  const nouns = i18next.t('nickname.nouns', { returnObjects: true }) as string[]

  const adjective = adjectives[data.adjIndex] || adjectives[0]
  const noun = nouns[data.nounIndex] || nouns[0]

  // 한글: 띄어쓰기 없음, 영어: 띄어쓰기 있음
  const currentLang = i18next.language
  if (currentLang === 'ko') {
    return adjective + noun // "행복한고양이"
  } else {
    return `${adjective} ${noun}` // "Happy Cat"
  }
}

/**
 * 닉네임 생성 (하위 호환성 유지 - 바로 문자열 반환)
 * @returns 현재 언어로 포맷된 닉네임
 * @deprecated 가능하면 generateNicknameData()와 formatNickname()을 사용하세요
 */
export function generateNickname(): string {
  return formatNickname(generateNicknameData())
}
