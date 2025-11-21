# 백엔드 개발 가이드

## 개요

이 프로젝트는 Firebase를 백엔드로 사용합니다:
- **Firestore**: 실시간 데이터베이스 (룸 상태, 플레이어 정보, 게임 진행 상황)
- **Cloud Functions**: 서버 로직 (룸 생성, 게임 시뮬레이션, 상태 전환)
- **Firebase Emulator**: 로컬 개발 환경

---

## 1. 개발 환경 설정

### 1.1 Firebase CLI 설치 및 로그인

```bash
# Firebase CLI가 설치되어 있지 않다면
npm install -g firebase-tools

# Firebase 로그인
firebase login
```

### 1.2 로컬 개발 환경 실행

```bash
# 루트 디렉토리에서
npm run emulators
```

이 명령은 다음을 실행합니다:
- Functions 빌드
- Firestore Emulator (포트 8080)
- Functions Emulator (포트 5001)
- Emulator UI (포트 4000)

### 1.3 환경 변수 설정

프론트엔드에서 Emulator 사용:
```env
# frontend/.env
VITE_USE_FIREBASE_EMULATOR=true
```

---

## 2. 백엔드 아키텍처

### 2.1 데이터 흐름

```
프론트엔드 → Cloud Functions → Firestore
     ↓                              ↓
  실시간 리스너 ←─────────────── Firestore 변경사항
```

### 2.2 주요 원칙

1. **보안**: 모든 쓰기 작업은 Cloud Functions를 통해 수행
2. **실시간성**: Firestore 리스너로 실시간 상태 동기화
3. **검증**: Zod를 사용한 입력 데이터 검증
4. **에러 처리**: 명확한 에러 메시지 반환

---

## 3. 필요한 API 엔드포인트

### 3.1 룸 관리

| 함수명 | 설명 | 입력 | 출력 |
|--------|------|------|------|
| `createRoom` | 새 게임 룸 생성 | hostId, title, setCount, rerollLimit | roomId |
| `joinRoom` | 룸에 참가 | roomId, playerName | playerId |
| `leaveRoom` | 룸에서 나가기 | roomId, playerId | - |
| `startGame` | 게임 시작 (호스트만) | roomId | - |

### 3.2 게임 진행

| 함수명 | 설명 | 입력 | 출력 |
|--------|------|------|------|
| `selectRunStyle` | 주행 습성 선택 | roomId, playerId, runStyle | - |
| `selectAugment` | 증강 카드 선택 | roomId, playerId, setIndex, augmentId | - |
| `rerollAugments` | 증강 카드 새로고침 | roomId, playerId, setIndex | newAugments |
| `startRace` | 레이스 시작 | roomId, setIndex | raceResult |
| `skipSet` | 세트 스킵 | roomId, setIndex | - |

### 3.3 상태 관리

| 함수명 | 설명 | 입력 | 출력 |
|--------|------|------|------|
| `setPlayerReady` | 플레이어 준비 상태 변경 | roomId, playerId, isReady | - |
| `updateRoomStatus` | 룸 상태 변경 (내부용) | roomId, status | - |

---

## 4. Firestore 데이터 구조

### 4.1 룸 문서 (`rooms/{roomId}`)

```typescript
{
  hostId: string
  title: string
  setCount: number
  rerollLimit: number
  rerollUsed: number  // 누적 사용 횟수
  status: 'waiting' | 'runStyleSelection' | 'augmentSelection' | 'racing' | 'setResult' | 'finished'
  currentSet: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 4.2 플레이어 서브컬렉션 (`rooms/{roomId}/players/{playerId}`)

```typescript
{
  name: string
  avatar?: string
  isHost: boolean
  isReady: boolean
  runStyle?: RunStyleId
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
  joinedAt: Timestamp
}
```

### 4.3 세트 서브컬렉션 (`rooms/{roomId}/sets/{setId}`)

```typescript
{
  setIndex: number
  availableAugments: AugmentDefinition[]  // 모든 플레이어에게 동일
  selections: Record<playerId, augmentId>
  raceResult?: {
    rankings: Array<{ playerId: string, time: number, position: number }>
    startedAt: Timestamp
    finishedAt: Timestamp
  }
  status: 'pending' | 'augmentSelection' | 'racing' | 'completed'
  createdAt: Timestamp
}
```

---

## 5. 구현 순서 권장사항

### Phase 1: 기본 룸 관리
1. ✅ `createRoom` (이미 구현됨)
2. `joinRoom` - 플레이어 참가
3. `leaveRoom` - 플레이어 나가기
4. `setPlayerReady` - 준비 상태 변경

### Phase 2: 게임 시작
5. `startGame` - 모든 플레이어 준비 시 게임 시작
6. `selectRunStyle` - 주행 습성 선택

### Phase 3: 증강 시스템
7. `selectAugment` - 증강 선택
8. `rerollAugments` - 증강 새로고침

### Phase 4: 레이스
9. `startRace` - 레이스 시뮬레이션 실행
10. `skipSet` - 세트 스킵

---

## 6. 보안 규칙 전략

현재 Firestore 규칙은 모든 쓰기를 차단하고 있습니다. 이는 올바른 접근입니다:

- **읽기**: 클라이언트에서 직접 읽기 가능 (실시간 리스너)
- **쓰기**: Cloud Functions를 통해서만 가능

필요시 특정 필드만 클라이언트에서 업데이트 가능하도록 규칙을 완화할 수 있습니다:

```javascript
// 예: 플레이어가 자신의 isReady만 업데이트
match /rooms/{roomId}/players/{playerId} {
  allow update: if request.auth != null 
    && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['isReady']);
}
```

하지만 인증이 없으므로 현재 구조(모든 쓰기를 Functions로)가 더 안전합니다.

---

## 7. 에러 처리 패턴

```typescript
// functions/src/index.ts 예시
export const joinRoom = onCall(async (request) => {
  try {
    // 검증
    const { roomId, playerName } = validateInput(request.data)
    
    // 비즈니스 로직
    const roomRef = db.collection('rooms').doc(roomId)
    const room = await roomRef.get()
    
    if (!room.exists) {
      throw new HttpsError('not-found', 'Room not found')
    }
    
    // ... 로직 수행
    
    return { success: true, playerId }
  } catch (error) {
    logger.error('joinRoom error', error)
    if (error instanceof HttpsError) {
      throw error
    }
    throw new HttpsError('internal', 'Internal server error')
  }
})
```

---

## 8. 테스트 전략

### 8.1 Functions 단위 테스트

```typescript
// functions/src/__tests__/createRoom.test.ts
import { createRoom } from '../index'

describe('createRoom', () => {
  it('should create a room with valid input', async () => {
    // 테스트 코드
  })
})
```

### 8.2 통합 테스트 (Emulator 사용)

Firebase Emulator를 사용한 통합 테스트:
- 실제 Firestore와 Functions 상호작용 테스트
- 여러 플레이어 시나리오 테스트

---

## 9. 배포

### 9.1 Functions 배포

```bash
# Functions만 배포
firebase deploy --only functions

# 특정 함수만 배포
firebase deploy --only functions:createRoom
```

### 9.2 Firestore 규칙 배포

```bash
firebase deploy --only firestore:rules
```

---

## 10. 모니터링 및 디버깅

### 10.1 로깅

```typescript
import { logger } from 'firebase-functions'

logger.info('Room created', { roomId, hostId })
logger.warn('Invalid input', { errors })
logger.error('Database error', error)
```

### 10.2 Firebase Console

- Functions 로그: Firebase Console > Functions > Logs
- Firestore 데이터: Firebase Console > Firestore Database

---

## 다음 단계

1. 타입 정의 파일 생성 (`functions/src/types.ts`)
2. 공통 유틸리티 함수 작성 (`functions/src/utils.ts`)
3. 위 순서대로 Functions 구현
4. 프론트엔드 연동 유틸리티 작성


