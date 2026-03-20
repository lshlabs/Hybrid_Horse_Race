import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { Player, RoomStatus } from '../types'

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

const MS_PER_DAY = 24 * 60 * 60 * 1000
const CALLABLE_OPTIONS = { region: 'asia-northeast3', cors: true } as const
const STATUS_WAITING: RoomStatus = 'waiting'
const STATUS_HORSE_SELECTION: RoomStatus = 'horseSelection'

export function createRoomLifecycleCallables(deps: RoomLifecycleDeps) {
  function parseOrThrow<T extends z.ZodTypeAny>(
    schema: T,
    data: unknown,
    options?: { warnMessage?: string },
  ): z.infer<T> {
    const parsed = schema.safeParse(data)
    if (parsed.success) {
      return parsed.data
    }
    if (options?.warnMessage) {
      deps.logger.warn(options.warnMessage, parsed.error.flatten().fieldErrors)
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

  function decodeUnloadBody(body: unknown, rawBody: Buffer): unknown {
    if (typeof body === 'string') {
      return JSON.parse(body)
    }
    if (Buffer.isBuffer(body)) {
      return JSON.parse(body.toString('utf8'))
    }
    if (!body && Buffer.isBuffer(rawBody)) {
      const raw = rawBody.toString('utf8')
      return raw ? JSON.parse(raw) : undefined
    }
    return body
  }

  async function executeLeaveRoom(params: {
    roomId: string
    playerId: string
    sessionToken: string
    joinToken: string
  }): Promise<void> {
    const { roomId, playerId, sessionToken, joinToken } = params
    await deps.getRoom(roomId)
    await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })

    const playerRef = deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId)
    const playerDoc = await playerRef.get()
    if (!playerDoc.exists) throw new HttpsError('not-found', 'Player not found in room')

    const player = playerDoc.data() as { isHost: boolean }
    await playerRef.delete()
    await deps.db.collection('rooms').doc(roomId).collection('participantAuth').doc(playerId).delete()

    const remainingPlayersRef = deps.db.collection('rooms').doc(roomId).collection('players')
    const remainingPlayers = await remainingPlayersRef.get()

    if (player.isHost) {
      if (remainingPlayers.size === 0) {
        await deps.db.collection('rooms').doc(roomId).delete()
        deps.logInfo('room.delete.emptyAfterHostLeave', { roomId })
      } else {
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
    CALLABLE_OPTIONS,
    async (request) => {
      try {
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
        const expiresAt = Timestamp.fromMillis(now.toMillis() + deps.guestSessionTtlDays * MS_PER_DAY)

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
        rethrowUnexpected(error, 'Failed to create guest session')
      }
    },
  )

  const createRoom = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const parsed = parseOrThrow(createRoomSchema, request.data, {
          warnMessage: 'Invalid createRoom payload',
        })
        const { playerId, sessionToken, hostName, title, maxPlayers, roundCount, rerollLimit } =
          parsed
        const normalizedHostName = deps.normalizePlayerName(hostName)
        if (!deps.isValidPlayerName(normalizedHostName)) {
          throw new HttpsError('invalid-argument', 'Invalid host name')
        }

        await deps.verifyGuestSession(playerId, sessionToken)
        const roomRef = deps.db.collection('rooms').doc()
        const now = Timestamp.now()

        await roomRef.set({
          title,
          maxPlayers,
          roundCount,
          rerollLimit,
          rerollUsed: 0,
          hostId: playerId,
          status: STATUS_WAITING,
          currentSet: 1,
          createdAt: now,
          updatedAt: now,
        })

        await roomRef.collection('players').doc(playerId).set({
          name: normalizedHostName,
          isHost: true,
          isReady: false,
          selectedAugments: [],
          joinedAt: now,
        })

        const issued = await deps.issueRoomJoinToken(roomRef.id, playerId)
        deps.logInfo('room.create.success', {
          roomId: roomRef.id,
          hostPlayerId: playerId,
          status: STATUS_WAITING,
          maxPlayers,
        })

        return {
          roomId: roomRef.id,
          status: STATUS_WAITING,
          joinToken: issued.joinToken,
          joinTokenExpiresAtMillis: issued.expiresAtMillis,
        }
      } catch (error) {
        deps.logger.error('createRoom error', error)
        rethrowUnexpected(error, 'Failed to create room')
      }
    },
  )

  const joinRoom = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const parsed = parseOrThrow(joinRoomSchema, request.data)
        const { roomId, playerId, sessionToken, playerName } = parsed
        const normalizedPlayerName = deps.normalizePlayerName(playerName)
        if (!deps.isValidPlayerName(normalizedPlayerName)) {
          throw new HttpsError('invalid-argument', 'Invalid player name')
        }
        await deps.verifyGuestSession(playerId, sessionToken)

        const room = await deps.getRoom(roomId)
        if (await deps.isPlayerInRoom(roomId, playerId)) {
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

        if (room.status !== STATUS_WAITING) {
          deps.logWarn('room.join.denied.status', { roomId, playerId, status: room.status })
          throw new HttpsError('failed-precondition', 'Room is not accepting new players')
        }

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
        rethrowUnexpected(error, 'Failed to join room')
      }
    },
  )

  const updatePlayerName = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const parsed = parseOrThrow(updatePlayerNameSchema, request.data)
        const { roomId, playerId, sessionToken, joinToken, name } = parsed
        const normalizedName = deps.normalizePlayerName(name)
        if (!deps.isValidPlayerName(normalizedName)) {
          throw new HttpsError('invalid-argument', 'Invalid player name')
        }

        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })
        await deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId).update({
          name: normalizedName,
        })
        deps.logInfo('room.playerName.updated', { roomId, playerId, nameLength: normalizedName.length })
        return { success: true }
      } catch (error) {
        deps.logger.error('updatePlayerName error', error)
        rethrowUnexpected(error, 'Failed to update player name')
      }
    },
  )

  const setPlayerReady = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const parsed = parseOrThrow(setPlayerReadySchema, request.data)
        const { roomId, playerId, sessionToken, joinToken, isReady } = parsed
        const room = await deps.getRoom(roomId)
        await deps.assertJoinedRoomPlayerRequest({ roomId, playerId, sessionToken, joinToken })

        if (room.status !== STATUS_WAITING) {
          throw new HttpsError('failed-precondition', 'Ready status can only be changed before game starts')
        }

        const playerRef = deps.db.collection('rooms').doc(roomId).collection('players').doc(playerId)
        await playerRef.update({ isReady })
        deps.logger.info('Player ready status updated', { roomId, playerId, isReady })
        return { success: true }
      } catch (error) {
        deps.logger.error('setPlayerReady error', error)
        rethrowUnexpected(error, 'Failed to update ready status')
      }
    },
  )

  const leaveRoom = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const parsed = parseOrThrow(leaveRoomSchema, request.data)
        await executeLeaveRoom(parsed)
        return { success: true }
      } catch (error) {
        deps.logger.error('leaveRoom error', error)
        rethrowUnexpected(error, 'Failed to leave room')
      }
    },
  )

  const leaveRoomOnUnload = onRequest(
    CALLABLE_OPTIONS,
    async (req, res) => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' })
        return
      }

      try {
        const body = decodeUnloadBody(req.body, req.rawBody)
        const payload =
          body && typeof body === 'object' ? ((body as { data?: unknown }).data ?? body) : undefined
        const parsed = parseOrThrow(leaveRoomSchema, payload)
        await executeLeaveRoom(parsed)
        res.status(204).send()
      } catch (error) {
        deps.logger.warn('leaveRoomOnUnload error', error)
        res.status(200).json({ ok: false })
      }
    },
  )

  const updateRoomSettings = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const parsed = parseOrThrow(updateRoomSettingsSchema, request.data)
        const { roomId, playerId, sessionToken, joinToken, roundCount, rerollLimit } = parsed
        await deps.assertHostWaitingRoomActionRequest({
          roomId,
          playerId,
          sessionToken,
          joinToken,
          hostErrorMessage: 'Only host can update room settings',
          waitingStatusMessage: 'Room settings can only be changed before game starts',
        })

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
        rethrowUnexpected(error, 'Failed to update room settings')
      }
    },
  )

  const startGame = onCall(
    CALLABLE_OPTIONS,
    async (request) => {
      try {
        const parsed = parseOrThrow(startGameSchema, request.data)
        const { roomId, playerId, sessionToken, joinToken } = parsed
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

        const setsSnapshot = await roomRef.collection('sets').get()
        if (!setsSnapshot.empty) {
          const deleteBatch = deps.db.batch()
          setsSnapshot.docs.forEach((doc) => deleteBatch.delete(doc.ref))
          await deleteBatch.commit()
        }

        await roomRef.update({
          status: STATUS_HORSE_SELECTION,
          currentSet: 1,
          rerollUsed: 0,
          updatedAt: Timestamp.now(),
        })

        deps.logger.info('Game started', { roomId, playerCount })
        return { success: true, status: STATUS_HORSE_SELECTION }
      } catch (error) {
        deps.logger.error('startGame error', error)
        rethrowUnexpected(error, 'Failed to start game')
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
