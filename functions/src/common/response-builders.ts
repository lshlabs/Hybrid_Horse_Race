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

function getCumulativeAugmentsForPlayer(params: {
  playerId: string
  allSets: GetSetResultSetSummary[]
}): Augment[] {
  // 세트별 선택 기록을 처음부터 훑어서 누적 증강 목록을 만든다.
  // 최종 결과 화면에서 "지금까지 고른 증강" 표시할 때 사용한다.
  const cumulativeAugments: Augment[] = []

  params.allSets.forEach((setEntry) => {
    const augmentId = setEntry.selections?.[params.playerId]
    if (!augmentId) return

    const selectedAugment = setEntry.availableAugmentsByPlayer?.[params.playerId]?.find(
      (augment) => augment.id === augmentId,
    )
    if (!selectedAugment) return

    cumulativeAugments.push(selectedAugment)
  })

  return cumulativeAugments
}

export function createResponseBuilders(defaults: ResponseBuilderDefaults) {
  function getSortedSetSummaries(
    snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>,
  ): GetSetResultSetSummary[] {
    // Firestore 응답 순서에 기대지 않고 setIndex로 다시 정렬해서 사용한다.
    return snapshot.docs
      .map((doc) => doc.data() as GetSetResultSetSummary)
      .sort((a, b) => a.setIndex - b.setIndex)
  }

  function buildGetRaceStateResponse(params: {
    setIndex: number
    setData: GetRaceStateSetDocData | undefined
    nowMillis?: number
  }) {
    // getRaceState는 prepared 상태도 내려준다.
    // 클라이언트가 "게임을 시작하는 중..." 단계에서 키프레임을 먼저 받아둘 수 있게 하기 위해서다.
    const raceState = params.setData?.raceState
    const startedAtMillis = raceState?.startedAt?.toMillis?.()
    const keyframes = raceState?.keyframes ?? []

    if (keyframes.length === 0) {
      // 아직 prepareRace가 안 끝났거나 raceState가 없는 상태
      return { success: true as const, hasRaceState: false as const }
    }

    const nowMillis = params.nowMillis ?? Date.now()
    // startedAt이 없으면 레이스 데이터는 준비됐지만 아직 시작 시간은 확정되지 않은 상태로 본다.
    const isPrepared = !startedAtMillis || raceState?.status === 'prepared'
    const elapsedMs = isPrepared ? 0 : Math.max(0, nowMillis - startedAtMillis)
    const outputFrameMs =
      raceState?.outputFrameMs ?? raceState?.tickIntervalMs ?? defaults.serverRaceOutputFrameMs
    const simStepMs = raceState?.simStepMs ?? defaults.serverRaceSimStepMs
    const keyframeIndex = Math.min(
      keyframes.length - 1,
      Math.max(0, Math.floor(elapsedMs / Math.max(1, outputFrameMs))),
    )
    const keyframe = keyframes[keyframeIndex]
    const nextKeyframe = keyframes[Math.min(keyframes.length - 1, keyframeIndex + 1)]
    const events = raceState?.events ?? []
    const nextElapsed = nextKeyframe?.elapsedMs ?? keyframe.elapsedMs
    // 현재~다음 프레임 사이에서 쓸 수 있는 이벤트 후보를 같이 내려준다.
    // 실제 소비 타이밍은 클라이언트가 renderElapsed 기준으로 한 번 더 맞춘다.
    const eventsWindow = events.filter((event) => event.elapsedMs <= nextElapsed)

    return {
      success: true as const,
      hasRaceState: true as const,
      status: isPrepared
        ? ('prepared' as const)
        : keyframeIndex >= keyframes.length - 1
          ? ('completed' as const)
          : ('running' as const),
      setIndex: params.setIndex,
      scriptVersion: raceState?.scriptVersion ?? defaults.serverRaceScriptVersion,
      raceStateDocVersion: raceState?.raceStateDocVersion ?? defaults.serverRaceStateDocVersion,
      startedAtMillis: startedAtMillis ?? null,
      // prepared 상태에서는 아직 실제 레이스가 시작 안 됐으므로 시간은 0으로 내려준다.
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
    // 결과 페이지에서 바로 쓰기 좋게 이름/누적 증강까지 같이 붙여서 만든다.
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
