/** 룸 문서 + 플레이어 목록을 Firestore에서 실시간 구독하는 훅 */

import { useEffect, useState } from 'react'
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore'
import { getFirebaseDb } from '../lib/firebase'
import type { Stats } from '../engine/race/types'

const DEFAULT_ROOM_MAX_PLAYERS = 8

// 서버 타입과 같은 의미로 맞춰서 사용하는 상태 타입
export type RoomStatus =
  | 'waiting'
  | 'horseSelection'
  | 'augmentSelection'
  | 'racing'
  | 'setResult'
  | 'finished'

export interface Room {
  title: string
  maxPlayers: number
  roundCount: number
  rerollLimit: number
  rerollUsed: number
  status: RoomStatus
  currentSet: number
  createdAt: Date | Timestamp
  updatedAt: Date | Timestamp
}

export interface Player {
  id?: string // Firestore 문서 ID (플레이어 식별용)
  name: string
  avatar?: string
  isHost: boolean
  isReady: boolean
  rerollUsed?: number
  currentSetLuckBonus?: number
  selectedAugments: Array<{
    setIndex: number
    augmentId: string
  }>
  horseStats?: Stats // 실제 게임 엔진의 Stats 구조 { Speed, Stamina, Power, Guts, Start, Luck }
  joinedAt: Date | Timestamp
}

interface UseRoomResult {
  room: Room | null
  players: Player[]
  loading: boolean
  error: FirestoreError | null
}

function toDateIfFirestoreTimestamp(value: unknown) {
  if (!value || typeof value !== 'object') return value
  const maybeTimestamp = value as { toDate?: () => Date }
  return typeof maybeTimestamp.toDate === 'function' ? maybeTimestamp.toDate() : value
}

function mapRoomData(data: Record<string, unknown>): Room {
  return {
    ...data,
    maxPlayers: typeof data.maxPlayers === 'number' ? data.maxPlayers : DEFAULT_ROOM_MAX_PLAYERS,
    createdAt: toDateIfFirestoreTimestamp(data.createdAt) as Date | Timestamp,
    updatedAt: toDateIfFirestoreTimestamp(data.updatedAt) as Date | Timestamp,
  } as Room
}

function mapPlayerData(playerId: string, data: Record<string, unknown>): Player {
  return {
    id: playerId,
    ...data,
    joinedAt: toDateIfFirestoreTimestamp(data.joinedAt) as Date | Timestamp,
  } as Player
}

/** roomId 기준으로 룸 데이터와 플레이어 목록을 실시간 구독한다. */
export function useRoom(roomId: string | null): UseRoomResult {
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<FirestoreError | null>(null)

  useEffect(() => {
    if (!roomId) {
      // roomId가 없으면 일단 초기 상태로 되돌리고 구독은 만들지 않는다.
      // roomId가 바뀌는 순간에 이전 데이터가 잠깐 보이지 않게 하려고 이렇게 초기화한다.
      /* eslint-disable react-hooks/set-state-in-effect */
      setRoom(null)
      setPlayers([])
      setLoading(false)
      setError(null)
      /* eslint-enable react-hooks/set-state-in-effect */
      return
    }

    const db = getFirebaseDb()
    // 구독 콜백이 오기 전까지는 로딩 상태로 바꿔 둔다.
    setLoading(true)
    setError(null)

    const subscribeRoomDocument = () => {
      const roomDocRef = doc(db, 'rooms', roomId)
      return onSnapshot(
        roomDocRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setRoom(null)
            setLoading(false)
            return
          }

          setRoom(mapRoomData(snapshot.data() as Record<string, unknown>))
          setLoading(false)
        },
        (err) => {
          console.error('Room subscription error:', err)
          setError(err)
          setLoading(false)
        },
      )
    }

    const subscribePlayersCollection = () => {
      const playersCollectionRef = collection(db, 'rooms', roomId, 'players')
      const playersQuery = query(playersCollectionRef, orderBy('joinedAt', 'asc'))
      return onSnapshot(
        playersQuery,
        (snapshot) => {
          const nextPlayers: Player[] = []
          snapshot.forEach((playerDoc) => {
            nextPlayers.push(
              mapPlayerData(playerDoc.id, playerDoc.data() as Record<string, unknown>),
            )
          })
          setPlayers(nextPlayers)
        },
        (err) => {
          console.error('Players subscription error:', err)
          // 플레이어 목록 구독 실패는 화면 전체를 막지 않으려고 콘솔 경고만 남긴다.
        },
      )
    }

    const unsubscribeRoom = subscribeRoomDocument()
    const unsubscribePlayers = subscribePlayersCollection()

    // roomId 바뀌거나 컴포넌트가 사라질 때 구독 해제
    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
    }
  }, [roomId])

  return { room, players, loading, error }
}
