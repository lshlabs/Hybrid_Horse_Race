// shared race-core에서 쓰는 기본 타입 정의
export type StatName = 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Luck'

export interface Stats {
  Speed: number
  Stamina: number
  Power: number
  Guts: number
  Start: number
  Luck: number
}

export type AugmentRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'hidden'
export type SpecialAbilityType = 'lastSpurt' | 'overtake' | 'escapeCrisis'

export interface Augment {
  id: string
  name: string
  rarity: AugmentRarity
  statType?: StatName
  statValue?: number
  specialAbility?: SpecialAbilityType
  specialAbilityValue?: number
  description?: string
}

export type RaceScriptKeyframe = {
  elapsedMs: number
  positions: Record<string, number>
  speeds: Record<string, number>
  stamina: Record<string, number>
  finished: Record<string, boolean>
}

export type RaceScriptEvent =
  // 순위가 올라간 순간(추월) 이벤트
  | {
      id: string
      type: 'overtake'
      elapsedMs: number
      playerId: string
      fromRank: number
      toRank: number
    }
  // 막판 스퍼트 시작 이벤트
  | {
      id: string
      type: 'lastSpurt'
      elapsedMs: number
      playerId: string
    }
  // 완주 이벤트
  | {
      id: string
      type: 'finish'
      elapsedMs: number
      playerId: string
      rank: number
    }
  // 결승 직전 연출 트리거(현재는 슬로모 재도입용 데이터로 유지)
  | {
      id: string
      type: 'slowmoTrigger'
      elapsedMs: number
    }

export type RaceRanking = {
  playerId: string
  time: number
  position: number
}

export type RaceScriptBuildInput = {
  playerId: string
  stats: Stats
  augments: Augment[]
  conditionRoll: number
}

export type RaceScriptBuildOptions = {
  trackLengthM: number
  simStepMs: number
  outputFrameMs: number
  maxSimTimeSec: number
}
