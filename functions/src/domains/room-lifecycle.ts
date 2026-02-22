import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { Player, RoomStatus } from '../types'

// 로비 단계에서 쓰는 callable들을 모아둔 파일
// (세션 생성, 방 생성/입장, 이름/준비 상태 변경, 게임 시작, 퇴장)
type LoggerLike = {
  info: (message: string, context?: Record<string, unknown>) => void
  warn: (message: string, context?: unknown) => void
  error: (message: string, error: unknown) => void
}

type LogFn = (event: string, context: Record<string, unknown>) => void

type RoomLifecycleDeps = {
  db: FirebaseFirestore.Firestore
  logger: LoggerLike
  logInfo: LogFn
  logWarn: LogFn
  guestSessionTtlDays: number
  normalizePlayerName: (name: string) => string
  isValidPlayerName: (name: string) => boolean
  createGuestId: () => string
  createSessionToken: () => string
  issueRoomJoinToken: (
    roomId: string,
    playerId: string,
  ) => Promise<{ joinToken: string; expiresAtMillis: number }>
  verifyGuestSession: (playerId: string, sessionToken: string) => Promise<void>
  getRoom: (roomId: string) => Promise<{
    status: RoomStatus
    currentSet: number
    roundCount: number
  }>
  isPlayerInRoom: (roomId: string, playerId: string) => Promise<boolean>
  isRoomFull: (roomId: string) => Promise<boolean>
  areAllPlayersReady: (roomId: string) => Promise<boolean>
  assertJoinedRoomPlayerRequest: (params: {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
  }) => Promise<void>
  assertHostWaitingRoomActionRequest: (params: {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
    hostErrorMessage: string
    waitingStatusMessage: string
  }) => Promise<{
    status: RoomStatus
    currentSet: number
    roundCount: number
  }>
}

const createRoomSchema = z.object({
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  hostName: z.string().min(1, 'hostName is required').max(20, 'hostName is too long'),
  title: z.string().min(1).max(48),
  maxPlayers: z.number().int().min(2).max(8),
  roundCount: z.number().int().min(1).max(9),
  rerollLimit: z.number().int().min(0).max(5),
})

const joinRoomSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  playerName: z.string().min(1).max(20, 'Player name must be 1-20 characters'),
})

const updatePlayerNameSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  name: z.string().min(1, 'name is required').max(32, 'name is too long'),
})

const setPlayerReadySchema = z.object({
  roomId: z.string().min(1),
  playerId: z.string().min(1),
  sessionToken: z.string().min(1),
  joinToken: z.string().min(1),
  isReady: z.boolean(),
})

const leaveRoomSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
})

const updateRoomSettingsSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
  roundCount: z.number().int().min(1).max(9).optional(),
  rerollLimit: z.number().int().min(0).max(5).optional(),
})

const startGameSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  sessionToken: z.string().min(1, 'sessionToken is required'),
  joinToken: z.string().min(1, 'joinToken is required'),
})

export function createRoomLifecycleCallables(deps: RoomLifecycleDeps) {
  // leaveRoom / leaveRoomOnUnload가 같이 쓰는 공통 퇴장 처리
  // host가 나가면 새 host를 지정하고, 마지막 플레이어가 나가면 방을 지운다.
  async function executeLeaveRoom(params: {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
  }): Promise<void> {
    const { roomId, playerId, sessionToken, joinToken } = params
    // room 존재 여부 / 토큰 / 실제 참가자 여부를 먼저 확인한다.
    await deps.getRoom(roomId)
    await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })

    const playerRef = deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId)
    const playerDoc = await playerRef.get()
    if (!playerDoc.exists) throw new HttpsError('not-found', 'Player not found in room')

    const player = playerDoc.data() as { isHost: boolean }
    // players 문서 + participantAuth 문서를 같이 정리한다.
    await playerRef.delete()
    await deps.db.collection('rooms').doc(roomId).collection('participantAuth').doc(playerId).delete()

    const remainingPlayersRef = deps.db.collection('rooms').doc(roomId).collection('players')
    const remainingPlayers = await remainingPlayersRef.get()

    if (player.isHost) {
      if (remainingPlayers.size === 0) {
        // host가 마지막 플레이어면 방도 같이 삭제
        await deps.db.collection('rooms').doc(roomId).delete()
        deps.logInfo('room.delete.emptyAfterHostLeave', { roomId })
      } else {
        // host가 나갔는데 다른 플레이어가 있으면 가장 먼저 들어온 플레이어에게 host를 넘긴다.
        const earliestJoinedSnapshot = await remainingPlayersRef.orderBy('joinedAt', 'asc').limit(1).get()
        const newHostId = earliestJoinedSnapshot.docs[0]?.id
        if (!newHostId) throw new HttpsError('internal', 'Failed to resolve new host')

        await deps.db.collection('rooms').doc(roomId).collection('players').doc(newHostId).update({
          isHost: true,
        })
        await deps.db.collection('rooms').doc(roomId).update({
          hostId: newHostId,
          updatedAt: Timestamp.now(),
        })
        deps.logInfo('room.host.transferred', { roomId, newHostId, reason: 'host-left' })
      }
    }

    if (!player.isHost && remainingPlayers.size === 0) {
      // host가 아닌 플레이어가 마지막으로 남았다가 나간 경우도 방 삭제
      await deps.db.collection('rooms').doc(roomId).delete()
      deps.logInfo('room.delete.lastPlayerLeft', { roomId })
    }

    deps.logInfo('room.leave.success', {
      roomId,
      playerId,
      wasHost: player.isHost,
      remainingPlayers: remainingPlayers.size,
    })
  }

  const createGuestSession = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 기존 guestId를 들고 오면 재사용하고, 없으면 새 guest를 만든다.
        const requestedGuestIdRaw =
          request.data && typeof request.data === 'object'
            ? (request.data as { guestId?: unknown }).guestId
            : undefined
        const requestedGuestId =
          typeof requestedGuestIdRaw === 'string' && requestedGuestIdRaw.trim().length > 0
            ? requestedGuestIdRaw.trim()
            : undefined

        const guestId = requestedGuestId || deps.createGuestId()
        const sessionToken = deps.createSessionToken()
        const now = Timestamp.now()
        const expiresAt = Timestamp.fromMillis(
          now.toMillis() + deps.guestSessionTtlDays * 24 * 60 * 60 * 1000,
        )

        // guest 세션은 ttl 기반으로 관리하고 lastSeenAt도 같이 저장한다.
        await deps.db.collection('guestSessions').doc(guestId).set({
          sessionToken,
          createdAt: now,
          lastSeenAt: now,
          expiresAt,
        })

        deps.logInfo('session.guest.created', { guestId, requestedGuestId: !!requestedGuestId })
        return { guestId, sessionToken, expiresAtMillis: expiresAt.toMillis() }
      } catch (error) {
        deps.logger.error('createGuestSession error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to create guest session')
      }
    },
  )

  const createRoom = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 1) 입력값 검증
        const parseResult = createRoomSchema.safeParse(request.data)
        if (!parseResult.success) {
          deps.logger.warn('Invalid createRoom payload', parseResult.error.flatten().fieldErrors)
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        // 2) 세션 확인 + room 문서/host player 문서 생성
        const { playerId, sessionToken, hostName, title, maxPlayers, roundCount, rerollLimit } =
          parseResult.data
        const normalizedHostName = deps.normalizePlayerName(hostName)
        if (!deps.isValidPlayerName(normalizedHostName)) {
          throw new HttpsError('invalid-argument', 'Invalid host name')
        }

        // host도 room 생성 전에 guest 세션이 유효해야 한다.
        await deps.verifyGuestSession(playerId, sessionToken)
        const roomRef = deps.db.collection('rooms').doc()
        const now = Timestamp.now()

        // 방 메타 정보는 room 문서에 저장
        await roomRef.set({
          title,
          maxPlayers,
          roundCount,
          rerollLimit,
          rerollUsed: 0,
          hostId: playerId,
          status: 'waiting' as RoomStatus,
          currentSet: 1,
          createdAt: now,
          updatedAt: now,
        })

        // host도 players 컬렉션에 일반 플레이어와 같은 형태로 저장
        await roomRef.collection('players').doc(playerId).set({
          name: normalizedHostName,
          isHost: true,
          isReady: false,
          selectedAugments: [],
          joinedAt: now,
        })

        // 이후 모든 room 요청 검증에 쓰는 joinToken도 같이 발급한다.
        const issued = await deps.issueRoomJoinToken(roomRef.id, playerId)
        deps.logInfo('room.create.success', {
          roomId: roomRef.id,
          hostPlayerId: playerId,
          status: 'waiting',
          maxPlayers,
        })

        return {
          roomId: roomRef.id,
          status: 'waiting',
          joinToken: issued.joinToken,
          joinTokenExpiresAtMillis: issued.expiresAtMillis,
        }
      } catch (error) {
        deps.logger.error('createRoom error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to create room')
      }
    },
  )

  const joinRoom = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 입장 / 재입장 공통 경로
        const parseResult = joinRoomSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, playerName } = parseResult.data
        const normalizedPlayerName = deps.normalizePlayerName(playerName)
        if (!deps.isValidPlayerName(normalizedPlayerName)) {
          throw new HttpsError('invalid-argument', 'Invalid player name')
        }
        await deps.verifyGuestSession(playerId, sessionToken)

        const room = await deps.getRoom(roomId)
        if (await deps.isPlayerInRoom(roomId, playerId)) {
          // 재입장인 경우 플레이어 문서를 다시 만들지 않고 토큰만 재발급한다.
          const issued = await deps.issueRoomJoinToken(roomId, playerId)
          deps.logInfo('room.join.rejoin', { roomId, playerId })
          return {
            success: true,
            playerId,
            joinToken: issued.joinToken,
            joinTokenExpiresAtMillis: issued.expiresAtMillis,
            rejoined: true,
          }
        }

        if (await deps.isRoomFull(roomId)) {
          deps.logWarn('room.join.denied.full', { roomId, playerId })
          throw new HttpsError('resource-exhausted', 'Room is full')
        }

        if (room.status !== 'waiting') {
          deps.logWarn('room.join.denied.status', { roomId, playerId, status: room.status })
          throw new HttpsError('failed-precondition', 'Room is not accepting new players')
        }

        // 새 참가자는 waiting 상태일 때만 players 문서를 생성한다.
        const playerRef = deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId)
        await playerRef.set({
          name: normalizedPlayerName,
          isHost: false,
          isReady: false,
          selectedAugments: [],
          joinedAt: Timestamp.now(),
        })

        const issued = await deps.issueRoomJoinToken(roomId, playerId)
        deps.logInfo('room.join.success', { roomId, playerId })
        return {
          success: true,
          playerId,
          joinToken: issued.joinToken,
          joinTokenExpiresAtMillis: issued.expiresAtMillis,
          rejoined: false,
        }
      } catch (error) {
        deps.logger.error('joinRoom error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to join room')
      }
    },
  )

  const updatePlayerName = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 이름 변경은 room 참가자 검증 후 players 문서만 수정한다.
        const parseResult = updatePlayerNameSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, name } = parseResult.data
        const normalizedName = deps.normalizePlayerName(name)
        if (!deps.isValidPlayerName(normalizedName)) {
          throw new HttpsError('invalid-argument', 'Invalid player name')
        }

        // 이름 변경은 room 상태와 상관없이 참가자 본인 요청이면 허용한다.
        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })
        await deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId).update({
          name: normalizedName,
        })
        deps.logInfo('room.playerName.updated', { roomId, playerId, nameLength: normalizedName.length })
        return { success: true }
      } catch (error) {
        deps.logger.error('updatePlayerName error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to update player name')
      }
    },
  )

  const setPlayerReady = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // waiting 상태에서만 준비 체크를 바꿀 수 있다.
        const parseResult = setPlayerReadySchema.safeParse(request.data)
        if (!parseResult.success) throw new HttpsError('invalid-argument', 'Invalid arguments')

        const { roomId, playerId, sessionToken, joinToken, isReady } = parseResult.data
        const room = await deps.getRoom(roomId)
        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })

        if (room.status !== 'waiting') {
          throw new HttpsError('failed-precondition', 'Ready status can only be changed before game starts')
        }

        // 준비 상태는 players 문서에만 저장된다.
        const playerRef = deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId)
        await playerRef.update({ isReady })
        deps.logger.info('Player ready status updated', { roomId, playerId, isReady })
        return { success: true }
      } catch (error) {
        deps.logger.error('setPlayerReady error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to update ready status')
      }
    },
  )

  const leaveRoom = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 버튼 클릭으로 나갈 때 쓰는 일반 퇴장 API
        const parseResult = leaveRoomSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        await executeLeaveRoom(parseResult.data)
        return { success: true }
      } catch (error) {
        deps.logger.error('leaveRoom error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to leave room')
      }
    },
  )

  const leaveRoomOnUnload = onRequest(
    { region: 'asia-northeast3', cors: true },
    async (req, res) => {
      // unload/sendBeacon 경로라서 body 형태가 브라우저마다 조금 다를 수 있다.
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' })
        return
      }

      try {
        // 브라우저/환경에 따라 body가 string, Buffer, object로 들어올 수 있다.
        let body: unknown = req.body
        if (typeof body === 'string') {
          body = JSON.parse(body)
        } else if (Buffer.isBuffer(body)) {
          body = JSON.parse(body.toString('utf8'))
        } else if (!body && Buffer.isBuffer(req.rawBody)) {
          const raw = req.rawBody.toString('utf8')
          if (raw) body = JSON.parse(raw)
        }

        // sendBeacon 구현에 따라 {data: ...} 래핑이 들어오는 경우도 같이 처리
        const payload =
          body && typeof body === 'object' ? ((body as { data?: unknown }).data ?? body) : undefined
        const parseResult = leaveRoomSchema.safeParse(payload)
        if (!parseResult.success) {
          res.status(400).json({ error: 'Invalid arguments' })
          return
        }

        await executeLeaveRoom(parseResult.data)
        res.status(204).send()
      } catch (error) {
        deps.logger.warn('leaveRoomOnUnload error', error)
        res.status(200).json({ ok: false })
      }
    },
  )

  const updateRoomSettings = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // host가 waiting 상태에서만 라운드 수 / 리롤 제한을 바꿀 수 있다.
        const parseResult = updateRoomSettingsSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken, roundCount, rerollLimit } = parseResult.data
        await deps.assertHostWaitingRoomActionRequest({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          hostErrorMessage: 'Only host can update room settings',
          waitingStatusMessage: 'Room settings can only be changed before game starts',
        })

        // 전달된 값만 부분 업데이트한다.
        const updateData: { roundCount?: number; rerollLimit?: number; updatedAt: Timestamp } = {
          updatedAt: Timestamp.now(),
        }
        if (roundCount !== undefined) updateData.roundCount = roundCount
        if (rerollLimit !== undefined) updateData.rerollLimit = rerollLimit

        await deps.db.collection('rooms').doc(roomId).update(updateData)
        deps.logger.info('Room settings updated', { roomId, roundCount, rerollLimit })
        return { success: true }
      } catch (error) {
        deps.logger.error('updateRoomSettings error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to update room settings')
      }
    },
  )

  const startGame = onCall(
    { region: 'asia-northeast3', cors: true },
    async (request) => {
      try {
        // 게임 시작 전에 플레이어 수/준비 상태를 확인하고,
        // 이전 게임 세트 데이터/라운드 임시값을 초기화한다.
        const parseResult = startGameSchema.safeParse(request.data)
        if (!parseResult.success) {
          throw new HttpsError('invalid-argument', 'Invalid arguments', {
            errors: parseResult.error.flatten().fieldErrors,
          })
        }

        const { roomId, playerId, sessionToken, joinToken } = parseResult.data
        await deps.assertHostWaitingRoomActionRequest({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          hostErrorMessage: 'Only host can start the game',
          waitingStatusMessage: 'Game can only be started when room is in waiting status',
        })

        const roomRef = deps.db.collection('rooms').doc(roomId)
        const playersSnapshot = await roomRef.collection('players').get()
        const playerCount = playersSnapshot.size
        if (playerCount < 2) {
          throw new HttpsError('failed-precondition', 'At least 2 players are required to start the game')
        }
        if (!(await deps.areAllPlayersReady(roomId))) {
          throw new HttpsError('failed-precondition', 'All players must be ready before starting the game')
        }

        // 새 게임 시작 전에 플레이어별 임시 상태를 초기화
        const resetBatch = deps.db.batch()
        playersSnapshot.docs.forEach((doc) => {
          resetBatch.update(doc.ref, {
            selectedAugments: [],
            horseStats: FieldValue.delete(),
            currentSetLuckBonus: 0,
            rerollUsed: 0,
            updatedAt: Timestamp.now(),
          })
        })
        await resetBatch.commit()

        // 이전 게임 세트 문서가 남아 있으면 삭제해서 다음 게임이 섞이지 않게 한다.
        const setsSnapshot = await roomRef.collection('sets').get()
        if (!setsSnapshot.empty) {
          const deleteBatch = deps.db.batch()
          setsSnapshot.docs.forEach((doc) => deleteBatch.delete(doc.ref))
          await deleteBatch.commit()
        }

        // room 상태를 horseSelection으로 바꾸면서 현재 세트를 1로 리셋한다.
        await roomRef.update({
          status: 'horseSelection',
          currentSet: 1,
          rerollUsed: 0,
          updatedAt: Timestamp.now(),
        })

        deps.logger.info('Game started', { roomId, playerCount })
        return { success: true, status: 'horseSelection' }
      } catch (error) {
        deps.logger.error('startGame error', error)
        if (error instanceof HttpsError) throw error
        throw new HttpsError('internal', 'Failed to start game')
      }
    },
  )

  return {
    createGuestSession,
    createRoom,
    joinRoom,
    updatePlayerName,
    setPlayerReady,
    leaveRoom,
    leaveRoomOnUnload,
    updateRoomSettings,
    startGame,
  }
}
