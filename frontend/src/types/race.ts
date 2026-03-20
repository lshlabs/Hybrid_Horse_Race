import type { Stats } from '../engine/race'

export type HorseStats = Stats

export interface HorseData {
  id: string
  playerId: string
  playerName: string
  stats: HorseStats
  position: number
  rank: number
  speed: number
  stamina: number
}

export interface RaceState {
  horses: HorseData[]
  elapsedTime: number
  raceLength: number
  isFinished: boolean
  winner?: string
}

export interface RaceConfig {
  trackLength: number
  playerCount: number
  horses: Array<{
    playerId: string
    playerName: string
    stats: HorseStats
  }>
}
