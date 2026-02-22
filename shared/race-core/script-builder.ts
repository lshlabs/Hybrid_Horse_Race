import { createHash } from 'crypto'
import {
  DEFAULT_MAX_SIM_TIME_SEC,
  DEFAULT_OUTPUT_FRAME_MS,
  DEFAULT_SIM_STEP_MS,
  DEFAULT_TRACK_LENGTH_M,
} from './constants-core'
import { HorseCore } from './horse-core'
import { createSeededRandom } from './rng-core'
import { rollConditionFromSeed } from './stat-system-core'
import type {
  RaceScriptBuildInput,
  RaceScriptBuildOptions,
  RaceScriptEvent,
  RaceScriptKeyframe,
  RaceRanking,
} from './types-core'

type BuildRaceScriptResult = {
  keyframes: RaceScriptKeyframe[]
  events: RaceScriptEvent[]
  rankings: RaceRanking[]
  slowmoTriggerMs: number
  simStepMs: number
  outputFrameMs: number
  trackLengthM: number
  conditionRollByPlayer: Record<string, number>
  snapshotHash: string
}

export function buildRaceScript(
  inputs: RaceScriptBuildInput[],
  options?: Partial<RaceScriptBuildOptions>,
): BuildRaceScriptResult {
  const trackLengthM = options?.trackLengthM ?? DEFAULT_TRACK_LENGTH_M
  const simStepMs = options?.simStepMs ?? DEFAULT_SIM_STEP_MS
  const outputFrameMs = options?.outputFrameMs ?? DEFAULT_OUTPUT_FRAME_MS
  const maxSimTimeSec = options?.maxSimTimeSec ?? DEFAULT_MAX_SIM_TIME_SEC

  const conditionRollByPlayer: Record<string, number> = {}
  const normalizedInputs = inputs
    .map((entry) => {
      const seededRoll = rollConditionFromSeed(
        entry.stats.Luck,
        createSeededRandom(`condition|${entry.playerId}|${entry.stats.Luck}`),
      )
      const roll = typeof entry.conditionRoll === 'number' ? entry.conditionRoll : seededRoll
      conditionRollByPlayer[entry.playerId] = roll
      return {
        ...entry,
        conditionRoll: roll,
      }
    })
    .sort((a, b) => a.playerId.localeCompare(b.playerId))

  const horses = normalizedInputs.map(
    (entry) =>
      new HorseCore(entry.playerId, entry.stats, entry.augments ?? [], entry.conditionRoll, trackLengthM),
  )
  const horseByPlayerId = new Map(horses.map((horse) => [horse.playerId, horse]))

  const keyframes: RaceScriptKeyframe[] = []
  const events: RaceScriptEvent[] = []

  const previousRankByPlayer: Record<string, number> = {}
  const previousLastSpurtByPlayer: Record<string, boolean> = {}
  const finishEventFired = new Set<string>()

  let timeSec = 0
  let nextFrameMs = 0
  const dtSec = simStepMs / 1000

  while (timeSec <= maxSimTimeSec) {
    const ranking = horses
      .map((h) => ({ playerId: h.playerId, position: h.position }))
      .sort((a, b) =>
        a.position === b.position ? a.playerId.localeCompare(b.playerId) : b.position - a.position,
      )

    ranking.forEach((entry, index) => {
      const rank = index + 1
      const horse = horseByPlayerId.get(entry.playerId)
      if (!horse) return
      horse.updateRank(rank)

      const prev = previousRankByPlayer[entry.playerId]
      if (typeof prev === 'number' && rank < prev) {
        events.push({
          id: `overtake-${entry.playerId}-${Math.round(timeSec * 1000)}-${prev}-${rank}`,
          type: 'overtake',
          elapsedMs: Math.round(timeSec * 1000),
          playerId: entry.playerId,
          fromRank: prev,
          toRank: rank,
        })
      }
      previousRankByPlayer[entry.playerId] = rank
    })

    horses.forEach((horse) => {
      horse.step(dtSec, timeSec)

      const prevLastSpurt = previousLastSpurtByPlayer[horse.playerId] ?? false
      if (!prevLastSpurt && horse.lastSpurtActive) {
        events.push({
          id: `last-spurt-${horse.playerId}-${Math.round(timeSec * 1000)}`,
          type: 'lastSpurt',
          elapsedMs: Math.round(timeSec * 1000),
          playerId: horse.playerId,
        })
      }
      previousLastSpurtByPlayer[horse.playerId] = horse.lastSpurtActive

      if (horse.finished && !finishEventFired.has(horse.playerId)) {
        finishEventFired.add(horse.playerId)
      }
    })

    const elapsedMs = Math.round(timeSec * 1000)
    if (elapsedMs >= nextFrameMs) {
      const positions: Record<string, number> = {}
      const stamina: Record<string, number> = {}
      const finished: Record<string, boolean> = {}
      const speeds: Record<string, number> = {}

      horses.forEach((horse) => {
        positions[horse.playerId] = Number(horse.position.toFixed(4))
        stamina[horse.playerId] = Number(horse.stamina.toFixed(2))
        finished[horse.playerId] = horse.finished
      })

      if (keyframes.length === 0) {
        horses.forEach((horse) => {
          speeds[horse.playerId] = 0
        })
      } else {
        const prev = keyframes[keyframes.length - 1]
        const actualDtMs = Math.max(1, elapsedMs - prev.elapsedMs)
        horses.forEach((horse) => {
          const delta = Math.max(0, positions[horse.playerId] - (prev.positions[horse.playerId] ?? 0))
          speeds[horse.playerId] = Number((delta / (actualDtMs / 1000)).toFixed(4))
        })
      }

      keyframes.push({ elapsedMs, positions, speeds, stamina, finished })
      nextFrameMs += outputFrameMs
    }

    if (horses.every((horse) => horse.finished)) {
      break
    }

    timeSec += dtSec
  }

  const rankings = horses
    .map((horse) => ({
      playerId: horse.playerId,
      time: Number((horse.finishTime ?? maxSimTimeSec).toFixed(3)),
      position: horse.position,
    }))
    .sort((a, b) => (a.time !== b.time ? a.time - b.time : b.position - a.position))
    .map((entry, index) => ({
      playerId: entry.playerId,
      time: entry.time,
      position: index + 1,
    }))

  rankings.forEach((entry) => {
    const finishMs = Math.round(entry.time * 1000)
    events.push({
      id: `finish-${entry.playerId}-${finishMs}`,
      type: 'finish',
      elapsedMs: finishMs,
      playerId: entry.playerId,
      rank: entry.position,
    })
  })

  const winner = rankings.find((entry) => entry.position === 1)
  // 우승 말 기록 시간 기준으로 95% 지점에 slowmoTrigger 이벤트를 만든다.
  const slowmoTriggerMs = Math.max(0, Math.round((winner?.time ?? 0) * 1000 * 0.95))
  events.push({
    id: `slowmo-${slowmoTriggerMs}`,
    type: 'slowmoTrigger',
    elapsedMs: slowmoTriggerMs,
  })

  events.sort((a, b) => (a.elapsedMs !== b.elapsedMs ? a.elapsedMs - b.elapsedMs : a.id.localeCompare(b.id)))

  const snapshotHash = createHash('sha256')
    .update(
      JSON.stringify({
        inputs: normalizedInputs,
        trackLengthM,
        simStepMs,
        outputFrameMs,
      }),
    )
    .digest('hex')

  return {
    keyframes,
    events,
    rankings,
    slowmoTriggerMs,
    simStepMs,
    outputFrameMs,
    trackLengthM,
    conditionRollByPlayer,
    snapshotHash,
  }
}
