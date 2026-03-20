import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { buildRaceScript, rollConditionFromSeed } from '../../../shared/race-core'
import type { Augment, Player, Room, RoomStatus } from '../types'
import type { GetSetResultSetSummary } from '../common/response-builders'

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

const authenticatedSetRequestSchema = {
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
}

const startRaceSchema = z.object(authenticatedSetRequestSchema)
const prepareRaceSchema = startRaceSchema

const skipSetSchema = z.object(authenticatedSetRequestSchema)
const readyNextSetSchema = z.object(authenticatedSetRequestSchema)
const CALLABLE_OPTIONS = { region: 'asia-northeast3', cors: true } as const
const STATUS_RACING: RoomStatus = 'racing'
const STATUS_SET_RESULT: RoomStatus = 'setResult'
const STATUS_AUGMENT_SELECTION: RoomStatus = 'augmentSelection'
const STATUS_FINISHED: RoomStatus = 'finished'

export function createRaceWriteCallables(deps: RaceWriteDeps) {
  function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
    const parsed = schema.safeParse(data)
    if (parsed.success) {
      return parsed.data
    }
    throw new HttpsError('invalid-argument', 'Invalid arguments', {
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  function rethrowUnexpected(error: unknown, message: string): never {
    if (error instanceof HttpsError) {
      throw error
    }
    throw new HttpsError('internal', message)
  }

  function buildPreparedRaceAck(alreadyPrepared: boolean, keyframeCount?: number) {
    return {
      success: true,
      prepared: true,
      alreadyPrepared,
      scriptVersion: deps.serverRaceScriptVersion,
      simStepMs: deps.serverRaceSimStepMs,
      outputFrameMs: deps.serverRaceOutputFrameMs,
      tickIntervalMs: deps.serverRaceOutputFrameMs,
      raceStateDocVersion: deps.serverRaceStateDocVersion,
      ...(typeof keyframeCount === 'number' ? { keyframeCount } : {}),
    }
  }

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
      startedAt: now,
      finishedAt: now,
      deterministicMeta: {
        source: 'seeded-rng-v1',
        seedKey: raceSeedKey,
      },
    }
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
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseOrThrow(
          prepareRaceSchema,
          request.data,
        )
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
          expectedStatus: STATUS_RACING,
          statusMessage: 'Race can only be prepared during racing phase',
          requestedSetIndex: setIndex,
          currentSetIndex: room.currentSet,
        })

        const setDocRef = deps.db.collection('rooms').doc(roomId).collection('sets').doc(`set-${setIndex}`)
        const existingSetDoc = await setDocRef.get()
        const existingRaceState = (existingSetDoc.data() as { raceState?: { status?: string } } | undefined)
          ?.raceState
        if (existingRaceState?.status === 'prepared') {
          deps.logger.info('prepareRace already prepared', { roomId, setIndex, playerId })
          return buildPreparedRaceAck(true)
        }
        if (existingRaceState?.status === 'running' || existingRaceState?.status === 'completed') {
          deps.logger.info('prepareRace reused existing running/completed state', {
            roomId,
            setIndex,
            playerId,
            status: existingRaceState.status,
          })
          return buildPreparedRaceAck(true)
        }

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

        return buildPreparedRaceAck(false, prepared.replayScript.keyframes.length)
      } catch (error) {
        deps.logger.error('prepareRace error', error)
        rethrowUnexpected(error, 'Failed to prepare race')
      }
    },
  )

  const startRace = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseOrThrow(
          startRaceSchema,
          request.data,
        )
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
          expectedStatus: STATUS_RACING,
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
            status: 'completed',
            updatedAt: now,
          },
          { merge: true },
        )
        await deps.updateRoomStatus(roomId, STATUS_SET_RESULT)

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
        rethrowUnexpected(error, 'Failed to start race')
      }
    },
  )

  const readyNextSet = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseOrThrow(
          readyNextSetSchema,
          request.data,
        )
        const room = await deps.getRoom(roomId)
        deps.logger.info('readyNextSet request received', {
          roomId,
          playerId,
          setIndex,
          roomCurrentSet: room.currentSet,
          roomStatus: room.status,
        })
        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })

        deps.assertExactRoomPhaseAndSetIndex({
          roomId,
          playerId,
          action: 'readyNextSet',
          roomStatus: room.status,
          expectedStatus: STATUS_SET_RESULT,
          statusMessage: 'Next set can only be prepared during setResult',
          requestedSetIndex: setIndex,
          currentSetIndex: room.currentSet,
        })

        const roomRef = deps.db.collection('rooms').doc(roomId)
        const setDocRef = roomRef.collection('sets').doc(`set-${setIndex}`)
        const playersSnapshot = await roomRef.collection('players').get()
        const playerIds = playersSnapshot.docs.map((doc) => doc.id)
        const now = Timestamp.now()

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
            nextStatus: STATUS_SET_RESULT,
            currentSet: setIndex,
            allReady: false,
          })
          return {
            success: true,
            allReady: false,
            nextStatus: STATUS_SET_RESULT,
            currentSet: setIndex,
          }
        }

        const isLastSet = setIndex >= room.roundCount
        const nextStatus: RoomStatus = isLastSet ? STATUS_FINISHED : STATUS_AUGMENT_SELECTION
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

        return {
          success: true,
          allReady: true,
          nextStatus,
          currentSet: nextSet,
        }
      } catch (error) {
        deps.logger.error('readyNextSet error', error)
        rethrowUnexpected(error, 'Failed to process next set readiness')
      }
    },
  )

  const skipSet = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseOrThrow(
          skipSetSchema,
          request.data,
        )
        const room = await deps.getRoom(roomId)
        await deps.assertJoinedRoomHostRequest({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          hostErrorMessage: 'Only host can skip set',
        })

        if (room.status !== STATUS_RACING && room.status !== STATUS_SET_RESULT) {
          throw new HttpsError('failed-precondition', 'Set can only be skipped during race/result phase')
        }
        if (setIndex !== room.currentSet) {
          throw new HttpsError('failed-precondition', 'Invalid set index for current room state')
        }

        const isLastSet = room.currentSet >= room.roundCount
        const nextStatus: RoomStatus = isLastSet ? STATUS_FINISHED : STATUS_AUGMENT_SELECTION
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
        rethrowUnexpected(error, 'Failed to skip set')
      }
    },
  )

  return { prepareRace, startRace, readyNextSet, skipSet }
}
