import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { RoomStatus } from '../types'

type LoggerLike = {
  info: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, error: unknown) => void
}

type FinalResultDeps = {
  db: FirebaseFirestore.Firestore
  logger: LoggerLike
  getRoom: (roomId: string) => Promise<unknown>
  updateRoomStatus: (roomId: string, status: RoomStatus) => Promise<void>
  assertJoinedRoomHostRequest: (params: {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
    hostErrorMessage?: string
  }) => Promise<void>
}

const submitFinalRaceResultSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  finalRankings: z.array(
    z.object({
      rank: z.number().int().min(1),
      name: z.string().min(1),
      totalScore: z.number().min(0),
      roundResults: z.array(
        z
          .object({
            rank: z.number().int().min(1),
            name: z.string().min(1),
            time: z.number().min(0),
            finished: z.boolean(),
          })
          .nullable(),
      ),
    }),
  ),
})
const CALLABLE_OPTIONS = { region: 'asia-northeast3', cors: true } as const
const STATUS_FINISHED: RoomStatus = 'finished'

export function createFinalResultCallables(deps: FinalResultDeps) {
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

  const submitFinalRaceResult = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const { roomId, playerId, sessionToken, joinToken, finalRankings } = parseOrThrow(
          submitFinalRaceResultSchema,
          request.data,
        )
        await deps.getRoom(roomId)
        await deps.assertJoinedRoomHostRequest({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          hostErrorMessage: 'Only host can submit final result',
        })

        await deps.updateRoomStatus(roomId, STATUS_FINISHED)
        const now = Timestamp.now()

        await deps.db.collection('rooms').doc(roomId).update({
          finalResult: {
            finalRankings,
            submittedAt: now,
          },
          updatedAt: now,
        })

        deps.logger.info('Final race result submitted', { roomId, playerCount: finalRankings.length })
        return { success: true }
      } catch (error) {
        deps.logger.error('submitFinalRaceResult error', error)
        rethrowUnexpected(error, 'Failed to submit final race result')
      }
    },
  )

  return { submitFinalRaceResult }
}
