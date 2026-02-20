// =========================
// 레이스 엔진 타입 정의
// =========================

import i18next from 'i18next'

/**
 * 능력치 이름
 */
export type StatName = 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Luck'

/**
 * 능력치 (6가지)
 * - Speed: 최고 속도
 * - Stamina: 스태미나 소모 효율
 * - Power: 가속력
 * - Guts: 피로 시 최소 속도 바닥
 * - Start: 초반 가속 + 출발 딜레이
 * - Luck: 행운 롤 범위 (로또형 운빨)
 */
export interface Stats {
  Speed: number
  Stamina: number
  Power: number
  Guts: number
  Start: number
  Luck: number
}

/**
 * 실질 능력치 (컨디션 반영 후)
 */
export type EffectiveStats = Stats

/**
 * 순위 스냅샷 (구간별 순위 기록용)
 */
export interface SnapshotOrder {
  name: string
  position: number
}

/**
 * 레이스 결과
 */
export interface RaceResult {
  rank: number
  horse: unknown // Horse 클래스 (순환 참조 방지를 위해 unknown 사용)
  finishTime: number | null
  position: number
  staminaRatio: number
  finalRank: number
  conditionRoll: number
}

/**
 * 레이스 옵션
 */
export interface RaceOptions {
  numHorses?: number
  horses?: Array<{ name: string; stats: Stats }>
  trackDistance?: number
}

// =========================
// 증강 시스템 타입 정의
// =========================

/**
 * 증강 등급
 */
export type AugmentRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'hidden'

/**
 * 증강 등급 이름 (i18next 사용)
 * 함수로 감싸서 언어 변경 시 업데이트 가능하도록 함
 */
export function getAugmentRarityName(rarity: AugmentRarity): string {
  return i18next.t(`augment.rarity.${rarity}`)
}

/**
 * 증강 등급 이름 전체 객체 반환 (호환성 유지)
 */
export const AUGMENT_RARITY_NAMES: Record<AugmentRarity, string> = new Proxy(
  {} as Record<AugmentRarity, string>,
  {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'string') {
        return getAugmentRarityName(prop as AugmentRarity)
      }
      return undefined
    },
  },
)

/**
 * 증강 타입 (어떤 능력치를 상승시키는지)
 */
export type AugmentStatType = keyof Stats

/**
 * 증강 능력치 이름 (i18next 사용)
 * 함수로 감싸서 언어 변경 시 업데이트 가능하도록 함
 */
export function getAugmentStatName(statType: AugmentStatType): string {
  return i18next.t(`augment.stat.${statType}`)
}

/**
 * 증강 능력치 이름 전체 객체 반환 (호환성 유지)
 */
export const AUGMENT_STAT_NAMES: Record<AugmentStatType, string> = new Proxy(
  {} as Record<AugmentStatType, string>,
  {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'string') {
        return getAugmentStatName(prop as AugmentStatType)
      }
      return undefined
    },
  },
)

/**
 * 증강 능력치 설명 (i18next 사용)
 * 함수로 감싸서 언어 변경 시 업데이트 가능하도록 함
 */
export function getAugmentStatDescription(statType: AugmentStatType): string {
  return i18next.t(`augment.statDescription.${statType}`)
}

/**
 * 증강 능력치 설명 전체 객체 반환 (호환성 유지)
 */
export const AUGMENT_STAT_DESCRIPTIONS: Record<AugmentStatType, string> = new Proxy(
  {} as Record<AugmentStatType, string>,
  {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'string') {
        return getAugmentStatDescription(prop as AugmentStatType)
      }
      return undefined
    },
  },
)

/**
 * 특수 능력 타입
 */
export type SpecialAbilityType = 'lastSpurt' | 'overtake' | 'escapeCrisis'

/**
 * 특수 능력 이름 (i18next 사용)
 * 함수로 감싸서 언어 변경 시 업데이트 가능하도록 함
 */
export function getSpecialAbilityName(abilityType: SpecialAbilityType): string {
  return i18next.t(`augment.specialAbility.${abilityType}`)
}

/**
 * 특수 능력 이름 전체 객체 반환 (호환성 유지)
 */
export const SPECIAL_ABILITY_NAMES: Record<SpecialAbilityType, string> = new Proxy(
  {} as Record<SpecialAbilityType, string>,
  {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'string') {
        return getSpecialAbilityName(prop as SpecialAbilityType)
      }
      return undefined
    },
  },
)

/**
 * 특수 능력 설명 (i18next 사용)
 * 함수로 감싸서 언어 변경 시 업데이트 가능하도록 함
 */
export function getSpecialAbilityDescription(abilityType: SpecialAbilityType): string {
  return i18next.t(`augment.specialAbilityDescription.${abilityType}`)
}

/**
 * 특수 능력 설명 전체 객체 반환 (호환성 유지)
 */
export const SPECIAL_ABILITY_DESCRIPTIONS: Record<SpecialAbilityType, string> = new Proxy(
  {} as Record<SpecialAbilityType, string>,
  {
    get(_target, prop: string | symbol) {
      if (typeof prop === 'string') {
        return getSpecialAbilityDescription(prop as SpecialAbilityType)
      }
      return undefined
    },
  },
)

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
  /** 상승시키는 능력치 타입 (일반 증강인 경우) */
  statType?: AugmentStatType
  /** 능력치 상승량 (일반 증강인 경우) */
  statValue?: number
  /** 특수 능력 타입 (특수 능력인 경우) */
  specialAbility?: SpecialAbilityType
  /** 특수 능력 발동 조건 값 (능력치가 높을수록 더 빨리 발동) */
  specialAbilityValue?: number
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
