import type { Augment, AugmentRarity, AugmentStatType } from '../types/augment'
import { AUGMENT_RARITY_NAMES, AUGMENT_STAT_NAMES } from '../types/augment'
import type { Stats } from '../lib/race-sim'

/**
 * 증강 등급별 능력치 상승량 범위
 */
const AUGMENT_STAT_VALUES: Record<AugmentRarity, { min: number; max: number }> = {
  common: { min: 1, max: 2 },
  rare: { min: 2, max: 4 },
  epic: { min: 4, max: 6 },
  legendary: { min: 6, max: 10 },
}

/**
 * 증강 등급별 가중치 (랜덤 생성 시 확률)
 */
const AUGMENT_RARITY_WEIGHTS: Record<AugmentRarity, number> = {
  common: 35,
  rare: 25,
  epic: 25,
  legendary: 15,
}

/**
 * 모든 능력치 타입
 */
const ALL_STAT_TYPES: AugmentStatType[] = [
  'Speed',
  'Stamina',
  'Power',
  'Guts',
  'Start',
  'Consistency',
]

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

  const rarityName = AUGMENT_RARITY_NAMES[rarity]
  const statName = AUGMENT_STAT_NAMES[statType]
  const name = `[${rarityName}] ${statName} +${value}`

  return {
    id: `${rarity}-${statType}-${value}-${Date.now()}-${Math.random()}`,
    name,
    rarity,
    statType,
    statValue: value,
    description: `${statName} 능력치가 ${value}만큼 상승합니다.`,
  }
}

/**
 * 특정 등급의 증강 선택지 3개 생성
 * @param rarity 증강 등급
 * @returns 3개의 증강 선택지
 */
export function generateAugmentChoices(rarity: AugmentRarity): Augment[] {
  const choices: Augment[] = []
  const availableStats = [...ALL_STAT_TYPES]

  // 3개의 증강 생성 (중복되지 않는 능력치 타입)
  for (let i = 0; i < 3; i++) {
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

  return choices
}

/**
 * 증강을 능력치에 적용
 * @param baseStats 기본 능력치
 * @param augments 적용할 증강들
 * @returns 증강이 적용된 능력치
 */
export function applyAugmentsToStats(baseStats: Stats, augments: Augment[]): Stats {
  const result: Stats = { ...baseStats }

  for (const augment of augments) {
    result[augment.statType] += augment.statValue
  }

  return result
}

/**
 * 증강 선택지 생성 (랜덤 등급)
 * @returns 3개의 증강 선택지
 */
export function generateRandomAugmentChoices(): Augment[] {
  const rarity = generateRandomRarity()
  return generateAugmentChoices(rarity)
}
