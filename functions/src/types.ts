/**
 * 공통 타입 정의
 */

export type RoomStatus =
  | 'waiting'
  | 'runStyleSelection'
  | 'augmentSelection'
  | 'racing'
  | 'setResult'
  | 'finished'

export type RunStyleId = 'paceSetter' | 'frontRunner' | 'stalker' | 'closer'

export type AugmentCategory = 'speed' | 'stamina' | 'runStyle' | 'condition' | 'jockey'

export type AugmentRarity = 'common' | 'rare' | 'epic'

export interface AugmentDefinition {
  id: string
  name: Record<string, string> // locale key
  description: Record<string, string>
  category: AugmentCategory
  rarity: AugmentRarity
  effects: AugmentEffect[]
}

export type AugmentEffect =
  | { type: 'speedBonus'; amount: number }
  | { type: 'staminaBonus'; amount: number }
  | { type: 'runStyleSuccess'; style: RunStyleId; bonus: number }
  | { type: 'conditionFloor'; value: number }
  | { type: 'jockeyBonus'; accel: number; recovery: number }

export interface Room {
  hostId: string
  title: string
  setCount: number
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
  runStyle?: RunStyleId
  selectedAugments: Array<{
    setIndex: number
    augmentId: string
  }>
  horseStats?: {
    speed: number
    stamina: number
    condition: number
    jockeySkill: number
  }
  joinedAt: FirebaseFirestore.Timestamp
}

export interface GameSet {
  setIndex: number
  availableAugments: AugmentDefinition[]
  selections: Record<string, string> // playerId -> augmentId
  raceResult?: {
    rankings: Array<{ playerId: string; time: number; position: number }>
    startedAt: FirebaseFirestore.Timestamp
    finishedAt: FirebaseFirestore.Timestamp
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


