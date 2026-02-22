import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { z } from 'zod'
import type { Augment, Player, Room } from '../types'
import type {
  GetRaceStateSetDocData,
  GetSetResultRaceRanking,
  GetSetResultSetSummary,
} from '../common/response-builders'

// 레이스 진행 중/결과 화면에서 클라이언트가 polling으로 읽는 callable 모음
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

const getSetResultSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
})

const getRaceStateSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  setIndex: z.number().int().min(1),
})

function countReadyForNextPlayers(readyForNext?: Record<string, boolean>): number {
  // 결과 화면에서 "다음 라운드 준비한 사람 수"를 보여줄 때 쓰는 값
  return Object.keys(readyForNext ?? {}).filter((id) => readyForNext?.[id] === true).length
}

export function createRaceReadCallables(deps: RaceReadDeps) {
  const getRaceState = onCall(
    {
      region: 'asia-northeast3',
      cors: true,
    },
    async (request) => {
      try {
        // 1) 입력 검증
        const parseResult = getRaceStateSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseResult.data
        // 2) 룸 참가/토큰 검증
        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })

        // 3) 현재 라운드와 요청 라운드가 맞는지 확인
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

        // raceState는 세트 문서 안에 저장되어 있어서 set-{n} 문서를 직접 읽는다.
        const setDocRef = deps.db.collection('rooms').doc(roomId).collection('sets').doc(`set-${setIndex}`)
        const setDoc = await setDocRef.get()
        if (!setDoc.exists) {
          // prepareRace 전에는 아직 set 문서가 없을 수 있다.
          return { success: true, hasRaceState: false }
        }

        const setData = setDoc.data() as GetRaceStateSetDocData | undefined
        // prepared/running/completed 분기와 keyframe/eventsWindow 응답 형태는
        // builder에서 한 곳에서 맞춘다.
        return deps.buildGetRaceStateResponse({ setIndex, setData })
      } catch (error) {
        deps.logger.error('getRaceState error', error)
        if (error instanceof HttpsError) {
          throw error
        }
        throw new HttpsError('internal', 'Failed to get race state')
      }
    },
  )

  const getSetResult = onCall(
    {
      region: 'asia-northeast3',
      cors: true,
    },
    async (request) => {
      try {
        // 1) 입력 검증
        const parseResult = getSetResultSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, setIndex } = parseResult.data
        // 2) 룸 참가/토큰 검증
        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })

        // 결과 화면에서 바로 쓸 데이터라 players / sets(누적 증강용)까지 같이 읽는다.
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
          // 결과 집계 전이면 빈 결과로 내려주고 클라이언트가 다시 polling한다.
          // readyCount는 결과가 아직 없어도 "다음 라운드 준비한 사람 수" UI에 먼저 쓸 수 있다.
          return {
            success: true,
            hasResult: false,
            rankings: [],
            readyCount: countReadyForNextPlayers(setData?.readyForNext),
          }
        }

        // 이름 매핑용으로 playerId -> player 데이터 맵을 만든다.
        const playersById: Record<string, Player> = {}
        playersSnapshot.docs.forEach((doc) => {
          playersById[doc.id] = doc.data() as Player
        })

        // 누적 증강까지 붙인 결과 형태로 변환
        const allSets = deps.getSortedSetSummaries(allSetSnapshot)
        const rankings = deps.buildSetResultRankings({
          raceRankings: raceResult.rankings,
          playersById,
          allSets,
        })

        // startedAtMillis는 결과 화면에서 타임라인 표시/디버그용으로 같이 내려준다.
        return {
          success: true,
          hasResult: true,
          rankings,
          startedAtMillis: setData?.raceResult?.startedAt?.toMillis?.() ?? null,
          readyCount: countReadyForNextPlayers(setData?.readyForNext),
        }
      } catch (error) {
        deps.logger.error('getSetResult error', error)
        if (error instanceof HttpsError) {
          throw error
        }
        throw new HttpsError('internal', 'Failed to get set result')
      }
    },
  )

  return { getRaceState, getSetResult }
}
