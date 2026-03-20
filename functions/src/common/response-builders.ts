import type { Augment, Player } from '../types'

export type ServerRaceKeyframe = {
  elapsedMs: number
  positions: Record<string, number>
  speeds: Record<string, number>
  stamina: Record<string, number>
  finished: Record<string, boolean>
}

export type ServerRaceEvent =
  | {
      id: string
      type: 'overtake'
      elapsedMs: number
      playerId: string
      fromRank: number
      toRank: number
    }
  | {
      id: string
      type: 'lastSpurt'
      elapsedMs: number
      playerId: string
    }
  | {
      id: string
      type: 'finish'
      elapsedMs: number
      playerId: string
      rank: number
    }
  | {
      id: string
      type: 'slowmoTrigger'
      elapsedMs: number
    }

export type GetRaceStateSetDocData = {
  raceResult?: {
    rankings?: Array<{ playerId: string; time: number; position: number }>
    startedAt?: FirebaseFirestore.Timestamp
  }
  raceState?: {
    status?: 'prepared' | 'running' | 'completed'
    scriptVersion?: string
    raceStateDocVersion?: string
    startedAt?: FirebaseFirestore.Timestamp
    simStepMs?: number
    outputFrameMs?: number
    tickIntervalMs?: number
    trackLengthM?: number
    keyframes?: ServerRaceKeyframe[]
    events?: ServerRaceEvent[]
    slowmoTriggerMs?: number
    inputsSnapshotHash?: string
  }
}

export type GetSetResultSetSummary = {
  setIndex: number
  selections?: Record<string, string>
  availableAugmentsByPlayer?: Record<string, Augment[]>
}

export type GetSetResultRaceRanking = {
  playerId: string
  time: number
  position: number
  name?: string
}

type ResponseBuilderDefaults = {
  serverRaceOutputFrameMs: number
  serverRaceSimStepMs: number
  serverRaceTrackLengthM: number
  serverRaceScriptVersion: string
  serverRaceStateDocVersion: string
}
const MIN_OUTPUT_FRAME_MS = 1

function resolveRaceStateStatus(params: {
  isPrepared: boolean
  keyframeIndex: number
  keyframeCount: number
}): 'prepared' | 'running' | 'completed' {
  if (params.isPrepared) {
    return 'prepared'
  }
  if (params.keyframeIndex >= params.keyframeCount - 1) {
    return 'completed'
  }
  return 'running'
}

function getCumulativeAugmentsForPlayer(params: {
  playerId: string
  allSets: GetSetResultSetSummary[]
}): Augment[] {
  return params.allSets.reduce<Augment[]>((selected, setEntry) => {
    const augmentId = setEntry.selections?.[params.playerId]
    if (!augmentId) {
      return selected
    }

    const augment = setEntry.availableAugmentsByPlayer?.[params.playerId]?.find(
      (candidate) => candidate.id === augmentId,
    )
    if (augment) {
      selected.push(augment)
    }
    return selected
  }, [])
}

export function createResponseBuilders(defaults: ResponseBuilderDefaults) {
  function getSortedSetSummaries(
    snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>,
  ): GetSetResultSetSummary[] {
    return snapshot.docs
      .map((doc) => doc.data() as GetSetResultSetSummary)
      .sort((a, b) => a.setIndex - b.setIndex)
  }

  function buildGetRaceStateResponse(params: {
    setIndex: number
    setData: GetRaceStateSetDocData | undefined
    nowMillis?: number
  }) {
    const raceState = params.setData?.raceState
    const startedAtMillis = raceState?.startedAt?.toMillis?.()
    const keyframes = raceState?.keyframes ?? []

    if (keyframes.length === 0) {
      return { success: true as const, hasRaceState: false as const }
    }

    const nowMillis = params.nowMillis ?? Date.now()
    const isPrepared = !startedAtMillis || raceState?.status === 'prepared'
    const elapsedMs = isPrepared ? 0 : Math.max(0, nowMillis - startedAtMillis)
    const outputFrameMs =
      raceState?.outputFrameMs ?? raceState?.tickIntervalMs ?? defaults.serverRaceOutputFrameMs
    const simStepMs = raceState?.simStepMs ?? defaults.serverRaceSimStepMs
    const safeOutputFrameMs = Math.max(MIN_OUTPUT_FRAME_MS, outputFrameMs)
    const keyframeIndex = Math.min(
      keyframes.length - 1,
      Math.max(0, Math.floor(elapsedMs / safeOutputFrameMs)),
    )
    const keyframe = keyframes[keyframeIndex]
    const nextKeyframe = keyframes[Math.min(keyframes.length - 1, keyframeIndex + 1)]
    const events = raceState?.events ?? []
    const nextElapsed = nextKeyframe?.elapsedMs ?? keyframe.elapsedMs
    const eventsWindow = events.filter((event) => event.elapsedMs <= nextElapsed)
    const status = resolveRaceStateStatus({
      isPrepared,
      keyframeIndex,
      keyframeCount: keyframes.length,
    })

    return {
      success: true as const,
      hasRaceState: true as const,
      status,
      setIndex: params.setIndex,
      scriptVersion: raceState?.scriptVersion ?? defaults.serverRaceScriptVersion,
      raceStateDocVersion: raceState?.raceStateDocVersion ?? defaults.serverRaceStateDocVersion,
      startedAtMillis: startedAtMillis ?? null,
      elapsedMs: isPrepared ? 0 : keyframe.elapsedMs,
      simStepMs,
      outputFrameMs,
      tickIntervalMs: outputFrameMs,
      authoritativeNowMs: nowMillis,
      trackLengthM: raceState?.trackLengthM ?? defaults.serverRaceTrackLengthM,
      keyframeIndex,
      keyframe,
      nextKeyframe,
      eventsWindow,
      slowmoTriggerMs: raceState?.slowmoTriggerMs ?? null,
      snapshotHash: raceState?.inputsSnapshotHash ?? '',
      rankings: params.setData?.raceResult?.rankings ?? [],
    }
  }

  function buildSetResultRankings(params: {
    raceRankings: GetSetResultRaceRanking[]
    playersById: Record<string, Player>
    allSets: GetSetResultSetSummary[]
  }) {
    return params.raceRankings.map((entry) => ({
      playerId: entry.playerId,
      name: params.playersById[entry.playerId]?.name ?? entry.playerId,
      position: entry.position,
      time: entry.time,
      selectedAugments: getCumulativeAugmentsForPlayer({
        playerId: entry.playerId,
        allSets: params.allSets,
      }),
    }))
  }

  return {
    getSortedSetSummaries,
    buildGetRaceStateResponse,
    buildSetResultRankings,
  }
}
