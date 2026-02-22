// =========================
// 증강 시스템
// - 증강 생성
// - 특수 능력 증강
// - 증강 적용
// =========================

import type { Augment, AugmentRarity, AugmentStatType } from './types'
import { AUGMENT_STAT_NAMES, SPECIAL_ABILITY_NAMES } from './types'
import type { Stats } from './types'
import { applyStatAugments as applyStatAugmentsCore } from '../../../../shared/race-core/horse-logic-core'

/**
 * 증강 등급별 능력치 상승량 범위
 */
const AUGMENT_STAT_VALUES: Record<AugmentRarity, { min: number; max: number }> = {
  common: { min: 1, max: 2 },
  rare: { min: 3, max: 4 },
  epic: { min: 5, max: 6 },
  legendary: { min: 7, max: 10 },
  hidden: { min: 6, max: 10 }, // 히든 등급 수치 범위는 레전더리와 동일하게 사용
}

/**
 * 증강 등급별 가중치 (랜덤 생성 시 확률)
 */
const AUGMENT_RARITY_WEIGHTS: Record<AugmentRarity, number> = {
  common: 35,
  rare: 25,
  epic: 25,
  legendary: 15,
  hidden: 0, // 히든 등급은 일반 랜덤 뽑기에서 안 나오고 별도 조건으로만 생성
}

/**
 * 모든 능력치 타입
 */
const ALL_STAT_TYPES: AugmentStatType[] = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Luck']
// 히든 특수 능력 값 범위를 한 곳에 모아두면 나중에 밸런스 조정할 때 보기 쉽다.
const HIDDEN_SPECIAL_ABILITY_VALUE_RANGE = { min: 6, max: 10 } as const

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

function buildAugmentId(prefix: string, rarity: AugmentRarity, value: number): string {
  return `${prefix}-${rarity}-${value}-${Date.now()}-${Math.random()}`
}

function createHiddenSpecialAugment(
  specialAbility: Augment['specialAbility'],
  abilityName: string,
): Augment {
  // 히든 특수 능력 3종이 같은 패턴이라 공통 생성 함수로 묶어둔다.
  const rarity: AugmentRarity = 'hidden'
  const abilityValue = randomInt(
    HIDDEN_SPECIAL_ABILITY_VALUE_RANGE.min,
    HIDDEN_SPECIAL_ABILITY_VALUE_RANGE.max,
  )

  return {
    id: buildAugmentId(String(specialAbility), rarity, abilityValue),
    name: abilityName,
    rarity,
    specialAbility,
    specialAbilityValue: abilityValue,
  }
}

function shuffleInPlace<T>(items: T[]): void {
  // 선택지 순서를 섞어서 특수 카드가 항상 같은 위치에 오지 않게 한다.
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
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
  const name = `${statName} +${value}` // 등급은 카드 색상으로 보여줘서 이름은 단순하게 둔다.

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
  const abilityName = SPECIAL_ABILITY_NAMES.lastSpurt
  return createHiddenSpecialAugment('lastSpurt', abilityName)
}

/**
 * 추월 보너스 특수 능력 증강 생성 (히든 등급)
 */
export function createOvertakeAugment(): Augment {
  const abilityName = SPECIAL_ABILITY_NAMES.overtake
  return createHiddenSpecialAugment('overtake', abilityName)
}

/**
 * 위기 탈출 특수 능력 증강 생성 (히든 등급)
 */
export function createEscapeCrisisAugment(): Augment {
  const abilityName = SPECIAL_ABILITY_NAMES.escapeCrisis
  return createHiddenSpecialAugment('escapeCrisis', abilityName)
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

  // 전설 등급에서만 특수 능력 카드가 섞일 수 있다.
  if (rarity === 'legendary') {
    // 전설 카드 중 일부만 히든 특수 능력으로 바꿔준다.
    const roll = Math.random()
    if (roll < 0.05) {
      // 각 구간이 5%씩이라 특수 능력 3종 확률이 같다.
      choices.push(createLastSpurtAugment())
    } else if (roll < 0.1) {
      choices.push(createOvertakeAugment())
    } else if (roll < 0.15) {
      choices.push(createEscapeCrisisAugment())
    }
  }

  const availableStats = [...ALL_STAT_TYPES]

  // 남은 칸은 일반 능력치 증강으로 채운다.
  while (choices.length < 3) {
    // 후보가 다 떨어지면 다시 채워서 중복도 허용한다.
    if (availableStats.length === 0) {
      availableStats.push(...ALL_STAT_TYPES)
    }

    // 능력치 타입 하나 선택
    const randomIndex = randomInt(0, availableStats.length - 1)
    const statType = availableStats.splice(randomIndex, 1)[0]

    // 선택한 타입으로 카드 생성
    const augment = createAugment(rarity, statType)
    choices.push(augment)
  }

  // 특수 카드가 항상 앞에 보이지 않도록 마지막에 섞는다.
  shuffleInPlace(choices)

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
  return applyStatAugmentsCore(baseStats, augments)
}
