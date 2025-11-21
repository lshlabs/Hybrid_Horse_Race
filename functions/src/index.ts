import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import { getRoom, isRoomFull } from './utils'
import type { RoomStatus } from './types'

initializeApp()

const db = getFirestore()

// ==================== 룸 관리 ====================

const createRoomSchema = z.object({
  hostId: z.string().min(1, 'hostId is required'),
  title: z.string().min(1).max(48),
  setCount: z.number().int().min(1).max(9),
  rerollLimit: z.number().int().min(0).max(5),
})

export const createRoom = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    try {
      const parseResult = createRoomSchema.safeParse(request.data)
      if (!parseResult.success) {
        logger.warn('Invalid createRoom payload', parseResult.error.flatten().fieldErrors)
        throw new HttpsError('invalid-argument', 'Invalid arguments', {
          errors: parseResult.error.flatten().fieldErrors,
        })
      }

      const { hostId, title, setCount, rerollLimit } = parseResult.data
      const roomRef = db.collection('rooms').doc()
      const now = Timestamp.now()

      // 룸 생성
      await roomRef.set({
        hostId,
        title,
        setCount,
        rerollLimit,
        rerollUsed: 0,
        status: 'waiting' as RoomStatus,
        currentSet: 1,
        createdAt: now,
        updatedAt: now,
      })

      // 호스트를 플레이어로 추가
      await roomRef.collection('players').doc(hostId).set({
        name: 'Host',
        isHost: true,
        isReady: false,
        selectedAugments: [],
        joinedAt: now,
      })

      logger.info('Created room', { roomId: roomRef.id, hostId })

      return {
        roomId: roomRef.id,
        status: 'waiting',
      }
    } catch (error) {
      logger.error('createRoom error', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', 'Failed to create room')
    }
  },
)

const joinRoomSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerName: z.string().min(1).max(20, 'Player name must be 1-20 characters'),
})

export const joinRoom = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    try {
      const parseResult = joinRoomSchema.safeParse(request.data)
      if (!parseResult.success) {
        throw new HttpsError('invalid-argument', 'Invalid arguments', {
          errors: parseResult.error.flatten().fieldErrors,
        })
      }

      const { roomId, playerName } = parseResult.data

      // 룸 존재 확인
      const room = await getRoom(roomId)

      // 룸이 가득 찼는지 확인
      if (await isRoomFull(roomId)) {
        throw new HttpsError('resource-exhausted', 'Room is full')
      }

      // 룸 상태 확인 (waiting 상태만 참가 가능)
      if (room.status !== 'waiting') {
        throw new HttpsError('failed-precondition', 'Room is not accepting new players')
      }

      // 플레이어 ID 생성 (간단하게 timestamp 기반)
      const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // 플레이어 추가
      const playerRef = db.collection('rooms').doc(roomId).collection('players').doc(playerId)
      await playerRef.set({
        name: playerName,
        isHost: false,
        isReady: false,
        selectedAugments: [],
        joinedAt: Timestamp.now(),
      })

      logger.info('Player joined room', { roomId, playerId, playerName })

      return {
        success: true,
        playerId,
      }
    } catch (error) {
      logger.error('joinRoom error', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', 'Failed to join room')
    }
  },
)

const setPlayerReadySchema = z.object({
  roomId: z.string().min(1),
  playerId: z.string().min(1),
  isReady: z.boolean(),
})

export const setPlayerReady = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    try {
      const parseResult = setPlayerReadySchema.safeParse(request.data)
      if (!parseResult.success) {
        throw new HttpsError('invalid-argument', 'Invalid arguments')
      }

      const { roomId, playerId, isReady } = parseResult.data

      // 룸 존재 확인
      await getRoom(roomId)

      // 플레이어 존재 확인 및 업데이트
      const playerRef = db.collection('rooms').doc(roomId).collection('players').doc(playerId)
      const playerDoc = await playerRef.get()

      if (!playerDoc.exists) {
        throw new HttpsError('not-found', 'Player not found in room')
      }

      await playerRef.update({ isReady })

      logger.info('Player ready status updated', { roomId, playerId, isReady })

      return { success: true }
    } catch (error) {
      logger.error('setPlayerReady error', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', 'Failed to update ready status')
    }
  },
)

