// =========================
// 증강 시스템
// - 증강 생성
// - 특수 능력 증강
// - 증강 적용
// =========================

import type { Augment, AugmentRarity, AugmentStatType } from './types'
import { AUGMENT_STAT_NAMES, SPECIAL_ABILITY_NAMES } from './types'
import type { Stats } from './types'

/**
 * 증강 등급별 능력치 상승량 범위
 */
const AUGMENT_STAT_VALUES: Record<AugmentRarity, { min: number; max: number }> = {
  common: { min: 1, max: 2 },
  rare: { min: 3, max: 4 },
  epic: { min: 5, max: 6 },
  legendary: { min: 7, max: 10 },
  hidden: { min: 6, max: 10 }, // 히든 등급은 레전더리와 동일
}

/**
 * 증강 등급별 가중치 (랜덤 생성 시 확률)
 */
const AUGMENT_RARITY_WEIGHTS: Record<AugmentRarity, number> = {
  common: 35,
  rare: 25,
  epic: 25,
  legendary: 15,
  hidden: 0, // 히든 등급은 직접 생성되므로 가중치 없음
}

/**
 * 모든 능력치 타입
 */
const ALL_STAT_TYPES: AugmentStatType[] = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Luck']

/**
 * 랜덤 정수 생성 (min ~ max)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * 가중치 기반 랜덤 선택
 */
function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let random = Math.random() * totalWeight

  for (let i = 0; i < items.length; i++) {
    random -= weights[i]
    if (random <= 0) {
      return items[i]
    }
  }

  return items[items.length - 1]
}

// =========================
// 증강 생성
// =========================

/**
 * 증강 등급 랜덤 생성
 */
export function generateRandomRarity(): AugmentRarity {
  const rarities: AugmentRarity[] = ['common', 'rare', 'epic', 'legendary']
  const weights = rarities.map((rarity) => AUGMENT_RARITY_WEIGHTS[rarity])
  return weightedRandom(rarities, weights)
}

/**
 * 증강 생성
 */
export function createAugment(
  rarity: AugmentRarity,
  statType: AugmentStatType,
  statValue?: number,
): Augment {
  const valueRange = AUGMENT_STAT_VALUES[rarity]
  const value = statValue ?? randomInt(valueRange.min, valueRange.max)

  const statName = AUGMENT_STAT_NAMES[statType]
  const name = `${statName} +${value}` // 등급 접두사 제거 (카드 색상으로 구분)

  return {
    id: `${rarity}-${statType}-${value}-${Date.now()}-${Math.random()}`,
    name,
    rarity,
    statType,
    statValue: value,
  }
}

// =========================
// 특수 능력 증강
// =========================

/**
 * 라스트 스퍼트 특수 능력 증강 생성 (히든 등급)
 */
export function createLastSpurtAugment(): Augment {
  const rarity: AugmentRarity = 'hidden'
  const abilityName = SPECIAL_ABILITY_NAMES.lastSpurt
  const name = abilityName // 특수 능력은 등급 접두사 제거

  // 능력치가 높을수록 더 빨리 발동 (6~10 범위, 레전더리와 동일)
  // 수치 10 → 400m(0.8 진행률)에서 발동
  // 수치 6 → 440m(0.88 진행률)에서 발동
  const abilityValue = randomInt(6, 10)

  return {
    id: `lastSpurt-${rarity}-${abilityValue}-${Date.now()}-${Math.random()}`,
    name,
    rarity,
    specialAbility: 'lastSpurt',
    specialAbilityValue: abilityValue,
  }
}

/**
 * 추월 보너스 특수 능력 증강 생성 (히든 등급)
 */
export function createOvertakeAugment(): Augment {
  const rarity: AugmentRarity = 'hidden'
  const abilityName = SPECIAL_ABILITY_NAMES.overtake
  const name = abilityName

  // 수치: 추월 시 속도 증가량 (6~10 범위)
  // 수치가 높을수록 더 큰 속도 증가
  const abilityValue = randomInt(6, 10)

  return {
    id: `overtake-${rarity}-${abilityValue}-${Date.now()}-${Math.random()}`,
    name,
    rarity,
    specialAbility: 'overtake',
    specialAbilityValue: abilityValue,
  }
}

/**
 * 위기 탈출 특수 능력 증강 생성 (히든 등급)
 */
export function createEscapeCrisisAugment(): Augment {
  const rarity: AugmentRarity = 'hidden'
  const abilityName = SPECIAL_ABILITY_NAMES.escapeCrisis
  const name = abilityName // 특수 능력은 등급 접두사 제거

  // 수치: 능력치 증가량 (6~10 범위)
  // 수치가 높을수록 더 큰 능력치 증가
  const abilityValue = randomInt(6, 10)

  return {
    id: `escapeCrisis-${rarity}-${abilityValue}-${Date.now()}-${Math.random()}`,
    name,
    rarity,
    specialAbility: 'escapeCrisis',
    specialAbilityValue: abilityValue,
  }
}

// =========================
// 증강 선택지 생성
// =========================

/**
 * 특정 등급의 증강 선택지 3개 생성
 * @param rarity 증강 등급
 * @returns 3개의 증강 선택지
 */
export function generateAugmentChoices(rarity: AugmentRarity): Augment[] {
  const choices: Augment[] = []

  // 전설 등급인 경우 특수 능력 포함 가능
  if (rarity === 'legendary') {
    // 15% 확률로 히든 등급 특수 능력 포함
    const roll = Math.random()
    if (roll < 0.05) {
      // 5% 확률: 라스트 스퍼트
      choices.push(createLastSpurtAugment())
    } else if (roll < 0.1) {
      // 5% 확률: 추월 보너스
      choices.push(createOvertakeAugment())
    } else if (roll < 0.15) {
      // 5% 확률: 위기 탈출
      choices.push(createEscapeCrisisAugment())
    }
  }

  const availableStats = [...ALL_STAT_TYPES]

  // 나머지 슬롯을 일반 증강으로 채움
  while (choices.length < 3) {
    // 사용 가능한 능력치 타입이 부족하면 다시 사용 가능하도록
    if (availableStats.length === 0) {
      availableStats.push(...ALL_STAT_TYPES)
    }

    // 랜덤으로 능력치 타입 선택
    const randomIndex = randomInt(0, availableStats.length - 1)
    const statType = availableStats.splice(randomIndex, 1)[0]

    // 증강 생성
    const augment = createAugment(rarity, statType)
    choices.push(augment)
  }

  // 순서 섞기
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[choices[i], choices[j]] = [choices[j], choices[i]]
  }

  return choices
}

/**
 * 증강 선택지 생성 (랜덤 등급)
 * @returns 3개의 증강 선택지
 */
export function generateRandomAugmentChoices(): Augment[] {
  const rarity = generateRandomRarity()
  return generateAugmentChoices(rarity)
}

// =========================
// 증강 적용
// =========================

/**
 * 증강을 능력치에 적용
 * @param baseStats 기본 능력치
 * @param augments 적용할 증강들
 * @returns 증강이 적용된 능력치
 */
export function applyAugmentsToStats(baseStats: Stats, augments: Augment[]): Stats {
  const result: Stats = { ...baseStats }

  for (const augment of augments) {
    // 일반 증강인 경우에만 능력치 적용
    if (augment.statType && augment.statValue != null) {
      result[augment.statType] += augment.statValue
    }
    // 특수 능력은 능력치에 직접 영향을 주지 않음
  }

  return result
}
