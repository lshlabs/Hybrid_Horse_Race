import type { Stats } from '../lib/race-sim'

/**
 * 증강 등급
 */
export type AugmentRarity = 'common' | 'rare' | 'epic' | 'legendary'

/**
 * 증강 등급 한글 이름
 */
export const AUGMENT_RARITY_NAMES: Record<AugmentRarity, string> = {
  common: '일반',
  rare: '레어',
  epic: '영웅',
  legendary: '전설',
}

/**
 * 증강 타입 (어떤 능력치를 상승시키는지)
 */
export type AugmentStatType = keyof Stats

/**
 * 증강 능력치 한글 이름
 */
export const AUGMENT_STAT_NAMES: Record<AugmentStatType, string> = {
  Speed: '최고속도',
  Stamina: '스테미나',
  Power: '가속',
  Guts: '근성',
  Start: '출발',
  Consistency: '안정성',
}

/**
 * 증강 인터페이스
 */
export interface Augment {
  /** 증강 고유 ID */
  id: string
  /** 증강 이름 */
  name: string
  /** 증강 등급 */
  rarity: AugmentRarity
  /** 상승시키는 능력치 타입 */
  statType: AugmentStatType
  /** 능력치 상승량 */
  statValue: number
  /** 증강 설명 */
  description?: string
}

/**
 * 증강 선택지 (3개 중 1개 선택)
 */
export interface AugmentChoice {
  /** 선택지에 포함된 증강들 */
  augments: Augment[]
}

/**
 * 증강 세트 (게임 중 획득한 증강들)
 */
export interface AugmentSet {
  /** 세트 인덱스 (0부터 시작) */
  setIndex: number
  /** 선택된 증강 (없을 수 있음) */
  selectedAugment: Augment | null
}
