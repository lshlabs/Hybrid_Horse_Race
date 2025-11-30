import type { RunStyleId } from '../data/runStyles'

export interface HorseStats {
  speed: number
  stamina: number
  condition: number
  jockeySkill: number
  runStyle: RunStyleId
}

export interface HorseData {
  id: string
  playerId: string
  playerName: string
  stats: HorseStats
  position: number // 트랙 상의 위치 (0.0 ~ 1.0)
  rank: number
  speed: number // 현재 속도
  stamina: number // 현재 지구력
}

export interface RaceState {
  horses: HorseData[]
  elapsedTime: number
  raceLength: number // 총 거리 (미터)
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

