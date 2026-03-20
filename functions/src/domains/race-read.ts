import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import type { Augment, Player, Room } from '../types'
import type {
  GetRaceStateSetDocData,
  GetSetResultRaceRanking,
  GetSetResultSetSummary,
} from '../common/response-builders'

type AssertJoinedRoomPlayerRequest = (params: {
  roomId: string
  playerId: string
  sessionToken: string
  joinToken: string
}) => Promise<void>

type LoggerLike = {
  error: (message: string, error: unknown) => void
}

type RaceReadDeps = {
  db: FirebaseFirestore.Firestore
  logger: LoggerLike
  getRoom: (roomId: string) => Promise<Room>
  assertJoinedRoomPlayerRequest: AssertJoinedRoomPlayerRequest
  throwInvalidSetIndex: (params: {
    roomId: string
    playerId: string
    action: string
    requestedSetIndex: number
    currentSetIndex: number
  }) => never
  buildGetRaceStateResponse: (params: {
    setIndex: number
    setData: GetRaceStateSetDocData | undefined
    nowMillis?: number
  }) => unknown
  getSortedSetSummaries: (
    snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>,
  ) => GetSetResultSetSummary[]
  buildSetResultRankings: (params: {
    raceRankings: GetSetResultRaceRanking[]
    playersById: Record<string, Player>
    allSets: GetSetResultSetSummary[]
  }) => Array<{
    playerId: string
    name: string
    position: number
    time: number
    selectedAugments: Augment[]
  }>
}

const authenticatedSetRequestSchema = {
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
}

const getSetResultSchema = z.object(authenticatedSetRequestSchema)
const getRaceStateSchema = z.object(authenticatedSetRequestSchema)
const CALLABLE_OPTIONS = { region: 'asia-northeast3', cors: true } as const

function countReadyForNextPlayers(readyForNext?: Record<string, boolean>): number {
  return Object.keys(readyForNext ?? {}).filter((id) => readyForNext?.[id] === true).length
}

export function createRaceReadCallables(deps: RaceReadDeps) {
  function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
    const parsed = schema.safeParse(data)
    if (parsed.success) {
      return parsed.data
    }
    throw new HttpsError('invalid-argument', 'Invalid arguments', {
      errors: parsed.error.flatten().fieldErrors,
    })
  }

  function rethrowUnexpected(error: unknown, publicMessage: string): never {
    if (error instanceof HttpsError) {
      throw error
    }
    throw new HttpsError('internal', publicMessage)
  }

  const getRaceState = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseOrThrow(
          getRaceStateSchema,
          request.data,
        )
        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })

        const room = await deps.getRoom(roomId)
        if (room.currentSet !== setIndex) {
          deps.throwInvalidSetIndex({
            roomId,
            playerId,
            action: 'getRaceState',
            requestedSetIndex: setIndex,
            currentSetIndex: room.currentSet,
          })
        }

        const setDocRef = deps.db.collection('rooms').doc(roomId).collection('sets').doc(`set-${setIndex}`)
        const setDoc = await setDocRef.get()
        if (!setDoc.exists) {
          return { success: true, hasRaceState: false }
        }

        const setData = setDoc.data() as GetRaceStateSetDocData | undefined
        return deps.buildGetRaceStateResponse({ setIndex, setData })
      } catch (error) {
        deps.logger.error('getRaceState error', error)
        rethrowUnexpected(error, 'Failed to get race state')
      }
    },
  )

  const getSetResult = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseOrThrow(
          getSetResultSchema,
          request.data,
        )
        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })

        const roomRef = deps.db.collection('rooms').doc(roomId)
        const setDocRef = roomRef.collection('sets').doc(`set-${setIndex}`)
        const [setDoc, playersSnapshot, allSetSnapshot] = await Promise.all([
          setDocRef.get(),
          roomRef.collection('players').get(),
          roomRef.collection('sets').where('setIndex', '<=', setIndex).get(),
        ])

        if (!setDoc.exists) {
          throw new HttpsError('not-found', 'Set result not found')
        }

        const setData = setDoc.data() as
          | {
              raceResult?: {
                rankings?: GetSetResultRaceRanking[]
                startedAt?: FirebaseFirestore.Timestamp
              }
              readyForNext?: Record<string, boolean>
              selections?: Record<string, string>
              availableAugmentsByPlayer?: Record<string, Augment[]>
            }
          | undefined
        const raceResult = setData?.raceResult
        if (!raceResult?.rankings || raceResult.rankings.length === 0) {
          return {
            success: true,
            hasResult: false,
            rankings: [],
            readyCount: countReadyForNextPlayers(setData?.readyForNext),
          }
        }

        const playersById = playersSnapshot.docs.reduce<Record<string, Player>>((acc, doc) => {
          acc[doc.id] = doc.data() as Player
          return acc
        }, {})

        const allSets = deps.getSortedSetSummaries(allSetSnapshot)
        const rankings = deps.buildSetResultRankings({
          raceRankings: raceResult.rankings,
          playersById,
          allSets,
        })

        return {
          success: true,
          hasResult: true,
          rankings,
          startedAtMillis: setData?.raceResult?.startedAt?.toMillis?.() ?? null,
          readyCount: countReadyForNextPlayers(setData?.readyForNext),
        }
      } catch (error) {
        deps.logger.error('getSetResult error', error)
        rethrowUnexpected(error, 'Failed to get set result')
      }
    },
  )

  return { getRaceState, getSetResult }
}
