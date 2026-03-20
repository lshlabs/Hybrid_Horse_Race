import type { ServerRaceEvent, ServerRaceKeyframe } from './response-builders'

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

const MIN_RATIO_DENOMINATOR = 0.0001
const DEFAULT_PROFILE_STAT = 10
const START_ACCEL_BASE = 0.12
const START_ACCEL_SPREAD = 0.18
const FATIGUE_START_BASE = 0.55
const FATIGUE_START_SPREAD = 0.3
const FATIGUE_FLOOR_BASE = 0.72
const FATIGUE_FLOOR_SPREAD = 0.18
const LAST_SPURT_RATIO = 0.78
const SLOWMO_TRIGGER_RATIO = 0.95
const MIN_TICK_INTERVAL_MS = 1
const MIN_FINISH_MS = 1
const MS_PER_SECOND = 1000

function toFinishMs(timeSec: number): number {
  return Math.max(MIN_FINISH_MS, Math.round(timeSec * MS_PER_SECOND))
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
    const trackLengthM = options?.trackLengthM ?? defaults.trackLengthM
    const tickIntervalMs = Math.max(MIN_TICK_INTERVAL_MS, options?.tickIntervalMs ?? defaults.tickIntervalMs)
    const maxTimeMs = Math.max(0, ...rankings.map((entry) => Math.round(entry.time * MS_PER_SECOND)))
    const keyframes: ServerRaceKeyframe[] = []
    const events: ServerRaceEvent[] = []

    const profileProgressMap: Record<string, number[]> = {}
    const profileLastSpurtMs: Record<string, number> = {}
    rankings.forEach((entry) => {
      const finishMs = toFinishMs(entry.time)
      const tickCount = Math.max(1, Math.ceil(finishMs / tickIntervalMs))
      const profile = playerProfiles?.[entry.playerId]
      const startPower =
        ((profile?.Start ?? DEFAULT_PROFILE_STAT) + (profile?.Power ?? DEFAULT_PROFILE_STAT)) / 40
      const endurance =
        ((profile?.Stamina ?? DEFAULT_PROFILE_STAT) + (profile?.Guts ?? DEFAULT_PROFILE_STAT)) / 40
      const accelDurationRatio = START_ACCEL_BASE + (1 - startPower) * START_ACCEL_SPREAD
      const fatigueStartRatio = FATIGUE_START_BASE + endurance * FATIGUE_START_SPREAD
      const fatigueFloor = FATIGUE_FLOOR_BASE + endurance * FATIGUE_FLOOR_SPREAD

      const weights: number[] = []
      for (let tick = 0; tick <= tickCount; tick++) {
        const progress = tick / tickCount
        let pace = 1
        if (progress < accelDurationRatio) {
          const t = progress / Math.max(MIN_RATIO_DENOMINATOR, accelDurationRatio)
          pace = 0.45 + 0.55 * t * t
        } else if (progress > fatigueStartRatio) {
          const t =
            (progress - fatigueStartRatio) / Math.max(MIN_RATIO_DENOMINATOR, 1 - fatigueStartRatio)
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
      profileLastSpurtMs[entry.playerId] = Math.max(0, Math.floor(finishMs * LAST_SPURT_RATIO))
    })

    const winner = rankings.find((entry) => entry.position === 1)
    const winnerFinishMs = winner ? Math.round(winner.time * MS_PER_SECOND) : maxTimeMs
    const slowmoTriggerMs = Math.max(0, Math.round(winnerFinishMs * SLOWMO_TRIGGER_RATIO))
    events.push({
      id: `slowmo-${slowmoTriggerMs}`,
      type: 'slowmoTrigger',
      elapsedMs: slowmoTriggerMs,
    })

    const previousRankByPlayer: Record<string, number> = {}

    for (let elapsedMs = 0; elapsedMs <= maxTimeMs + tickIntervalMs; elapsedMs += tickIntervalMs) {
      const positions: Record<string, number> = {}
      const speeds: Record<string, number> = {}
      const stamina: Record<string, number> = {}
      const finished: Record<string, boolean> = {}

      rankings.forEach((entry) => {
        const finishMs = toFinishMs(entry.time)
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
        const staminaLossFactor =
          0.85 + (1 - (profile?.Stamina ?? DEFAULT_PROFILE_STAT) / 20) * 0.35
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
          speeds[playerId] = Number((delta / (tickIntervalMs / MS_PER_SECOND)).toFixed(4))
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
