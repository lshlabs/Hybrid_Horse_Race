/**
 * 공통 유틸리티 함수
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import type { Room, Player, RoomStatus } from './types'

// Lazy initialization to avoid issues with module loading order
function getDb() {
  return getFirestore()
}

/**
 * 룸 존재 여부 확인
 */
export async function getRoom(roomId: string): Promise<Room> {
  const db = getDb()
  const roomRef = db.collection('rooms').doc(roomId)
  const roomDoc = await roomRef.get()

  if (!roomDoc.exists) {
    throw new HttpsError('not-found', `Room ${roomId} not found`)
  }

  return roomDoc.data() as Room
}

/**
 * 플레이어 정보 가져오기
 */
export async function getPlayer(
  roomId: string,
  playerId: string,
): Promise<Player | null> {
  const db = getDb()
  const playerRef = db.collection('rooms').doc(roomId).collection('players').doc(playerId)
  const playerDoc = await playerRef.get()

  if (!playerDoc.exists) {
    return null
  }

  return playerDoc.data() as Player
}

/**
 * 룸의 모든 플레이어 가져오기
 */
export async function getAllPlayers(roomId: string): Promise<Player[]> {
  const db = getDb()
  const playersSnapshot = await db
    .collection('rooms')
    .doc(roomId)
    .collection('players')
    .get()

  return playersSnapshot.docs.map((doc) => doc.data() as Player)
}

/**
 * 룸 상태 업데이트
 */
export async function updateRoomStatus(
  roomId: string,
  status: RoomStatus,
): Promise<void> {
  const db = getDb()
  const roomRef = db.collection('rooms').doc(roomId)
  await roomRef.update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  })
}

/**
 * 플레이어 수 확인
 */
export async function getPlayerCount(roomId: string): Promise<number> {
  const db = getDb()
  const playersSnapshot = await db
    .collection('rooms')
    .doc(roomId)
    .collection('players')
    .get()

  return playersSnapshot.size
}

/**
 * 호스트 확인
 */
export async function isHost(roomId: string, playerId: string): Promise<boolean> {
  const room = await getRoom(roomId)
  return room.hostId === playerId
}

/**
 * 플레이어가 룸에 참가했는지 확인
 */
export async function isPlayerInRoom(
  roomId: string,
  playerId: string,
): Promise<boolean> {
  const player = await getPlayer(roomId, playerId)
  return player !== null
}

/**
 * 룸이 가득 찼는지 확인
 */
export async function isRoomFull(roomId: string): Promise<boolean> {
  const playerCount = await getPlayerCount(roomId)
  // 최대 플레이어 수는 8명 (README 참고)
  return playerCount >= 8
}

/**
 * 모든 플레이어가 준비되었는지 확인
 */
export async function areAllPlayersReady(roomId: string): Promise<boolean> {
  const players = await getAllPlayers(roomId)

  if (players.length === 0) {
    return false
  }

  return players.every((player) => player.isReady)
}

/**
 * 초기 능력치 생성
 * speed: 60-120, stamina: 60-120, condition: 40-100, jockeySkill: 50-100
 */
export function generateInitialStats(): {
  speed: number
  stamina: number
  condition: number
  jockeySkill: number
} {
  return {
    speed: Math.floor(Math.random() * 61) + 60, // 60-120
    stamina: Math.floor(Math.random() * 61) + 60, // 60-120
    condition: Math.floor(Math.random() * 61) + 40, // 40-100
    jockeySkill: Math.floor(Math.random() * 51) + 50, // 50-100
  }
}

/**
 * 랜덤 주행 습성 3개 선택
 * 4가지 습성 중 3개를 랜덤으로 선택
 */
export function selectRandomRunStyles(): string[] {
  const allStyles: string[] = ['paceSetter', 'frontRunner', 'stalker', 'closer']
  const shuffled = [...allStyles].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

