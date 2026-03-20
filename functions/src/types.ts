export type RoomStatus =
  | 'waiting'
  | 'horseSelection'
  | 'augmentSelection'
  | 'racing'
  | 'setResult'
  | 'finished'

export type StatName = 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Luck'
export type HorseStats = Record<StatName, number>

export type AugmentRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'hidden'
export type SpecialAbilityType = 'lastSpurt' | 'overtake' | 'escapeCrisis'
export type RaceRankingEntry = { playerId: string; time: number; position: number }
export type RaceReplayKeyframe = {
  elapsedMs: number
  positions: Record<string, number>
  speeds: Record<string, number>
  stamina: Record<string, number>
  finished: Record<string, boolean>
}
export type RaceReplayEvent =
  | {
      id: string
      type: 'overtake'
      elapsedMs: number
      playerId: string
      fromRank: number
      toRank: number
    }
  | {
      id: string
      type: 'lastSpurt'
      elapsedMs: number
      playerId: string
    }
  | {
      id: string
      type: 'finish'
      elapsedMs: number
      playerId: string
      rank: number
    }
  | {
      id: string
      type: 'slowmoTrigger'
      elapsedMs: number
    }

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

export type AugmentDefinition = Augment

export interface Room {
  title: string
  maxPlayers: number
  roundCount: number
  rerollLimit: number
  rerollUsed: number
  status: RoomStatus
  currentSet: number
  createdAt: FirebaseFirestore.Timestamp
  updatedAt: FirebaseFirestore.Timestamp
}

export interface Player {
  name: string
  avatar?: string
  isHost: boolean
  isReady: boolean
  rerollUsed?: number
  currentSetLuckBonus?: number
  selectedAugments: Array<{
    setIndex: number
    augmentId: string
  }>
  horseStats?: HorseStats
  joinedAt: FirebaseFirestore.Timestamp
}

export interface GameSet {
  setIndex: number
  rarity?: AugmentRarity
  availableAugments: Augment[]
  availableAugmentsByPlayer?: Record<string, Augment[]>
  selections: Record<string, string>
  readyForNext?: Record<string, boolean>
  raceResult?: {
    rankings: Array<RaceRankingEntry>
    startedAt: FirebaseFirestore.Timestamp
    finishedAt: FirebaseFirestore.Timestamp
  }
  raceState?: {
    status: 'running' | 'completed'
    scriptVersion: string
    raceStateDocVersion?: string
    startedAt: FirebaseFirestore.Timestamp
    simStepMs?: number
    outputFrameMs?: number
    tickIntervalMs: number
    trackLengthM: number
    keyframes: Array<RaceReplayKeyframe>
    events: Array<RaceReplayEvent>
    slowmoTriggerMs: number
    seedBundle?: {
      raceSeedKey: string
      conditionRollByPlayer: Record<string, number>
    }
    inputsSnapshotHash?: string
    deterministicMeta?: {
      source: string
      seedKey: string
      engineVersion: string
      configHash: string
    }
  }
  status: 'pending' | 'augmentSelection' | 'racing' | 'completed'
  createdAt: FirebaseFirestore.Timestamp
}

export interface RaceResult {
  rankings: Array<RaceRankingEntry>
  startedAt: FirebaseFirestore.Timestamp
  finishedAt: FirebaseFirestore.Timestamp
}
