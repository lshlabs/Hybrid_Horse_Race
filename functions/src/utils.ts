import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { HttpsError } from 'firebase-functions/v2/https'
import type { Room, Player, RoomStatus } from './types'

const DEFAULT_MAX_PLAYERS = 8
const STAT_KEYS = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Luck'] as const
const BASE_STAT_VALUE = 8
const TOTAL_STAT_POINTS = 80
const INITIAL_STATS = {
  Speed: BASE_STAT_VALUE,
  Stamina: BASE_STAT_VALUE,
  Power: BASE_STAT_VALUE,
  Guts: BASE_STAT_VALUE,
  Start: BASE_STAT_VALUE,
  Luck: BASE_STAT_VALUE,
}

function getDb(): FirebaseFirestore.Firestore {
  return getFirestore()
}

function getRoomRef(db: FirebaseFirestore.Firestore, roomId: string) {
  return db.collection('rooms').doc(roomId)
}

function getPlayersRef(db: FirebaseFirestore.Firestore, roomId: string) {
  return getRoomRef(db, roomId).collection('players')
}

export async function getRoom(roomId: string): Promise<Room> {
  const db = getDb()
  const roomRef = getRoomRef(db, roomId)
  const roomDoc = await roomRef.get()

  if (!roomDoc.exists) {
    throw new HttpsError('not-found', `Room ${roomId} not found`)
  }

  return roomDoc.data() as Room
}

export async function getPlayer(roomId: string, playerId: string): Promise<Player | null> {
  const db = getDb()
  const playerRef = getPlayersRef(db, roomId).doc(playerId)
  const playerDoc = await playerRef.get()

  if (!playerDoc.exists) {
    return null
  }

  return playerDoc.data() as Player
}

export async function getAllPlayers(roomId: string): Promise<Player[]> {
  const db = getDb()
  const playersSnapshot = await getPlayersRef(db, roomId).get()

  return playersSnapshot.docs.map((doc) => doc.data() as Player)
}

export async function updateRoomStatus(roomId: string, status: RoomStatus): Promise<void> {
  const db = getDb()
  const roomRef = getRoomRef(db, roomId)
  await roomRef.update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function getPlayerCount(roomId: string): Promise<number> {
  const db = getDb()
  const playersSnapshot = await getPlayersRef(db, roomId).get()

  return playersSnapshot.size
}

export async function isHost(roomId: string, playerId: string): Promise<boolean> {
  const player = await getPlayer(roomId, playerId)
  return player?.isHost === true
}

export async function isPlayerInRoom(roomId: string, playerId: string): Promise<boolean> {
  const player = await getPlayer(roomId, playerId)
  return player !== null
}

export async function isRoomFull(roomId: string): Promise<boolean> {
  const room = await getRoom(roomId)
  const playerCount = await getPlayerCount(roomId)
  const maxPlayers = typeof room.maxPlayers === 'number' ? room.maxPlayers : DEFAULT_MAX_PLAYERS
  return playerCount >= maxPlayers
}

export async function areAllPlayersReady(roomId: string): Promise<boolean> {
  const players = await getAllPlayers(roomId)
  const guestPlayers = players.filter((player) => !player.isHost)

  if (guestPlayers.length === 0) {
    return false
  }

  return guestPlayers.every((player) => player.isReady)
}

export function generateInitialStats(): {
  Speed: number
  Stamina: number
  Power: number
  Guts: number
  Start: number
  Luck: number
} {
  const stats = { ...INITIAL_STATS }
  let remainingPoints = TOTAL_STAT_POINTS - STAT_KEYS.length * BASE_STAT_VALUE

  while (remainingPoints > 0) {
    const randomIndex = Math.floor(Math.random() * STAT_KEYS.length)
    const key = STAT_KEYS[randomIndex]
    stats[key] += 1
    remainingPoints -= 1
  }

  return stats
}
