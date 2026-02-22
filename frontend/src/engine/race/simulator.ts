// =========================
// 레이스 시뮬레이션 엔진
// - 말 업데이트 루프
// - 순위 추적
// - 결과 생성
// =========================

import { Horse } from './horse'
import type { RaceOptions, RaceResult, SnapshotOrder } from './types'
import { SIM_STEP_SEC, MAX_SIM_TIME_SEC } from './constants'
import { generateRandomStats } from './stat-system'

// =========================
// 순위 스냅샷 유틸
// =========================

function snapshotOrder(horses: Horse[]): SnapshotOrder[] {
  // 현재 위치 기준으로 임시 순위를 만든다. (추월 감지용)
  return horses
    .map((h) => ({ name: h.name, position: h.position }))
    .sort((a, b) => b.position - a.position)
}

function buildRankMap(snapshot: SnapshotOrder[] | null): Record<string, number | null> {
  // 최종 결과를 이름으로 빠르게 찾으려고 rank map으로 한번 바꿔둔다.
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
    // 테스트처럼 말 리스트를 직접 넘긴 경우
    for (const h of customHorses) {
      const horse = new Horse(h.name, h.stats)
      horse.prepareForRace()
      horses.push(horse)
    }
  } else {
    // 별도 입력이 없으면 여기서 랜덤 말을 만든다.
    for (let i = 0; i < numHorses; i++) {
      const baseStats = generateRandomStats()
      const horse = new Horse(`Horse_${i + 1}`, baseStats)
      horse.prepareForRace()
      horses.push(horse)
    }
  }

  // 시뮬레이션 시간(초). 루프를 돌 때마다 dt만큼 증가한다.
  let time = 0

  while (time < MAX_SIM_TIME_SEC) {
    let allFinished = true

    // 먼저 순위를 계산해서 말 step 안에서 추월/위기탈출 조건에 쓴다.
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
        h.step(SIM_STEP_SEC, time)
      }
      if (!h.finished) {
        allFinished = false
      }
    }

    if (allFinished) break
    time += SIM_STEP_SEC
  }

  // 결과 정렬 규칙:
  // - 완주한 말은 finishTime 빠른 순
  // - 미완주 말은 더 멀리 간 순
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
