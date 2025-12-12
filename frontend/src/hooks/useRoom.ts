/**
 * 룸 데이터 실시간 구독 훅
 */

import { useEffect, useState } from 'react'
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
  type FirestoreError,
} from 'firebase/firestore'
import { getFirebaseDb } from '../lib/firebase'

// 타입 정의 (functions/src/types.ts와 동일)
export type RoomStatus =
  | 'waiting'
  | 'runStyleSelection'
  | 'augmentSelection'
  | 'racing'
  | 'setResult'
  | 'finished'

export type RunStyleId = 'paceSetter' | 'frontRunner' | 'stalker' | 'closer'

export interface Room {
  hostId: string
  title: string
  setCount: number
  rerollLimit: number
  rerollUsed: number
  status: RoomStatus
  currentSet: number
  createdAt: any // Timestamp
  updatedAt: any // Timestamp
}

export interface Player {
  id?: string // Firestore 문서 ID (플레이어 식별용)
  name: string
  avatar?: string
  isHost: boolean
  isReady: boolean
  runStyle?: RunStyleId
  availableRunStyles?: RunStyleId[]
  selectedAugments: Array<{
    setIndex: number
    augmentId: string
  }>
  horseStats?: {
    speed: number
    stamina: number
    condition: number
    jockeySkill: number
  }
  joinedAt: any // Timestamp
}

interface UseRoomResult {
  room: Room | null
  players: Player[]
  loading: boolean
  error: FirestoreError | null
}

/**
 * 룸 데이터와 플레이어 목록을 실시간으로 구독
 */
export function useRoom(roomId: string | null): UseRoomResult {
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<FirestoreError | null>(null)

  useEffect(() => {
    if (!roomId) {
      setRoom(null)
      setPlayers([])
      setLoading(false)
      setError(null)
      return
    }

    const db = getFirebaseDb()
    setLoading(true)
    setError(null)

    // 룸 문서 구독
    const roomDocRef = doc(db, 'rooms', roomId)
    const unsubscribeRoom = onSnapshot(
      roomDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data()
          setRoom({
            ...data,
            createdAt: data.createdAt?.toDate?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
          } as Room)
        } else {
          setRoom(null)
        }
        setLoading(false)
      },
      (err) => {
        console.error('Room subscription error:', err)
        setError(err)
        setLoading(false)
      },
    )

    // 플레이어 서브컬렉션 구독
    const playersCollectionRef = collection(db, 'rooms', roomId, 'players')
    const playersQuery = query(playersCollectionRef, orderBy('joinedAt', 'asc'))
    const unsubscribePlayers = onSnapshot(
      playersQuery,
      (snapshot) => {
        const playersList: Player[] = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          playersList.push({
            id: doc.id, // Firestore 문서 ID 추가
            ...data,
            joinedAt: data.joinedAt?.toDate?.() || data.joinedAt,
          } as Player)
        })
        setPlayers(playersList)
      },
      (err) => {
        console.error('Players subscription error:', err)
        // 플레이어 구독 에러는 별도로 처리하지 않음 (경고만)
      },
    )

    // 클린업
    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
    }
  }, [roomId])

  return { room, players, loading, error }
}
