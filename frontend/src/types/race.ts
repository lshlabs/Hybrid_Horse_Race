import type { Stats } from '../engine/race'

// 기존 HorseStats는 Stats 타입으로 교체
// runStyle은 구버전 설계로 제거됨 (말 선택 시스템으로 대체)
export type HorseStats = Stats

export interface HorseData {
  id: string
  playerId: string
  playerName: string
  stats: HorseStats
  /** 트랙 상의 위치 (미터). 엔진 Horse.position과 동일 단위 */
  position: number
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
  /** 트랙 길이 (미터). TileMapManager.getTrackLengthM() 등과 동일 단위 */
  trackLength: number
  playerCount: number
  horses: Array<{
    playerId: string
    playerName: string
    stats: HorseStats
  }>
}
