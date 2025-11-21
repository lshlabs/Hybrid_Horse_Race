# 백엔드 사용 예시

프론트엔드에서 백엔드 Functions를 사용하는 방법을 보여주는 예시입니다.

## 1. 룸 생성 및 참가

### 룸 생성

```typescript
import { createRoom } from '@/lib/firebase-functions'

async function handleCreateRoom() {
  try {
    const hostId = generateHostId() // 예: localStorage에서 가져오거나 생성
    const result = await createRoom({
      hostId,
      title: 'My Game Room',
      setCount: 3,
      rerollLimit: 2,
    })
    
    console.log('Room created:', result.data.roomId)
    // 룸 ID를 URL에 포함하거나 상태에 저장
    navigate(`/lobby/${result.data.roomId}`)
  } catch (error) {
    console.error('Failed to create room:', error)
    // 에러 처리
  }
}
```

### 룸 참가

```typescript
import { joinRoom } from '@/lib/firebase-functions'

async function handleJoinRoom(roomId: string, playerName: string) {
  try {
    const result = await joinRoom({
      roomId,
      playerName,
    })
    
    console.log('Joined room:', result.data.playerId)
    // playerId를 localStorage에 저장
    localStorage.setItem('playerId', result.data.playerId)
    
    // 룸 상태 구독 시작
    subscribeToRoom(roomId)
  } catch (error) {
    if (error.code === 'resource-exhausted') {
      alert('룸이 가득 찼습니다.')
    } else if (error.code === 'not-found') {
      alert('룸을 찾을 수 없습니다.')
    } else {
      console.error('Failed to join room:', error)
    }
  }
}
```

## 2. 실시간 상태 구독

### Firestore 리스너로 룸 상태 구독

```typescript
import { getFirebaseDb } from '@/lib/firebase'
import { doc, onSnapshot } from 'firebase/firestore'

function subscribeToRoom(roomId: string) {
  const db = getFirebaseDb()
  const roomRef = doc(db, 'rooms', roomId)
  
  // 룸 상태 구독
  const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      console.log('Room does not exist')
      return
    }
    
    const roomData = snapshot.data()
    console.log('Room status:', roomData.status)
    
    // 상태에 따라 UI 업데이트
    switch (roomData.status) {
      case 'waiting':
        // 대기실 UI
        break
      case 'runStyleSelection':
        // 주행 습성 선택 UI
        break
      case 'augmentSelection':
        // 증강 선택 UI
        break
      // ...
    }
  })
  
  // 플레이어 리스트 구독
  const playersRef = collection(db, 'rooms', roomId, 'players')
  const unsubscribePlayers = onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    
    console.log('Players updated:', players)
    // 플레이어 리스트 UI 업데이트
  })
  
  // 정리 함수 반환
  return () => {
    unsubscribeRoom()
    unsubscribePlayers()
  }
}
```

## 3. 플레이어 준비 상태 변경

```typescript
import { setPlayerReady } from '@/lib/firebase-functions'

async function handleToggleReady(roomId: string, playerId: string, isReady: boolean) {
  try {
    await setPlayerReady({
      roomId,
      playerId,
      isReady,
    })
    
    // Firestore 리스너가 자동으로 UI를 업데이트함
  } catch (error) {
    console.error('Failed to update ready status:', error)
  }
}
```

## 4. React Hook 예시

### useRoom Hook

```typescript
import { useState, useEffect } from 'react'
import { getFirebaseDb } from '@/lib/firebase'
import { doc, collection, onSnapshot } from 'firebase/firestore'
import type { Room, Player } from '@/types'

export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  
  useEffect(() => {
    if (!roomId) {
      setLoading(false)
      return
    }
    
    const db = getFirebaseDb()
    const roomRef = doc(db, 'rooms', roomId)
    const playersRef = collection(db, 'rooms', roomId, 'players')
    
    // 룸 구독
    const unsubscribeRoom = onSnapshot(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setRoom({ id: snapshot.id, ...snapshot.data() } as Room)
          setError(null)
        } else {
          setError(new Error('Room not found'))
        }
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )
    
    // 플레이어 구독
    const unsubscribePlayers = onSnapshot(
      playersRef,
      (snapshot) => {
        const playersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Player[]
        setPlayers(playersData)
      },
      (err) => {
        console.error('Error subscribing to players:', err)
      }
    )
    
    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
    }
  }, [roomId])
  
  return { room, players, loading, error }
}
```

### 사용 예시

```typescript
import { useRoom } from '@/hooks/useRoom'
import { setPlayerReady } from '@/lib/firebase-functions'

function LobbyPage() {
  const { roomId } = useParams()
  const { room, players, loading } = useRoom(roomId || null)
  const playerId = localStorage.getItem('playerId')
  
  const handleReady = async () => {
    if (!roomId || !playerId) return
    
    const currentPlayer = players.find(p => p.id === playerId)
    const newReadyState = !currentPlayer?.isReady
    
    await setPlayerReady({
      roomId,
      playerId,
      isReady: newReadyState,
    })
  }
  
  if (loading) return <div>Loading...</div>
  if (!room) return <div>Room not found</div>
  
  return (
    <div>
      <h1>{room.title}</h1>
      <p>Status: {room.status}</p>
      
      <ul>
        {players.map(player => (
          <li key={player.id}>
            {player.name} - {player.isReady ? 'Ready' : 'Not Ready'}
          </li>
        ))}
      </ul>
      
      <button onClick={handleReady}>
        {players.find(p => p.id === playerId)?.isReady ? 'Unready' : 'Ready'}
      </button>
    </div>
  )
}
```

## 5. 에러 처리 패턴

```typescript
import { HttpsError } from 'firebase/functions'

async function handleApiCall() {
  try {
    const result = await someFunction({ ... })
    return result.data
  } catch (error) {
    if (error instanceof HttpsError) {
      switch (error.code) {
        case 'not-found':
          // 리소스를 찾을 수 없음
          break
        case 'permission-denied':
          // 권한 없음
          break
        case 'resource-exhausted':
          // 리소스 부족 (예: 룸이 가득 참)
          break
        case 'failed-precondition':
          // 전제 조건 실패 (예: 룸이 waiting 상태가 아님)
          break
        case 'invalid-argument':
          // 잘못된 인자
          break
        default:
          // 기타 에러
      }
    } else {
      // 네트워크 에러 등
      console.error('Unexpected error:', error)
    }
    throw error
  }
}
```

## 6. 개발 환경 설정

### .env 파일

```env
# frontend/.env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_USE_FIREBASE_EMULATOR=true  # 개발 환경에서만 true
```

### Emulator 실행

```bash
# 터미널 1: Emulator 실행
npm run emulators

# 터미널 2: 프론트엔드 개발 서버
npm run dev
```

Emulator UI는 `http://localhost:4000`에서 접근 가능합니다.


