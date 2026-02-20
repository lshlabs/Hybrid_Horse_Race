import type { Augment } from '../engine/race'

/** 순위 계산용 말 스냅샷 (엔진 Horse와 분리된 순수 데이터) */
export interface HorseSnapshot {
  position: number
  finished: boolean
  finishTime: number | null
  name: string
}

/** 라운드 결과 한 명 분 (RaceResultScene / React 전달용) */
export interface RoundRankingEntry {
  rank: number
  name: string
  time: number
  finished: boolean
  augments: Augment[]
  horseIndex: number
}

/**
 * 시뮬레이션 말 목록과 증강/이름 정보로 라운드 순위를 계산 (순수 함수)
 */
export function computeRoundRankings(
  horses: HorseSnapshot[],
  options: {
    horseAugmentsByIndex: (index: number) => Augment[]
    playerNameByIndex: (index: number) => string
    currentTime: number
  },
): RoundRankingEntry[] {
  const { horseAugmentsByIndex, playerNameByIndex, currentTime } = options

  const withIndex = horses.map((horse, index) => ({
    horse,
    index,
    position: horse.position,
    finished: horse.finished,
    finishTime: horse.finishTime ?? null,
    currentTime,
  }))

  const sorted = withIndex.slice().sort((a, b) => {
    if (a.finished && !b.finished) return -1
    if (!a.finished && b.finished) return 1
    if (a.finished && b.finished) {
      const aTime = a.finishTime ?? Infinity
      const bTime = b.finishTime ?? Infinity
      return aTime - bTime
    }
    return b.position - a.position
  })

  return sorted.map((result, rankIndex) => ({
    rank: rankIndex + 1,
    name: playerNameByIndex(result.index) || result.horse.name,
    time: result.finished && result.finishTime != null ? result.finishTime : result.currentTime,
    finished: result.finished,
    augments: horseAugmentsByIndex(result.index) ?? [],
    horseIndex: result.index,
  }))
}
