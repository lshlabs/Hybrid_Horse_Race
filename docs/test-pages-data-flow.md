# 테스트 페이지 데이터 흐름 정리

각 테스트 페이지에서 전송하는 데이터, 받는 데이터, 생성하는 데이터를 정리한 문서입니다.

> **업데이트:** 2024년 개선 사항 적용 완료. 자세한 내용은 `테스트 페이지 데이터 흐름 개선 사항 적용 완료.md` 참조.

## 1. LandingPageTest.tsx

### 받는 데이터
- 없음 (시작 페이지)

### 생성하는 데이터
- `roomId`: Mock 룸 ID 생성 (`test-room-${Date.now()}`)
- `playerId`: `getUserId()`로 사용자 ID 가져오기
- **localStorage에 저장:**
  - `dev_player_id`: playerId
  - `dev_room_config`: 게임 설정 객체
    ```typescript
    {
      playerCount: number,
      roundCount: number,
      rerollLimit: number
    }
    ```

### 전송하는 데이터
**URL 파라미터로 LobbyPageTest로 전달:**
- `roomId`: 생성된 룸 ID
- `playerId`: 플레이어 ID

```typescript
// 전송 예시
navigate(`/lobby-test?roomId=${newRoomId}&playerId=${playerId}`)
```

---

## 2. LobbyPageTest.tsx

### 받는 데이터
**URL 파라미터에서:**
- `roomId`: 룸 ID
- `playerId`: 플레이어 ID (선택, 없으면 생성)

**localStorage에서:**
- `dev_room_config`: 게임 설정 (playerCount, roundCount, rerollLimit)

### 생성하는 데이터
- `playerId`: URL에 없는 경우 `getUserId()`로 생성 (신규 플레이어)
- `mockRoom`: Mock 룸 객체 생성
- `mockPlayers`: Mock 플레이어 배열 생성
- **localStorage에 저장:**
  - `dev_player_id`: playerId (업데이트)
  - `dev_player_names`: 플레이어 ID와 닉네임 쌍 (`Record<string, string>`)
  - `dev_participant_ids`: 참여한 플레이어 ID 배열 (`string[]`)

### 전송하는 데이터
**URL 파라미터로 HorseSelectionPageTest로 전달:**
- `roomId`: 룸 ID
- `playerId`: 플레이어 ID

```typescript
// 전송 예시
navigate(`/horse-selection-test?roomId=${roomId}&playerId=${playerId}`)
```

---

## 3. HorseSelectionPageTest.tsx

### 받는 데이터
**URL 파라미터에서:**
- `roomId`: 룸 ID
- `playerId`: 플레이어 ID (없으면 localStorage에서)

**localStorage에서:**
- `dev_player_id`: playerId (fallback)
- `dev_room_config`: 게임 설정 (playerCount, roundCount, rerollLimit)
- `dev_selected_horses`: 이미 선택한 말 데이터 (있는 경우)

### 생성하는 데이터
- `candidates`: 말 후보 배열 (3개, 각각 `id`, `nameKey`, `stats` 포함)
- **localStorage에 저장:**
  - `dev_selected_horses[playerId]`: 선택한 말 데이터
    ```typescript
    {
      name: string,        // 번역된 말 이름
      stats: Stats,         // 말의 능력치
      totalStats: number,  // 총 능력치 합계
      selectedAt: string   // 선택 시각 (ISO string)
    }
    ```

### 전송하는 데이터
**URL 파라미터로 RacePageTest로 전달:**
- `roomId`: 룸 ID
- `playerId`: 플레이어 ID

```typescript
// 전송 예시
navigate(`/race-test?roomId=${roomId}&playerId=${playerId}`)
```

---

## 4. RacePageTest.tsx

### 받는 데이터
**URL 파라미터에서:**
- `roomId`: 룸 ID
- `playerId`: 플레이어 ID (없으면 localStorage에서)

**localStorage에서:**
- `dev_player_id`: playerId (fallback)
- `dev_room_config`: 게임 설정 (playerCount, roundCount, rerollLimit)
- `dev_selected_horses[playerId]`: 선택한 말 데이터
  ```typescript
  {
    name: string,
    stats: Stats,
    totalStats: number,
    selectedAt: string
  }
  ```
- `dev_player_names`: 플레이어 ID와 닉네임 쌍
- `dev_participant_ids`: 참여한 플레이어 ID 배열

### 생성하는 데이터
- `mockRoom`: Mock 룸 객체 (localStorage 기반)
- `mockPlayers`: Mock 플레이어 배열 (localStorage 데이터 기반)

### 전송하는 데이터
**CustomEvent로 수신 (race-final-result 이벤트):**
```typescript
{
  finalRankings: Array<{
    rank: number
    name: string
    totalScore: number
    roundResults: Array<{
      rank: number
      name: string
      time: number
      finished: boolean
      augments?: unknown[]
    } | null>
  }>
  roomId?: string
  playerId?: string
}
```

**location.state로 RaceResultPageTest로 전달:**
- `finalRankings`: 최종 순위 배열
- `roomId`: 룸 ID
- `playerId`: 플레이어 ID

```typescript
// 전송 예시
navigate('/race-result-test', {
  state: {
    finalRankings: customEvent.detail.finalRankings,
    roomId: customEvent.detail.roomId || roomId,
    playerId: customEvent.detail.playerId || playerId,
  }
})
```

> **참고:** CustomEvent는 Phaser ↔ React 내부 통신에만 사용되며, 페이지 이동은 navigate의 state를 통해 이루어집니다.

---

## 5. RaceResultPageTest.tsx

### 받는 데이터
**location.state에서 (신뢰 소스):**
- `finalRankings`: 최종 순위 배열
- `roomId`: 룸 ID
- `playerId`: 플레이어 ID

**localStorage에서:**
- `dev_room_config`: 게임 설정 (playerCount, roundCount, rerollLimit)

**URL 파라미터에서 (fallback):**
- `roomId`: 룸 ID (state에 없는 경우)

### 생성하는 데이터
- 없음 (전달받은 데이터 사용)
- **참고:** `finalRankings`가 없으면 Mock 데이터 생성하고 경고 표시

### 전송하는 데이터
- 없음 (최종 페이지)

> **개선 사항:** location.state를 신뢰 소스로 삼고, 없을 경우 명시적으로 Mock 데이터 사용 표시

---

## 데이터 흐름 다이어그램

### 개선 후 (현재)

```
LandingPageTest
  ↓ localStorage: dev_player_id, dev_room_config 저장
  ↓ URL params: roomId, playerId
LobbyPageTest (playerId 생성 가능)
  ↓ localStorage: dev_player_id (업데이트), dev_player_names, dev_participant_ids 저장
  ↓ URL params: roomId, playerId
HorseSelectionPageTest
  ↓ localStorage: dev_selected_horses[playerId] 저장
  ↓ URL params: roomId, playerId
RacePageTest
  ↓ localStorage에서 모든 설정 및 데이터 읽기
  ↓ CustomEvent (Phaser ↔ React 통신)
  ↓ location.state: finalRankings, roomId, playerId
RaceResultPageTest (location.state 신뢰)
  (최종 페이지)
```

### 개선 전

```
LandingPageTest
  ↓ URL params: roomId, playerCount, roundCount, rerollLimit
LobbyPageTest
  ↓ localStorage: dev_player_names, dev_participant_ids 저장
  ↓ URL params: roomId, playerId?, playerCount, roundCount, rerollLimit
HorseSelectionPageTest
  ↓ localStorage: dev_selected_horse 저장
  ↓ URL params: roomId, playerId?, playerCount, roundCount, rerollLimit
RacePageTest
  ↓ localStorage: dev_selected_horse, dev_player_names, dev_participant_ids 읽기
  ↓ CustomEvent: race-final-result
  ↓ location.state: finalRankings, roomId, playerId
RaceResultPageTest
  (최종 페이지)
```

---

## localStorage 데이터 구조

### dev_player_id (신규)
```typescript
string
// 예: "user-1234567890"
// 용도: 현재 플레이어 ID, 새로고침 시 유지
```

### dev_room_config (신규)
```typescript
{
  playerCount: number,
  roundCount: number,
  rerollLimit: number
}
// 예: { playerCount: 4, roundCount: 3, rerollLimit: 2 }
// 용도: 게임 설정, URL 파라미터 대신 사용
```

### dev_selected_horses (변경: 단수 → 복수)
```typescript
Record<string, {
  name: string,        // 번역된 말 이름
  stats: Stats,        // { Speed, Stamina, Power, Guts, Start, Consistency }
  totalStats: number,  // 총 능력치 합계
  selectedAt: string  // ISO 8601 형식의 타임스탬프
}>
// 예: {
//   "user-123": { name: "돌개", stats: {...}, totalStats: 85, selectedAt: "2024-01-..." },
//   "user-456": { name: "미르", stats: {...}, totalStats: 88, selectedAt: "2024-01-..." }
// }
// 용도: playerId별 선택한 말 데이터, 멀티플레이 대응
```

### dev_player_names (유지)
```typescript
Record<string, string>
// 예: { "test-host-id": "돌개", "player-1": "미르", "player-2": "노을" }
// 용도: 플레이어 ID와 닉네임 매핑
```

### dev_participant_ids (유지)
```typescript
string[]
// 예: ["test-host-id", "player-1", "player-2", "player-3"]
// 용도: 참여한 플레이어 ID 목록
```

---

## 주요 데이터 전달 방식

1. **URL 파라미터**: 페이지 간 이동 시 최소한의 식별자만 전달 (roomId, playerId)
2. **localStorage**: 브라우저 세션 동안 유지되는 데이터 저장 (설정, 선택 데이터 등)
3. **location.state**: React Router의 네비게이션 상태로 복잡한 객체 전달 (최종 결과 등)
4. **CustomEvent**: Phaser 게임 엔진과 React 간 내부 통신

## 개선 사항 요약

### 주요 변경 사항
1. **playerId 생성 책임**: Lobby에서 생성 가능 (URL에 없으면)
2. **URL 파라미터 간소화**: 5개 → 2개 (roomId, playerId만)
3. **게임 설정 localStorage 저장**: `dev_room_config` 사용
4. **말 선택 데이터 구조 확장**: `dev_selected_horses[playerId]` (멀티플레이 대응)
5. **RaceResultPage 데이터 신뢰**: location.state만 신뢰, 없으면 Mock 경고
6. **playerId localStorage 저장**: `dev_player_id` (세션 안정성)

### 개선 효과
- URL 파라미터 감소로 navigate 수정 범위 축소
- localStorage 기반 설정 관리로 유연성 증가
- playerId 기반 데이터 구조로 멀티플레이 확장 준비
- 데이터 출처 명확화로 디버깅 편의성 향상
- 새로고침 시에도 데이터 유지로 테스트 안정성 증가

자세한 내용은 `테스트 페이지 데이터 흐름 개선 사항 적용 완료.md`를 참조하세요.
