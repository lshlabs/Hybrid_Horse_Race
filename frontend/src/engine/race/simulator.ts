// =========================
// 레이스 시뮬레이션 엔진
// - 레이스 실행
// - 순위 추적
// - 결과 생성
// =========================

import { Horse } from './horse'
import type { RaceOptions, RaceResult, SnapshotOrder } from './types'
import { DT, MAX_SIM_TIME } from './constants'
import { generateRandomStats } from './stat-system'

// =========================
// 순위 스냅샷 유틸
// =========================

function snapshotOrder(horses: Horse[]): SnapshotOrder[] {
  return horses
    .map((h) => ({ name: h.name, position: h.position }))
    .sort((a, b) => b.position - a.position)
}

function buildRankMap(snapshot: SnapshotOrder[] | null): Record<string, number | null> {
  const map: Record<string, number | null> = {}
  if (!snapshot) return map
  snapshot.forEach((h, idx) => {
    map[h.name] = idx + 1
  })
  return map
}

// =========================
// 레이스 시뮬레이션
// =========================

/**
 * 레이스 시뮬레이션 실행
 * @param options 레이스 옵션
 * @returns 레이스 결과 배열 (순위순)
 */
export function runRace(options: RaceOptions = {}): RaceResult[] {
  const { numHorses = 8, horses: customHorses } = options

  const horses: Horse[] = []

  if (customHorses && customHorses.length > 0) {
    // 명시적으로 말 리스트를 전달한 경우
    for (const h of customHorses) {
      const horse = new Horse(h.name, h.stats)
      horse.prepareForRace()
      horses.push(horse)
    }
  } else {
    // 자동 생성 모드
    for (let i = 0; i < numHorses; i++) {
      const baseStats = generateRandomStats()
      const horse = new Horse(`Horse_${i + 1}`, baseStats)
      horse.prepareForRace()
      horses.push(horse)
    }
  }

  let time = 0

  while (time < MAX_SIM_TIME) {
    let allFinished = true

    // 현재 순위 계산 (추월 감지 및 위기 탈출 발동용)
    const currentRanking = snapshotOrder(horses)
    for (let i = 0; i < currentRanking.length; i++) {
      const horseName = currentRanking[i].name
      const horse = horses.find((h) => h.name === horseName)
      if (horse) {
        horse.updateRank(i + 1)
      }
    }

    for (const h of horses) {
      if (!h.finished) {
        h.step(DT, time)
      }
      if (!h.finished) {
        allFinished = false
      }
    }

    if (allFinished) break
    time += DT
  }

  const results = horses
    .map((h) => ({
      horse: h,
      finishTime: h.finishTime ?? Infinity,
      position: h.position,
      staminaRatio: h.stamina / h.maxStamina,
    }))
    .sort((a, b) => {
      const aFinished = a.finishTime !== Infinity
      const bFinished = b.finishTime !== Infinity

      if (aFinished && bFinished) {
        return (a.finishTime as number) - (b.finishTime as number)
      }
      if (aFinished && !bFinished) return -1
      if (!aFinished && bFinished) return 1
      return b.position - a.position
    })

  const finalSnapshot: SnapshotOrder[] = results.map((r) => ({
    name: r.horse.name,
    position: r.position,
  }))

  const finalRankMap = buildRankMap(finalSnapshot)

  return results.map((r, idx) => {
    const h = r.horse
    const finished = r.finishTime !== Infinity

    return {
      rank: idx + 1,
      horse: h,
      finishTime: finished ? (r.finishTime as number) : null,
      position: r.position,
      staminaRatio: r.staminaRatio,
      finalRank: finalRankMap[h.name] ?? idx + 1,
      conditionRoll: h.conditionRoll,
    }
  })
}
