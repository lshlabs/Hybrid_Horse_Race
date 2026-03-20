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
export type PlayerMetricMap = Record<string, number>
export type PlayerFinishedMap = Record<string, boolean>

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
  positions: PlayerMetricMap
  speeds: PlayerMetricMap
  stamina: PlayerMetricMap
  finished: PlayerFinishedMap
}

export type OvertakeEvent = {
  id: string
  type: 'overtake'
  elapsedMs: number
  playerId: string
  fromRank: number
  toRank: number
}

export type LastSpurtEvent = {
  id: string
  type: 'lastSpurt'
  elapsedMs: number
  playerId: string
}

export type FinishEvent = {
  id: string
  type: 'finish'
  elapsedMs: number
  playerId: string
  rank: number
}

export type SlowmoTriggerEvent = {
  id: string
  type: 'slowmoTrigger'
  elapsedMs: number
}

// 순위 상승/막판 스퍼트/완주/슬로모 트리거 이벤트 통합 타입
export type RaceScriptEvent = OvertakeEvent | LastSpurtEvent | FinishEvent | SlowmoTriggerEvent

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
