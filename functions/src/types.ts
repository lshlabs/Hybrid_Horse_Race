/**
 * 공통 타입 정의
 */

export type RoomStatus =
  | 'waiting'
  | 'horseSelection'
  | 'augmentSelection'
  | 'racing'
  | 'setResult'
  | 'finished'

// 실제 게임 엔진의 Stats 구조
export type StatName = 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Luck'

// 증강 등급 (최신 설계)
export type AugmentRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'hidden'

// 특수 능력 타입
export type SpecialAbilityType = 'lastSpurt' | 'overtake' | 'escapeCrisis'

// 증강 인터페이스 (최신 설계)
export interface Augment {
  /** 증강 고유 ID */
  id: string
  /** 증강 이름 */
  name: string
  /** 증강 등급 */
  rarity: AugmentRarity
  /** 상승시키는 능력치 타입 (일반 증강인 경우) */
  statType?: StatName
  /** 능력치 상승량 (일반 증강인 경우) */
  statValue?: number
  /** 특수 능력 타입 (특수 능력인 경우) */
  specialAbility?: SpecialAbilityType
  /** 특수 능력 발동 조건 값 (능력치가 높을수록 더 빨리 발동) */
  specialAbilityValue?: number
  /** 증강 설명 */
  description?: string
}

// 레거시 호환성을 위한 타입 (점진적 제거 예정)
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
  horseStats?: {
    Speed: number
    Stamina: number
    Power: number
    Guts: number
    Start: number
    Luck: number
  } // 실제 게임 엔진의 Stats 구조
  joinedAt: FirebaseFirestore.Timestamp
}

export interface GameSet {
  setIndex: number
  rarity?: AugmentRarity
  availableAugments: Augment[] // 최신 Augment 구조 사용
  availableAugmentsByPlayer?: Record<string, Augment[]>
  selections: Record<string, string> // playerId -> augmentId
  readyForNext?: Record<string, boolean>
  raceResult?: {
    rankings: Array<{ playerId: string; time: number; position: number }>
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
    keyframes: Array<{
      elapsedMs: number
      positions: Record<string, number>
      speeds: Record<string, number>
      stamina: Record<string, number>
      finished: Record<string, boolean>
    }>
    events: Array<
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
    >
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
  rankings: Array<{
    playerId: string
    time: number
    position: number
  }>
  startedAt: FirebaseFirestore.Timestamp
  finishedAt: FirebaseFirestore.Timestamp
}
