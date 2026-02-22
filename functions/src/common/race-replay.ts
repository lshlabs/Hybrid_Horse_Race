import type { ServerRaceEvent, ServerRaceKeyframe } from './response-builders'

// 레거시/보조 경로에서 쓰는 서버 레이스 재생 스크립트 생성기
// (현재는 shared/race-core buildRaceScript가 주력이고, 이 파일은 호환용 성격이 남아있다.)
export type ServerHorseStats = {
  Speed: number
  Stamina: number
  Power: number
  Guts: number
  Start: number
  Luck: number
}

type ReplayRanking = { playerId: string; time: number; position: number }

type RaceReplayBuilderDefaults = {
  trackLengthM: number
  tickIntervalMs: number
}

export function createRaceReplayScriptBuilder(defaults: RaceReplayBuilderDefaults) {
  return function buildRaceReplayScript(
    rankings: ReplayRanking[],
    playerProfiles?: Record<string, ServerHorseStats>,
    options?: { trackLengthM?: number; tickIntervalMs?: number },
  ): {
    keyframes: ServerRaceKeyframe[]
    events: ServerRaceEvent[]
    slowmoTriggerMs: number
  } {
    // rankings(결과 시간) 기준으로 keyframe/events를 재구성하는 단순 버전 replay builder
    const trackLengthM = options?.trackLengthM ?? defaults.trackLengthM
    const tickIntervalMs = options?.tickIntervalMs ?? defaults.tickIntervalMs
    const maxTimeMs = Math.max(0, ...rankings.map((entry) => Math.round(entry.time * 1000)))
    const keyframes: ServerRaceKeyframe[] = []
    const events: ServerRaceEvent[] = []

    const profileProgressMap: Record<string, number[]> = {}
    const profileLastSpurtMs: Record<string, number> = {}
    // 프로필 스탯이 있으면 초반 가속/후반 지구력 느낌만 간단히 반영한다.
    rankings.forEach((entry) => {
      const finishMs = Math.max(1, Math.round(entry.time * 1000))
      const tickCount = Math.max(1, Math.ceil(finishMs / tickIntervalMs))
      const profile = playerProfiles?.[entry.playerId]
      const startPower = ((profile?.Start ?? 10) + (profile?.Power ?? 10)) / 40
      const endurance = ((profile?.Stamina ?? 10) + (profile?.Guts ?? 10)) / 40
      const accelDurationRatio = 0.12 + (1 - startPower) * 0.18
      const fatigueStartRatio = 0.55 + endurance * 0.3
      const fatigueFloor = 0.72 + endurance * 0.18

      const weights: number[] = []
      for (let tick = 0; tick <= tickCount; tick++) {
        const progress = tick / tickCount
        let pace = 1
        if (progress < accelDurationRatio) {
          const t = progress / Math.max(0.0001, accelDurationRatio)
          pace = 0.45 + 0.55 * t * t
        } else if (progress > fatigueStartRatio) {
          const t = (progress - fatigueStartRatio) / Math.max(0.0001, 1 - fatigueStartRatio)
          pace = 1 - (1 - fatigueFloor) * Math.min(1, t)
        }
        weights.push(pace)
      }

      const cumulative: number[] = []
      let sum = 0
      weights.forEach((weight) => {
        sum += weight
        cumulative.push(sum)
      })

      const total = cumulative[cumulative.length - 1] || 1
      profileProgressMap[entry.playerId] = cumulative.map((value) => value / total)
      profileLastSpurtMs[entry.playerId] = Math.max(0, Math.floor(finishMs * 0.78))
    })

    // 우승자 기준 95% 지점에 slowmoTrigger 이벤트를 넣는다.
    const winner = rankings.find((entry) => entry.position === 1)
    const winnerFinishMs = winner ? Math.round(winner.time * 1000) : maxTimeMs
    const slowmoTriggerMs = Math.max(0, Math.round(winnerFinishMs * 0.95))
    events.push({
      id: `slowmo-${slowmoTriggerMs}`,
      type: 'slowmoTrigger',
      elapsedMs: slowmoTriggerMs,
    })

    const previousRankByPlayer: Record<string, number> = {}

    // tick 간격으로 전체 타임라인을 돌면서 positions/keyframes/events를 만든다.
    for (let elapsedMs = 0; elapsedMs <= maxTimeMs + tickIntervalMs; elapsedMs += tickIntervalMs) {
      const positions: Record<string, number> = {}
      const speeds: Record<string, number> = {}
      const stamina: Record<string, number> = {}
      const finished: Record<string, boolean> = {}

      rankings.forEach((entry) => {
        const finishMs = Math.max(1, Math.round(entry.time * 1000))
        const ratio = Math.max(0, Math.min(1, elapsedMs / finishMs))
        const progressCurve = profileProgressMap[entry.playerId]
        let progress = ratio

        if (progressCurve && progressCurve.length > 1) {
          const idxFloat = ratio * (progressCurve.length - 1)
          const lo = Math.floor(idxFloat)
          const hi = Math.min(progressCurve.length - 1, lo + 1)
          const t = idxFloat - lo
          progress = progressCurve[lo] * (1 - t) + progressCurve[hi] * t
        }

        const position = Number((trackLengthM * progress).toFixed(4))
        positions[entry.playerId] = position

        const remainingRatio = Math.max(0, 1 - progress)
        const profile = playerProfiles?.[entry.playerId]
        const staminaLossFactor = 0.85 + (1 - (profile?.Stamina ?? 10) / 20) * 0.35
        const staminaValue = Math.max(0, 100 - (1 - remainingRatio) * 100 * staminaLossFactor)
        stamina[entry.playerId] = Number(staminaValue.toFixed(2))

        finished[entry.playerId] = progress >= 1

        if (
          elapsedMs >= profileLastSpurtMs[entry.playerId] &&
          elapsedMs < profileLastSpurtMs[entry.playerId] + tickIntervalMs
        ) {
          events.push({
            id: `last-spurt-${entry.playerId}-${profileLastSpurtMs[entry.playerId]}`,
            type: 'lastSpurt',
            elapsedMs: profileLastSpurtMs[entry.playerId],
            playerId: entry.playerId,
          })
        }

        if (finished[entry.playerId] && elapsedMs >= finishMs && elapsedMs < finishMs + tickIntervalMs) {
          events.push({
            id: `finish-${entry.playerId}-${finishMs}`,
            type: 'finish',
            elapsedMs: finishMs,
            playerId: entry.playerId,
            rank: entry.position,
          })
        }
      })

      const rankingNow = Object.keys(positions)
        .map((playerId) => ({ playerId, position: positions[playerId] }))
        .sort((a, b) =>
          a.position === b.position ? a.playerId.localeCompare(b.playerId) : b.position - a.position,
        )

      rankingNow.forEach((entry, index) => {
        const rank = index + 1
        const previousRank = previousRankByPlayer[entry.playerId]
        if (typeof previousRank === 'number' && rank < previousRank) {
          events.push({
            id: `overtake-${entry.playerId}-${elapsedMs}-${previousRank}-${rank}`,
            type: 'overtake',
            elapsedMs,
            playerId: entry.playerId,
            fromRank: previousRank,
            toRank: rank,
          })
        }
        previousRankByPlayer[entry.playerId] = rank
      })

      if (keyframes.length > 0) {
        const previousKeyframe = keyframes[keyframes.length - 1]
        Object.keys(positions).forEach((playerId) => {
          const delta = Math.max(0, positions[playerId] - (previousKeyframe.positions[playerId] ?? 0))
          speeds[playerId] = Number((delta / (tickIntervalMs / 1000)).toFixed(4))
        })
      } else {
        Object.keys(positions).forEach((playerId) => {
          speeds[playerId] = 0
        })
      }

      keyframes.push({
        elapsedMs,
        positions,
        speeds,
        stamina,
        finished,
      })
    }

    return { keyframes, events, slowmoTriggerMs }
  }
}
