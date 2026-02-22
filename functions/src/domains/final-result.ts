import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { RoomStatus } from '../types'

// 최종 결과(전체 라운드 합산)를 host가 한 번 저장하는 callable
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

export function createFinalResultCallables(deps: FinalResultDeps) {
  const submitFinalRaceResult = onCall(
    {
      region: 'asia-northeast3',
      cors: true,
    },
    async (request) => {
      try {
        // 1) 입력 검증
        const parseResult = submitFinalRaceResultSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, finalRankings } = parseResult.data
        // 2) 룸 존재 확인 + host 권한 확인
        await deps.getRoom(roomId)
        await deps.assertJoinedRoomHostRequest({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          hostErrorMessage: 'Only host can submit final result',
        })

        // 3) 룸 상태를 finished로 바꾸고 최종 결과를 저장한다.
        // 결과 저장은 host 한 번만 수행하는 전제라서 여기서 최종 snapshot처럼 남긴다.
        await deps.updateRoomStatus(roomId, 'finished')

        await deps.db.collection('rooms').doc(roomId).update({
          finalResult: {
            finalRankings,
            // 저장 시각을 남겨두면 재접속/디버깅 때 어떤 결과가 최신인지 보기 쉽다.
            submittedAt: Timestamp.now(),
          },
          updatedAt: Timestamp.now(),
        })

        deps.logger.info('Final race result submitted', { roomId, playerCount: finalRankings.length })
        return { success: true }
      } catch (error) {
        deps.logger.error('submitFinalRaceResult error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to submit final race result')
      }
    },
  )

  return { submitFinalRaceResult }
}
