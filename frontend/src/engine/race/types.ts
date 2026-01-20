// =========================
// 레이스 엔진 타입 정의
// =========================

/**
 * 능력치 이름
 */
export type StatName = 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Consistency'

/**
 * 능력치 (6가지)
 * - Speed: 최고 속도
 * - Stamina: 스태미나 소모 효율
 * - Power: 가속력
 * - Guts: 피로 시 최소 속도 바닥
 * - Start: 초반 가속 + 출발 딜레이
 * - Consistency: 컨디션 롤 범위 (로또형 운빨)
 */
export interface Stats {
  Speed: number
  Stamina: number
  Power: number
  Guts: number
  Start: number
  Consistency: number
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
 * 증강 등급 한글 이름
 */
export const AUGMENT_RARITY_NAMES: Record<AugmentRarity, string> = {
  common: '일반',
  rare: '레어',
  epic: '영웅',
  legendary: '전설',
  hidden: '히든',
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
  Stamina: '지구력',
  Power: '가속',
  Guts: '근성',
  Start: '출발',
  Consistency: '일관성',
}

/**
 * 증강 능력치 설명
 */
export const AUGMENT_STAT_DESCRIPTIONS: Record<AugmentStatType, string> = {
  Speed: '최대 속도 증가',
  Stamina: '체력 소모율 감소',
  Power: '가속도 향상',
  Guts: '후반 속도 유지력 향상',
  Start: '출발 속도 증가',
  Consistency: '컨디션 변동폭 감소',
}

/**
 * 특수 능력 타입
 */
export type SpecialAbilityType = 'lastSpurt' | 'overtake' | 'escapeCrisis'

/**
 * 특수 능력 이름
 */
export const SPECIAL_ABILITY_NAMES: Record<SpecialAbilityType, string> = {
  lastSpurt: '라스트 스퍼트',
  overtake: '추월 보너스',
  escapeCrisis: '위기 탈출',
}

/**
 * 특수 능력 설명
 */
export const SPECIAL_ABILITY_DESCRIPTIONS: Record<SpecialAbilityType, string> = {
  lastSpurt: '라스트 스퍼트 발동',
  overtake: '추월할 때마다 속도 증가 + 스태미나 회복(동일 말 중복 제외, 최대 7회)',
  escapeCrisis: '4위 이하일 때 능력치 증가(게임당 1회)',
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
