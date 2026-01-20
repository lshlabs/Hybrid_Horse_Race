# PhaserGame과 Firebase 통신 구조

## 개요

Phaser3 게임( RaceScene )과 Vite/React/Firebase 간의 통신 구조를 준비했습니다.

## 통신 흐름

```
RacePage (React)
  ↓ (URL 파라미터: roomId, playerId)
  ↓ (useRoom 훅으로 Firebase 구독)
  ↓ (room, players 데이터)
PhaserGame (React 컴포넌트)
  ↓ (props로 데이터 전달)
  ↓ (scene.data.set() 및 이벤트 emit)
RaceScene (Phaser Scene)
  ↓ (scene.data.get() 및 이벤트 구독)
  ↓ (게임 로직에서 사용)
```

## 구현 세부사항

### 1. RacePage (`frontend/src/pages/RacePage.tsx`)

- URL 파라미터에서 `roomId`, `playerId` 추출
- `useRoom` 훅을 사용하여 Firebase Firestore에서 룸 데이터 실시간 구독
- 로딩 및 에러 상태 처리
- `PhaserGame` 컴포넌트에 데이터 전달

```typescript
const roomId = searchParams.get('roomId')
const playerId = searchParams.get('playerId')
const { room, players, loading, error } = useRoom(roomId)

<PhaserGame
  roomId={roomId || undefined}
  playerId={playerId || undefined}
  room={room || undefined}
  players={players}
  userId={userId || undefined}
/>
```

### 2. PhaserGame (`frontend/src/components/game/PhaserGame.tsx`)

- React 컴포넌트로 Phaser Game 인스턴스 관리
- `roomId`, `playerId`, `room`, `players`, `userId`를 props로 받음
- Phaser Scene의 `data` 객체를 통해 데이터 전달
- 커스텀 이벤트(`room-data-updated`)로 실시간 업데이트 전달

```typescript
// scene.data를 통한 데이터 전달
raceScene.data.set('roomId', roomId)
raceScene.data.set('playerId', playerId)
raceScene.data.set('room', room)
raceScene.data.set('players', players)
raceScene.data.set('userId', userId)

// 이벤트를 통한 실시간 업데이트
raceScene.events.emit('room-data-updated', {
  roomId, playerId, room, players, userId
})
```

### 3. RaceScene (`frontend/src/components/game/scenes/RaceScene.ts`)

- Phaser Scene에서 Firebase 데이터 수신
- `init()` 메서드에서 초기 데이터 받기
- `create()` 메서드에서 `scene.data` 읽기 및 이벤트 구독
- `onFirebaseDataUpdated()` 메서드로 데이터 업데이트 처리

```typescript
// Firebase 데이터 저장
private roomId?: string
private playerId?: string
private room?: Room
private players?: Player[]
private userId?: string

// 데이터 로드
private loadFirebaseData() {
  this.roomId = this.data.get('roomId')
  this.playerId = this.data.get('playerId')
  this.room = this.data.get('room')
  this.players = this.data.get('players')
  this.userId = this.data.get('userId')
}

// 이벤트 구독
this.events.on('room-data-updated', (data) => {
  // 데이터 업데이트 처리
  this.onFirebaseDataUpdated()
})
```

## 데이터 전달 방법

### 방법 1: Phaser Scene Data

Phaser Scene의 `data` 객체를 사용하여 데이터를 저장하고 읽을 수 있습니다.

```typescript
// React에서 Phaser로 전달
scene.data.set('key', value)

// Phaser에서 읽기
const value = scene.data.get('key')
```

### 방법 2: Phaser Events

Phaser의 이벤트 시스템을 사용하여 실시간 업데이트를 전달할 수 있습니다.

```typescript
// React에서 Phaser로 이벤트 발생
scene.events.emit('event-name', data)

// Phaser에서 이벤트 구독
scene.events.on('event-name', (data) => {
  // 처리
})
```

## 사용 예시

### RacePage 접근

```
/race?roomId=abc123&playerId=player456
```

### RaceScene에서 데이터 사용

```typescript
// 룸 상태 확인
if (this.room?.status === 'racing') {
  // 레이스 시작
}

// 플레이어 수에 맞게 말 생성
const playerCount = this.players?.length || 8
this.gameSettings.playerCount = playerCount

// 현재 플레이어의 말 인덱스 찾기
const currentPlayerIndex = this.players?.findIndex(
  (p) => (p.isHost && this.room?.hostId === this.userId) || p.id === this.playerId
)
```

## 다음 단계

1. **RaceScene에서 Firebase 데이터 활용**
   - 플레이어 수에 맞게 말 생성
   - 룸 상태에 따른 게임 플로우 제어
   - 플레이어 선택한 증강 적용

2. **Firebase Functions와 통신**
   - 레이스 시작 시 `startRace` 함수 호출
   - 레이스 결과 업로드
   - 실시간 동기화

3. **에러 처리 강화**
   - 네트워크 에러 처리
   - 룸 상태 불일치 처리
   - 재연결 로직

## 주의사항

- Phaser Scene은 React 컴포넌트와 독립적으로 실행되므로, 데이터 전달 시 주의가 필요합니다.
- `scene.data`는 Scene이 생성된 후에만 접근 가능합니다.
- 이벤트 리스너는 적절히 정리해야 메모리 누수를 방지할 수 있습니다.

## 참고 파일

- `frontend/src/pages/RacePage.tsx` - React 페이지 컴포넌트
- `frontend/src/components/game/PhaserGame.tsx` - Phaser 게임 래퍼 컴포넌트
- `frontend/src/components/game/scenes/RaceScene.ts` - Phaser 게임 씬
- `frontend/src/hooks/useRoom.ts` - Firebase 룸 데이터 구독 훅
- `frontend/src/lib/firebase.ts` - Firebase 초기화
- `frontend/src/lib/firebase-functions.ts` - Firebase Functions 호출
