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
  type Timestamp,
} from 'firebase/firestore'
import { getFirebaseDb } from '../lib/firebase'
import type { Stats } from '../engine/race/types'

// 타입 정의 (functions/src/types.ts와 동일)
export type RoomStatus =
  | 'waiting'
  | 'horseSelection'
  | 'augmentSelection'
  | 'racing'
  | 'setResult'
  | 'finished'

export interface Room {
  title: string
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
      // roomId가 없으면 초기 상태로 리셋하고 구독 설정하지 않음
      // 이 패턴은 roomId 변경 시 초기화를 위해 필요함
      // 참고: useEffect 내 setState는 일반적으로 피해야 하지만,
      // 구독 설정 전 초기화는 이 패턴이 필요함
      /* eslint-disable react-hooks/set-state-in-effect */
      setRoom(null)
      setPlayers([])
      setLoading(false)
      setError(null)
      /* eslint-enable react-hooks/set-state-in-effect */
      return
    }

    const db = getFirebaseDb()
    // 구독 설정 전에 로딩 상태 설정 (구독 콜백에서 업데이트됨)
    // 이 setState는 구독 시작 전 초기화를 위해 필요함
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
