import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  getRoom,
  isRoomFull,
  isHost,
  isPlayerInRoom,
  areAllPlayersReady,
  getAllPlayers,
  updateRoomStatus,
} from './utils'
import type { RoomStatus, Player } from './types'

initializeApp()

const db = getFirestore()

// ==================== 룸 관리 ====================

const createRoomSchema = z.object({
  playerId: z.string().min(1, 'playerId is required'),
  title: z.string().min(1).max(48),
  roundCount: z.number().int().min(1).max(9),
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

      const { playerId, title, roundCount, rerollLimit } = parseResult.data
      const roomRef = db.collection('rooms').doc()
      const now = Timestamp.now()

      // 룸 생성
      await roomRef.set({
        title,
        roundCount,
        rerollLimit,
        rerollUsed: 0,
        status: 'waiting' as RoomStatus,
        currentSet: 1,
        createdAt: now,
        updatedAt: now,
      })

      // 호스트를 플레이어로 추가 (playerId 사용)
      await roomRef.collection('players').doc(playerId).set({
        name: 'Host',
        isHost: true,
        isReady: false,
        selectedAugments: [],
        joinedAt: now,
      })

      logger.info('Created room', { roomId: roomRef.id, playerId, isHost: true })

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
      const room = await getRoom(roomId)

      // 플레이어가 룸에 참가했는지 확인
      if (!(await isPlayerInRoom(roomId, playerId))) {
        throw new HttpsError('not-found', 'Player not found in room')
      }

      // 게임이 시작되지 않은 상태에서만 준비 상태 변경 가능
      if (room.status !== 'waiting') {
        throw new HttpsError(
          'failed-precondition',
          'Ready status can only be changed before game starts',
        )
      }

      // 플레이어 존재 확인 및 업데이트
      const playerRef = db.collection('rooms').doc(roomId).collection('players').doc(playerId)

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

const leaveRoomSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
})

export const leaveRoom = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    try {
      const parseResult = leaveRoomSchema.safeParse(request.data)
      if (!parseResult.success) {
        throw new HttpsError('invalid-argument', 'Invalid arguments', {
          errors: parseResult.error.flatten().fieldErrors,
        })
      }

      const { roomId, playerId } = parseResult.data

      // 룸 존재 확인
      const room = await getRoom(roomId)

      // 플레이어가 룸에 참가했는지 확인
      if (!(await isPlayerInRoom(roomId, playerId))) {
        throw new HttpsError('not-found', 'Player not found in room')
      }

      // 플레이어 정보 가져오기
      const playerRef = db.collection('rooms').doc(roomId).collection('players').doc(playerId)
      const playerDoc = await playerRef.get()

      if (!playerDoc.exists) {
        throw new HttpsError('not-found', 'Player not found in room')
      }

      const player = playerDoc.data() as { isHost: boolean }

      // 플레이어 삭제
      await playerRef.delete()

      // 남은 플레이어 수 확인
      const remainingPlayers = await db
        .collection('rooms')
        .doc(roomId)
        .collection('players')
        .get()

      // 호스트가 나간 경우
      if (player.isHost) {
        if (remainingPlayers.size === 0) {
          // 마지막 플레이어였으면 룸 삭제
          await db.collection('rooms').doc(roomId).delete()
          logger.info('Room deleted (host left, no players remaining)', { roomId })
        } else {
          // 다른 플레이어가 있으면 첫 번째 플레이어를 호스트로 위임
          const newHostId = remainingPlayers.docs[0].id
          await db
            .collection('rooms')
            .doc(roomId)
            .collection('players')
            .doc(newHostId)
            .update({ isHost: true })

          await db.collection('rooms').doc(roomId).update({
            hostId: newHostId,
            updatedAt: Timestamp.now(),
          })

          logger.info('Host changed', { roomId, newHostId })
        }
      }

      // 마지막 플레이어가 나간 경우 (호스트가 아닌 경우)
      if (!player.isHost && remainingPlayers.size === 0) {
        await db.collection('rooms').doc(roomId).delete()
        logger.info('Room deleted (last player left)', { roomId })
      }

      logger.info('Player left room', { roomId, playerId, wasHost: player.isHost })

      return { success: true }
    } catch (error) {
      logger.error('leaveRoom error', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', 'Failed to leave room')
    }
  },
)

const updateRoomSettingsSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  roundCount: z.number().int().min(1).max(9).optional(),
  rerollLimit: z.number().int().min(0).max(5).optional(),
})

export const updateRoomSettings = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    try {
      const parseResult = updateRoomSettingsSchema.safeParse(request.data)
      if (!parseResult.success) {
        throw new HttpsError('invalid-argument', 'Invalid arguments', {
          errors: parseResult.error.flatten().fieldErrors,
        })
      }

      const { roomId, playerId, roundCount, rerollLimit } = parseResult.data

      // 룸 존재 확인
      const room = await getRoom(roomId)

      // 플레이어가 룸에 참가했는지 확인
      if (!(await isPlayerInRoom(roomId, playerId))) {
        throw new HttpsError('not-found', 'Player not found in room')
      }

      // 호스트 권한 확인
      if (!(await isHost(roomId, playerId))) {
        throw new HttpsError('permission-denied', 'Only host can update room settings')
      }

      // 게임 시작 전에만 변경 가능
      if (room.status !== 'waiting') {
        throw new HttpsError(
          'failed-precondition',
          'Room settings can only be changed before game starts',
        )
      }

      // 업데이트할 필드 구성
      const updateData: { roundCount?: number; rerollLimit?: number; updatedAt: Timestamp } = {
        updatedAt: Timestamp.now(),
      }

      if (roundCount !== undefined) {
        updateData.roundCount = roundCount
      }

      if (rerollLimit !== undefined) {
        updateData.rerollLimit = rerollLimit
      }

      // 룸 설정 업데이트
      await db.collection('rooms').doc(roomId).update(updateData)

      logger.info('Room settings updated', { roomId, roundCount, rerollLimit })

      return { success: true }
    } catch (error) {
      logger.error('updateRoomSettings error', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', 'Failed to update room settings')
    }
  },
)

// ==================== 게임 진행 ====================

const startGameSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
})

export const startGame = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    try {
      const parseResult = startGameSchema.safeParse(request.data)
      if (!parseResult.success) {
        throw new HttpsError('invalid-argument', 'Invalid arguments', {
          errors: parseResult.error.flatten().fieldErrors,
        })
      }

      const { roomId, playerId } = parseResult.data

      // 룸 존재 확인
      const room = await getRoom(roomId)

      // 플레이어가 룸에 참가했는지 확인
      if (!(await isPlayerInRoom(roomId, playerId))) {
        throw new HttpsError('not-found', 'Player not found in room')
      }

      // 호스트 권한 확인
      if (!(await isHost(roomId, playerId))) {
        throw new HttpsError('permission-denied', 'Only host can start the game')
      }

      // 게임이 waiting 상태인지 확인
      if (room.status !== 'waiting') {
        throw new HttpsError(
          'failed-precondition',
          'Game can only be started when room is in waiting status',
        )
      }

      // 모든 플레이어 가져오기 (ID 포함)
      const playersSnapshot = await db
        .collection('rooms')
        .doc(roomId)
        .collection('players')
        .get()

      const playerCount = playersSnapshot.size

      // 최소 플레이어 수 확인 (최소 2명)
      if (playerCount < 2) {
        throw new HttpsError(
          'failed-precondition',
          'At least 2 players are required to start the game',
        )
      }

      // 모든 플레이어가 준비되었는지 확인
      if (!(await areAllPlayersReady(roomId))) {
        throw new HttpsError(
          'failed-precondition',
          'All players must be ready before starting the game',
        )
      }

      // 말 선택은 프론트엔드에서 이루어지며, selectHorse 함수를 통해 저장됨
      // 초기 스탯은 생성하지 않음 (말 선택 시 저장됨)

      // 룸 상태를 horseSelection으로 변경
      await updateRoomStatus(roomId, 'horseSelection')

      // 룸 업데이트
      await db.collection('rooms').doc(roomId).update({
        updatedAt: Timestamp.now(),
      })

      logger.info('Game started', { roomId, playerCount })

      return { success: true, status: 'horseSelection' }
    } catch (error) {
      logger.error('startGame error', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', 'Failed to start game')
    }
  },
)

const selectHorseSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
  playerId: z.string().min(1, 'playerId is required'),
  horseStats: z.object({
    Speed: z.number().min(0),
    Stamina: z.number().min(0),
    Power: z.number().min(0),
    Guts: z.number().min(0),
    Start: z.number().min(0),
    Luck: z.number().min(0),
  }),
})

export const selectHorse = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    try {
      const parseResult = selectHorseSchema.safeParse(request.data)
      if (!parseResult.success) {
        throw new HttpsError('invalid-argument', 'Invalid arguments', {
          errors: parseResult.error.flatten().fieldErrors,
        })
      }

      const { roomId, playerId, horseStats } = parseResult.data

      // 룸 존재 확인
      const room = await getRoom(roomId)

      // 게임이 horseSelection 상태인지 확인
      if (room.status !== 'horseSelection') {
        throw new HttpsError(
          'failed-precondition',
          'Horse can only be selected during horseSelection phase',
        )
      }

      // 플레이어 정보 가져오기
      const playerRef = db.collection('rooms').doc(roomId).collection('players').doc(playerId)
      const playerDoc = await playerRef.get()

      if (!playerDoc.exists) {
        throw new HttpsError('not-found', 'Player not found in room')
      }

      const player = playerDoc.data() as Player

      // 이미 말을 선택했는지 확인
      if (player.horseStats) {
        throw new HttpsError(
          'failed-precondition',
          'Horse has already been selected for this player',
        )
      }

      // 플레이어의 말 스탯 저장
      await playerRef.update({
        horseStats,
        updatedAt: Timestamp.now(),
      })

      // 모든 플레이어가 말을 선택했는지 확인
      const playersSnapshot = await db
        .collection('rooms')
        .doc(roomId)
        .collection('players')
        .get()

      const allSelected = playersSnapshot.docs.every((doc) => {
        const player = doc.data() as Player
        return player.horseStats !== undefined
      })

      if (allSelected) {
        // 모든 플레이어가 선택 완료 → augmentSelection 단계로 전환
        await updateRoomStatus(roomId, 'augmentSelection')

        logger.info('All players selected horse, moving to augment selection', {
          roomId,
          playerCount: playersSnapshot.size,
        })
      }

      logger.info('Horse selected', { roomId, playerId, horseStats })

      return {
        success: true,
        allPlayersSelected: allSelected,
        nextStatus: allSelected ? 'augmentSelection' : 'horseSelection',
      }
    } catch (error) {
      logger.error('selectHorse error', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', 'Failed to select horse')
    }
  },
)

// ==================== 최종 결과 ====================

const submitFinalRaceResultSchema = z.object({
  roomId: z.string().min(1, 'roomId is required'),
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

export const submitFinalRaceResult = onCall(
  {
    region: 'asia-northeast3',
    cors: true,
  },
  async (request) => {
    try {
      const parseResult = submitFinalRaceResultSchema.safeParse(request.data)
      if (!parseResult.success) {
        throw new HttpsError('invalid-argument', 'Invalid arguments', {
          errors: parseResult.error.flatten().fieldErrors,
        })
      }

      const { roomId, finalRankings } = parseResult.data

      // 룸 존재 확인
      const room = await getRoom(roomId)

      // 룸 상태를 finished로 변경
      await updateRoomStatus(roomId, 'finished')

      // 최종 결과를 룸 문서에 저장
      await db.collection('rooms').doc(roomId).update({
        finalResult: {
          finalRankings,
          submittedAt: Timestamp.now(),
        },
        updatedAt: Timestamp.now(),
      })

      logger.info('Final race result submitted', { roomId, playerCount: finalRankings.length })

      return { success: true }
    } catch (error) {
      logger.error('submitFinalRaceResult error', error)
      if (error instanceof HttpsError) {
        throw error
      }
      throw new HttpsError('internal', 'Failed to submit final race result')
    }
  },
)

