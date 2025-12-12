import type { Stats } from '../lib/race-sim'
import type { RunStyleId } from '../data/runStyles'

// 기존 HorseStats는 race-sim.ts의 Stats 타입으로 교체
// RunStyle은 별도로 관리 (능력치와 분리)
export interface HorseStats extends Stats {
  runStyle?: RunStyleId // 선택적 필드로 유지 (향후 확장용)
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
