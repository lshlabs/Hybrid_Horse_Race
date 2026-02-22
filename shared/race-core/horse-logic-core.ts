import type { Augment, SpecialAbilityType, Stats } from './types-core'

// HorseCore 안에서 쓰는 "상태 갱신 로직만" 분리한 helper 모음
// 계산 규칙을 클래스 밖으로 빼서 서버/클라 테스트/재사용이 쉬우게 만든다.
export function applyStatAugments(baseStats: Stats, augments: Augment[]): Stats {
  const result = { ...baseStats }
  for (const augment of augments) {
    if (augment.statType && typeof augment.statValue === 'number') {
      result[augment.statType] += augment.statValue
    }
  }
  return result
}

export type HorseSpecialAbilityState = {
  lastSpurtTriggerProgress: number
  overtakeBonusValue: number
  escapeCrisisValue: number
}

export function applySpecialAbilityToState(
  state: HorseSpecialAbilityState,
  abilityType: SpecialAbilityType | string,
  abilityValue: number,
): HorseSpecialAbilityState {
  // 특수 능력 종류별로 상태에 들어가는 값만 바꿔준다.
  if (abilityType === 'lastSpurt') {
    return {
      ...state,
      lastSpurtTriggerProgress: 1.0 - (abilityValue / 10) * 0.2,
    }
  }
  if (abilityType === 'overtake') {
    return {
      ...state,
      overtakeBonusValue: abilityValue,
    }
  }
  if (abilityType === 'escapeCrisis') {
    return {
      ...state,
      escapeCrisisValue: abilityValue,
    }
  }
  return state
}

export type HorseRankUpdateState = {
  currentRank: number
  previousRank: number
  maxStamina: number
  stamina: number
  overtakeBonusValue: number
  overtakeCount: number
  escapeCrisisValue: number
  escapeCrisisUsed: boolean
}

export type HorseRankUpdateResult = {
  currentRank: number
  previousRank: number
  stamina: number
  overtakeCount: number
  overtakeBonusActive: boolean
  staminaRecovered: number
  escapeCrisisActive: boolean
  escapeCrisisUsed: boolean
  isInitialUpdate: boolean
}

export function applyHorseRankUpdate(state: HorseRankUpdateState, rank: number): HorseRankUpdateResult {
  // 첫 업데이트는 "이전 순위" 개념이 없어서 보너스/패널티를 적용하지 않는다.
  const isInitialUpdate = state.currentRank === 999
  const previousRank = state.currentRank
  const currentRank = rank

  if (isInitialUpdate) {
    return {
      currentRank,
      previousRank,
      stamina: state.stamina,
      overtakeCount: state.overtakeCount,
      overtakeBonusActive: false,
      staminaRecovered: 0,
      escapeCrisisActive: false,
      escapeCrisisUsed: state.escapeCrisisUsed,
      isInitialUpdate: true,
    }
  }

  let stamina = state.stamina
  let overtakeCount = state.overtakeCount
  let overtakeBonusActive = false
  let staminaRecovered = 0

  // 추월 성공 시 stamina 소량 회복 + 추월 카운트 증가
  if (state.overtakeBonusValue > 0 && currentRank < previousRank) {
    overtakeBonusActive = true
    overtakeCount += 1
    staminaRecovered = 3
    stamina = Math.min(state.maxStamina, stamina + staminaRecovered)
  }

  let escapeCrisisActive = false
  let escapeCrisisUsed = state.escapeCrisisUsed
  // 위기탈출은 특정 조건에서 한 번만 켜진다.
  if (state.escapeCrisisValue > 0 && !escapeCrisisUsed && currentRank >= 4) {
    escapeCrisisActive = true
    escapeCrisisUsed = true
  }

  return {
    currentRank,
    previousRank,
    stamina,
    overtakeCount,
    overtakeBonusActive,
    staminaRecovered,
    escapeCrisisActive,
    escapeCrisisUsed,
    isInitialUpdate: false,
  }
}
