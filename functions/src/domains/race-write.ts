import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { buildRaceScript, rollConditionFromSeed } from '../../../shared/race-core'
import type { Augment, Player, Room, RoomStatus } from '../types'
import type { GetSetResultSetSummary } from '../common/response-builders'

// racing / setResult 단계에서 쓰는 서버 callable 모음
// (prepare/start/readyNextSet/skipSet)
type LoggerLike = {
  info: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, error: unknown) => void
}

type RaceWriteDeps = {
  db: FirebaseFirestore.Firestore
  logger: LoggerLike
  getRoom: (roomId: string) => Promise<Room>
  updateRoomStatus: (roomId: string, status: RoomStatus) => Promise<void>
  assertJoinedRoomHostRequest: (params: {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
    hostErrorMessage?: string
  }) => Promise<void>
  assertJoinedRoomPlayerRequest: (params: {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
  }) => Promise<void>
  assertExactRoomPhaseAndSetIndex: (params: {
    roomId: string
    playerId: string
    action: string
    roomStatus: string
    expectedStatus: string
    statusMessage: string
    requestedSetIndex: number
    currentSetIndex: number
  }) => void
  getSortedSetSummaries: (
    snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>,
  ) => GetSetResultSetSummary[]
  removeLuckBonusFromHorseStats: (
    horseStats: Player['horseStats'],
    luckBonus: number,
  ) => Player['horseStats']
  createSeededRandom: (seed: string) => () => number
  serverRaceTrackLengthM: number
  serverRaceSimStepMs: number
  serverRaceOutputFrameMs: number
  serverRaceScriptVersion: string
  serverRaceStateDocVersion: string
}

const startRaceSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
})
const prepareRaceSchema = startRaceSchema

const skipSetSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
})

const readyNextSetSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
})

export function createRaceWriteCallables(deps: RaceWriteDeps) {
  // 현재 세트 레이스를 서버에서 "준비"만 해두는 함수
  // 실제 시작 시간(startedAt)은 여기서 정하지 않고 startRace에서 확정한다.
  async function buildPreparedRaceForSet(params: {
    roomId: string
    setIndex: number
  }) {
    const { roomId, setIndex } = params
    const roomRef = deps.db.collection('rooms').doc(roomId)
    const playersSnapshot = await roomRef.collection('players').get()
    if (playersSnapshot.size < 2) {
      throw new HttpsError('failed-precondition', 'At least 2 players are required for race')
    }

    const raceSeedKey = `race|room:${roomId}|set:${setIndex}`
    const allSetSnapshot = await roomRef.collection('sets').where('setIndex', '<=', setIndex).get()
    const allSets = deps.getSortedSetSummaries(allSetSnapshot)

    // 플레이어 기본 스탯 + 이전 세트에서 고른 특수 능력 증강 + 컨디션 롤을 합쳐서
    // 서버 시뮬레이션 입력 형태로 만든다.
    const raceInputs = playersSnapshot.docs.map((doc) => {
      const player = doc.data() as Player
      const playerIdForInput = doc.id
      const baseStats = player.horseStats ?? {
        Speed: 10,
        Stamina: 10,
        Power: 10,
        Guts: 10,
        Start: 10,
        Luck: 10,
      }

      const abilityAugments: Augment[] = []
      allSets.forEach((setEntry) => {
        const augmentId = setEntry.selections?.[playerIdForInput]
        if (!augmentId) return

        const augment = setEntry.availableAugmentsByPlayer?.[playerIdForInput]?.find(
          (item) => item.id === augmentId,
        )
        if (augment?.specialAbility) {
          abilityAugments.push(augment)
        }
      })

      const conditionSeed = `condition|${raceSeedKey}|player:${playerIdForInput}`
      const conditionRoll = rollConditionFromSeed(baseStats.Luck, deps.createSeededRandom(conditionSeed))

      return {
        playerId: playerIdForInput,
        stats: baseStats,
        augments: abilityAugments,
        conditionRoll,
      }
    })

    const replayScript = buildRaceScript(raceInputs, {
      trackLengthM: deps.serverRaceTrackLengthM,
      simStepMs: deps.serverRaceSimStepMs,
      outputFrameMs: deps.serverRaceOutputFrameMs,
    })

    const rankingsPayload = replayScript.rankings
    const now = Timestamp.now()
    const raceResult = {
      rankings: rankingsPayload,
      // 결과 읽는 쪽 호환성을 위해 startedAt/finishedAt 필드는 미리 넣어둔다.
      // 실제 startedAt 값은 startRace에서 최종 확정된다.
      startedAt: now,
      finishedAt: now,
      deterministicMeta: {
        source: 'seeded-rng-v1',
        seedKey: raceSeedKey,
      },
    }
    // prepared 상태에서는 startedAt을 넣지 않는다.
    // 클라이언트는 이 상태에서 keyframe을 먼저 받아두고, startRace 후에만 재생한다.
    const raceState = {
      status: 'prepared' as const,
      scriptVersion: deps.serverRaceScriptVersion,
      raceStateDocVersion: deps.serverRaceStateDocVersion,
      simStepMs: replayScript.simStepMs,
      outputFrameMs: replayScript.outputFrameMs,
      tickIntervalMs: replayScript.outputFrameMs,
      trackLengthM: deps.serverRaceTrackLengthM,
      keyframes: replayScript.keyframes,
      events: replayScript.events,
      slowmoTriggerMs: replayScript.slowmoTriggerMs,
      seedBundle: {
        raceSeedKey,
        conditionRollByPlayer: replayScript.conditionRollByPlayer,
      },
      inputsSnapshotHash: replayScript.snapshotHash,
      deterministicMeta: {
        source: 'horse-core-v1',
        seedKey: raceSeedKey,
        engineVersion: deps.serverRaceScriptVersion,
        configHash: `${deps.serverRaceTrackLengthM}-${replayScript.simStepMs}-${replayScript.outputFrameMs}`,
      },
      updatedAt: now,
    }

    return {
      roomRef,
      raceSeedKey,
      rankingsPayload,
      replayScript,
      raceResult,
      raceState,
      now,
    }
  }

  const prepareRace = onCall(
    {
      region: 'asia-northeast3',
      cors: true,
    },
    async (request) => {
      try {
        // 1) 요청 값 형태 확인
        const parseResult = prepareRaceSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        // 2) host + 현재 room phase/setIndex 확인
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseResult.data
        const room = await deps.getRoom(roomId)
        await deps.assertJoinedRoomHostRequest({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          hostErrorMessage: 'Only host can prepare race',
        })

        deps.assertExactRoomPhaseAndSetIndex({
          roomId,
          playerId,
          action: 'prepareRace',
          roomStatus: room.status,
          expectedStatus: 'racing',
          statusMessage: 'Race can only be prepared during racing phase',
          requestedSetIndex: setIndex,
          currentSetIndex: room.currentSet,
        })

        // 3) 이미 prepared/running/completed면 중복 호출로 보고 재사용 응답
        const setDocRef = deps.db.collection('rooms').doc(roomId).collection('sets').doc(`set-${setIndex}`)
        const existingSetDoc = await setDocRef.get()
        const existingRaceState = (existingSetDoc.data() as { raceState?: { status?: string } } | undefined)
          ?.raceState
        if (existingRaceState?.status === 'prepared') {
          deps.logger.info('prepareRace already prepared', { roomId, setIndex, playerId })
          return {
            success: true,
            prepared: true,
            alreadyPrepared: true,
            scriptVersion: deps.serverRaceScriptVersion,
            simStepMs: deps.serverRaceSimStepMs,
            outputFrameMs: deps.serverRaceOutputFrameMs,
            tickIntervalMs: deps.serverRaceOutputFrameMs,
            raceStateDocVersion: deps.serverRaceStateDocVersion,
          }
        }
        if (existingRaceState?.status === 'running' || existingRaceState?.status === 'completed') {
          deps.logger.info('prepareRace reused existing running/completed state', {
            roomId,
            setIndex,
            playerId,
            status: existingRaceState.status,
          })
          return {
            success: true,
            prepared: true,
            alreadyPrepared: true,
            scriptVersion: deps.serverRaceScriptVersion,
            simStepMs: deps.serverRaceSimStepMs,
            outputFrameMs: deps.serverRaceOutputFrameMs,
            tickIntervalMs: deps.serverRaceOutputFrameMs,
            raceStateDocVersion: deps.serverRaceStateDocVersion,
          }
        }

        // 4) 서버 레이스 스크립트 생성 후 set 문서에 저장
        const prepared = await buildPreparedRaceForSet({ roomId, setIndex })
        await setDocRef.set(
          {
            setIndex,
            raceResult: prepared.raceResult,
            raceState: prepared.raceState,
            status: 'prepared',
            updatedAt: prepared.now,
          },
          { merge: true },
        )

        deps.logger.info('Race prepared', {
          roomId,
          setIndex,
          playerCount: prepared.rankingsPayload.length,
          seedKey: prepared.raceSeedKey,
          scriptVersion: deps.serverRaceScriptVersion,
          raceStateDocVersion: deps.serverRaceStateDocVersion,
          keyframeCount: prepared.replayScript.keyframes.length,
        })

        return {
          success: true,
          prepared: true,
          alreadyPrepared: false,
          scriptVersion: deps.serverRaceScriptVersion,
          simStepMs: prepared.replayScript.simStepMs,
          outputFrameMs: prepared.replayScript.outputFrameMs,
          tickIntervalMs: prepared.replayScript.outputFrameMs,
          raceStateDocVersion: deps.serverRaceStateDocVersion,
          keyframeCount: prepared.replayScript.keyframes.length,
        }
      } catch (error) {
        deps.logger.error('prepareRace error', error)
        if (error instanceof HttpsError) {
          throw error
        }
        throw new HttpsError('internal', 'Failed to prepare race')
      }
    },
  )

  const startRace = onCall(
    {
      region: 'asia-northeast3',
      cors: true,
    },
    async (request) => {
      try {
        // startRace는 start-only 역할이다.
        // 레이스 계산/스크립트 저장은 prepareRace에서 끝난 상태를 전제로 한다.
        const parseResult = startRaceSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        // host + 현재 room phase/setIndex 확인
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseResult.data
        const room = await deps.getRoom(roomId)
        await deps.assertJoinedRoomHostRequest({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          hostErrorMessage: 'Only host can start race',
        })

        deps.assertExactRoomPhaseAndSetIndex({
          roomId,
          playerId,
          action: 'startRace',
          roomStatus: room.status,
          expectedStatus: 'racing',
          statusMessage: 'Race can only be started during racing phase',
          requestedSetIndex: setIndex,
          currentSetIndex: room.currentSet,
        })

        const setDocRef = deps.db.collection('rooms').doc(roomId).collection('sets').doc(`set-${setIndex}`)
        const setDoc = await setDocRef.get()
        if (!setDoc.exists) {
          throw new HttpsError('failed-precondition', 'Race must be prepared before start')
        }

        const setData = setDoc.data() as
          | {
              raceState?: {
                status?: 'prepared' | 'running' | 'completed'
                startedAt?: FirebaseFirestore.Timestamp
                scriptVersion?: string
                raceStateDocVersion?: string
                simStepMs?: number
                outputFrameMs?: number
                tickIntervalMs?: number
              }
            }
          | undefined
        const raceState = setData?.raceState
        if (!raceState) {
          throw new HttpsError('failed-precondition', 'Race state is unavailable')
        }

        // startedAt이 이미 있으면 중복 시작 요청으로 보고 기존 값을 돌려준다.
        const existingStartedAtMillis = raceState.startedAt?.toMillis?.()
        if (existingStartedAtMillis) {
          deps.logger.info('startRace already started', { roomId, setIndex, playerId })
          return {
            success: true,
            startedAtMillis: existingStartedAtMillis,
            alreadyStarted: true,
            scriptVersion: raceState.scriptVersion ?? deps.serverRaceScriptVersion,
            simStepMs: raceState.simStepMs ?? deps.serverRaceSimStepMs,
            outputFrameMs: raceState.outputFrameMs ?? deps.serverRaceOutputFrameMs,
            tickIntervalMs:
              raceState.tickIntervalMs ?? raceState.outputFrameMs ?? deps.serverRaceOutputFrameMs,
            raceStateDocVersion: raceState.raceStateDocVersion ?? deps.serverRaceStateDocVersion,
          }
        }
        if (raceState.status && raceState.status !== 'prepared') {
          throw new HttpsError(
            'failed-precondition',
            `Race cannot be started from status ${raceState.status}`,
          )
        }

        // 여기서 처음으로 startedAt을 확정한다.
        const now = Timestamp.now()
        await setDocRef.set(
          {
            setIndex,
            raceResult: {
              startedAt: now,
            },
            raceState: {
              startedAt: now,
              status: 'running',
              updatedAt: now,
            },
            // 세트 문서 status 규칙은 기존 결과 집계 흐름과 맞추기 위해 그대로 유지한다.
            status: 'completed',
            updatedAt: now,
          },
          { merge: true },
        )
        await deps.updateRoomStatus(roomId, 'setResult')

        deps.logger.info('Race started (prepared -> running)', {
          roomId,
          setIndex,
          playerId,
          scriptVersion: raceState.scriptVersion ?? deps.serverRaceScriptVersion,
          raceStateDocVersion: raceState.raceStateDocVersion ?? deps.serverRaceStateDocVersion,
        })

        return {
          success: true,
          startedAtMillis: now.toMillis(),
          alreadyStarted: false,
          scriptVersion: raceState.scriptVersion ?? deps.serverRaceScriptVersion,
          simStepMs: raceState.simStepMs ?? deps.serverRaceSimStepMs,
          outputFrameMs: raceState.outputFrameMs ?? deps.serverRaceOutputFrameMs,
          tickIntervalMs:
            raceState.tickIntervalMs ?? raceState.outputFrameMs ?? deps.serverRaceOutputFrameMs,
          raceStateDocVersion: raceState.raceStateDocVersion ?? deps.serverRaceStateDocVersion,
        }
      } catch (error) {
        deps.logger.error('startRace error', error)
        if (error instanceof HttpsError) {
          throw error
        }
        throw new HttpsError('internal', 'Failed to start race')
      }
    },
  )

  const readyNextSet = onCall(
    {
      region: 'asia-northeast3',
      cors: true,
    },
    async (request) => {
      try {
        // 결과 화면에서 플레이어가 "다음 라운드 준비"를 누를 때 호출된다.
        // 전원이 준비되면 다음 상태로 넘기고, 아니면 setResult 상태를 유지한다.
        const parseResult = readyNextSetSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseResult.data
        const room = await deps.getRoom(roomId)
        deps.logger.info('readyNextSet request received', {
          roomId,
          playerId,
          setIndex,
          roomCurrentSet: room.currentSet,
          roomStatus: room.status,
        })
        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })
        deps.logger.info('readyNextSet join token validated', {
          roomId,
          playerId,
          setIndex,
          joinTokenValidated: true,
        })

        deps.assertExactRoomPhaseAndSetIndex({
          roomId,
          playerId,
          action: 'readyNextSet',
          roomStatus: room.status,
          expectedStatus: 'setResult',
          statusMessage: 'Next set can only be prepared during setResult',
          requestedSetIndex: setIndex,
          currentSetIndex: room.currentSet,
        })

        const roomRef = deps.db.collection('rooms').doc(roomId)
        const setDocRef = roomRef.collection('sets').doc(`set-${setIndex}`)
        const playersSnapshot = await roomRef.collection('players').get()
        const playerIds = playersSnapshot.docs.map((doc) => doc.id)
        const now = Timestamp.now()

        // readyForNext를 트랜잭션으로 업데이트해서 동시 클릭 경합을 줄인다.
        const allReady = await deps.db.runTransaction(async (tx) => {
          const setDoc = await tx.get(setDocRef)
          const setData = setDoc.data() as { readyForNext?: Record<string, boolean> } | undefined
          const readyForNext = { ...(setData?.readyForNext ?? {}), [playerId]: true }
          tx.set(
            setDocRef,
            {
              setIndex,
              readyForNext,
              updatedAt: now,
            },
            { merge: true },
          )
          return playerIds.every((id) => readyForNext[id] === true)
        })

        const updatedSetSnapshot = await setDocRef.get()
        const updatedSetData = updatedSetSnapshot.data() as { readyForNext?: Record<string, boolean> } | undefined
        deps.logger.info('readyNextSet readiness transaction committed', {
          roomId,
          playerId,
          setIndex,
          roomCurrentSet: room.currentSet,
          roomStatus: room.status,
          playerIds,
          readyForNext: updatedSetData?.readyForNext ?? null,
          allReady,
        })

        if (!allReady) {
          deps.logger.info('readyNextSet waiting for other players', {
            roomId,
            playerId,
            setIndex,
            nextStatus: 'setResult',
            currentSet: setIndex,
            allReady: false,
          })
          return {
            success: true,
            allReady: false,
            nextStatus: 'setResult' as RoomStatus,
            currentSet: setIndex,
          }
        }

        const isLastSet = setIndex >= room.roundCount
        const nextStatus: RoomStatus = isLastSet ? 'finished' : 'augmentSelection'
        const nextSet = isLastSet ? setIndex : setIndex + 1

        // 모든 플레이어가 준비되면 다음 세트 진입 전에 라운드 임시 효과(행운 보너스)를 정리한다.
        const batch = deps.db.batch()
        playersSnapshot.docs.forEach((doc) => {
          const player = doc.data() as Player & { currentSetLuckBonus?: number }
          const luckBonus = player.currentSetLuckBonus ?? 0
          const nextStats = deps.removeLuckBonusFromHorseStats(player.horseStats, luckBonus)
          batch.update(doc.ref, {
            horseStats: nextStats,
            currentSetLuckBonus: 0,
            updatedAt: now,
          })
        })
        batch.update(roomRef, {
          status: nextStatus,
          currentSet: nextSet,
          updatedAt: now,
        })
        batch.set(
          setDocRef,
          {
            setIndex,
            status: 'completed',
            updatedAt: now,
          },
          { merge: true },
        )
        await batch.commit()

        deps.logger.info('Set advanced by readiness sync', { roomId, setIndex, nextStatus, nextSet })
        deps.logger.info('readyNextSet response prepared', {
          roomId,
          playerId,
          setIndex,
          roomCurrentSet: room.currentSet,
          roomStatus: room.status,
          allReady: true,
          nextStatus,
          nextSet,
          currentSet: nextSet,
        })

        return {
          success: true,
          allReady: true,
          nextStatus,
          currentSet: nextSet,
        }
      } catch (error) {
        deps.logger.error('readyNextSet error', error)
        if (error instanceof HttpsError) {
          throw error
        }
        throw new HttpsError('internal', 'Failed to process next set readiness')
      }
    },
  )

  const skipSet = onCall(
    {
      region: 'asia-northeast3',
      cors: true,
    },
    async (request) => {
      try {
        // host가 세트를 강제로 넘기는 운영/디버그 성격 경로
        const parseResult = skipSetSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseResult.data
        const room = await deps.getRoom(roomId)
        await deps.assertJoinedRoomHostRequest({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          hostErrorMessage: 'Only host can skip set',
        })

        if (room.status !== 'racing' && room.status !== 'setResult') {
          throw new HttpsError('failed-precondition', 'Set can only be skipped during race/result phase')
        }
        if (setIndex !== room.currentSet) {
          throw new HttpsError('failed-precondition', 'Invalid set index for current room state')
        }

        const isLastSet = room.currentSet >= room.roundCount
        const nextStatus: RoomStatus = isLastSet ? 'finished' : 'augmentSelection'
        const nextSet = isLastSet ? room.currentSet : room.currentSet + 1

        await deps.db.collection('rooms').doc(roomId).update({
          status: nextStatus,
          currentSet: nextSet,
          updatedAt: Timestamp.now(),
        })

        deps.logger.info('Set skipped', { roomId, setIndex, nextStatus, nextSet })
        return { success: true, nextStatus, currentSet: nextSet }
      } catch (error) {
        deps.logger.error('skipSet error', error)
        if (error instanceof HttpsError) {
          throw error
        }
        throw new HttpsError('internal', 'Failed to skip set')
      }
    },
  )

  return { prepareRace, startRace, readyNextSet, skipSet }
}
