const ROOM_JOIN_TOKEN_KEY = 'hybrid-horse-race-room-join-tokens'

interface StoredRoomJoinToken {
  joinToken: string
  expiresAtMillis: number
}

type RoomJoinTokenMap = Record<string, StoredRoomJoinToken>

function readMap(): RoomJoinTokenMap {
  const raw = localStorage.getItem(ROOM_JOIN_TOKEN_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as RoomJoinTokenMap
  } catch {
    return {}
  }
}

function writeMap(map: RoomJoinTokenMap): void {
  localStorage.setItem(ROOM_JOIN_TOKEN_KEY, JSON.stringify(map))
}

export function setRoomJoinToken(roomId: string, joinToken: string, expiresAtMillis: number): void {
  if (!roomId) return
  const map = readMap()
  map[roomId] = {
    joinToken,
    expiresAtMillis,
  }
  writeMap(map)
}

export function getRoomJoinToken(roomId: string): string | null {
  if (!roomId) return null
  const map = readMap()
  const entry = map[roomId]
  if (!entry) return null
  if (entry.expiresAtMillis <= Date.now() + 30_000) {
    delete map[roomId]
    writeMap(map)
    return null
  }
  return entry.joinToken
}

export function clearRoomJoinToken(roomId: string): void {
  if (!roomId) return
  const map = readMap()
  delete map[roomId]
  writeMap(map)
}
