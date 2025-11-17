# 업무 분담 가이드

백엔드(파이어베이스)와 프론트엔드(리액트) 팀원 간의 명확한 업무 분담 및 협업 가이드를 정리한 문서입니다.

---

## 현재 진행 상황 요약

### ✅ 완료된 작업

**프론트엔드**
- 프로젝트 초기 설정 (Vite + React + TypeScript)
- Tailwind CSS 테마 설정 (다크 톤 + 네온 하이라이트)
- i18n 다국어 지원 설정 (한국어/영어)
- 기본 레이아웃 컴포넌트 (AppShell, AppFooter)
- 랜딩 페이지 UI (`LandingPage.tsx`)
- 대기실 페이지 UI (`LobbyPage.tsx`) - **하드코딩된 데이터 사용 중**
- 말 선택 페이지 UI (`HorseSelectionPage.tsx`) - **증강 선택은 미구현**
- Firebase 클라이언트 초기화 (`lib/firebase.ts`)

**백엔드**
- Firebase 프로젝트 초기 설정
- `createRoom` Cloud Function 구현 (`functions/src/index.ts`)
- 기본 Firestore 보안 규칙 설정 (`firestore.rules`)

### 🚧 진행 중 / 미완료 작업

- Firestore 실시간 동기화 연동
- 증강 선택 시스템 구현
- 레이스 시뮬레이션 로직
- Phaser 3 레이스 씬 렌더링
- 세트 결과 화면
- 최종 결과 화면

---

## 백엔드 담당 업무 (Firebase)

### 1. Cloud Functions 개발

#### 1.1 룸 관리 함수
- [x] `createRoom` - 룸 생성 (완료)
- [ ] `joinRoom` - 플레이어 룸 참가
- [ ] `leaveRoom` - 플레이어 룸 퇴장
- [ ] `updateRoomSettings` - 호스트 전용 룸 설정 변경 (setCount, rerollLimit)

#### 1.2 게임 진행 함수
- [ ] `startGame` - 게임 시작 (대기실 → 증강 선택 단계 전환)
- [ ] `selectRunStyle` - 플레이어 주행 습성 선택 처리
- [ ] `generateAugments` - 세트별 증강 카드 생성 (모든 플레이어에게 동일 레어도 조합 제공)
- [ ] `selectAugment` - 플레이어 증강 선택 처리
- [ ] `rerollAugments` - 증강 새로고침 처리 (리롤 횟수 차감)
- [ ] `startRace` - 레이스 시작 (증강 선택 완료 → 레이스 진행 단계 전환)
- [ ] `simulateRace` - 레이스 시뮬레이션 실행 및 결과 계산
- [ ] `nextSet` - 다음 세트 진행 (세트 결과 → 증강 선택 단계)
- [ ] `finishGame` - 게임 종료 처리

#### 1.3 데이터 검증 및 보안
- [ ] 모든 함수에 Zod 스키마를 통한 입력 검증
- [ ] 호스트 권한 검증 로직
- [ ] 플레이어 수 제한 검증 (최대 8명)
- [ ] 게임 상태 전환 검증 (잘못된 상태 전환 방지)

### 2. Firestore 데이터 모델 설계 및 구현

#### 2.1 문서 구조 정의
```typescript
// rooms/{roomId}
interface Room {
  hostId: string
  title: string
  setCount: number
  rerollLimit: number
  status: 'waiting' | 'runStyleSelection' | 'augmentSelection' | 'racing' | 'setResult' | 'finished'
  currentSet: number
  createdAt: Timestamp
  startedAt?: Timestamp
  finishedAt?: Timestamp
}

// rooms/{roomId}/players/{playerId}
interface Player {
  name: string
  avatar?: string
  isHost: boolean
  isReady: boolean
  joinedAt: Timestamp
  selectedRunStyle?: RunStyleId
  selectedAugments: AugmentDefinition[] // 세트별로 누적
  rerollUsed: number // 전체 세트에 걸쳐 누적
  raceResults: RaceResult[] // 세트별 결과
}

// rooms/{roomId}/sets/{setId}
interface Set {
  setId: string // "set-1", "set-2", ...
  availableAugments: AugmentDefinition[] // 모든 플레이어에게 동일하게 제공
  selections: Record<string, string> // playerId → augmentId
  raceResult?: RaceResult
  startedAt: Timestamp
  finishedAt?: Timestamp
}

// rooms/{roomId}/race/{raceId} (선택사항)
interface Race {
  setIndex: number
  players: PlayerRaceData[]
  startedAt: Timestamp
  finishedAt?: Timestamp
  result?: RaceResult
}
```

#### 2.2 인덱스 설정
- [ ] Firestore 복합 인덱스 정의 (`firestore.indexes.json`)
- [ ] 쿼리 성능 최적화를 위한 인덱스 추가

### 3. Firestore 보안 규칙 작성

- [ ] 읽기 권한 규칙 (플레이어는 자신이 참가한 룸만 읽기 가능)
- [ ] 쓰기 권한 규칙 (Cloud Functions만 쓰기 가능, 클라이언트는 읽기 전용)
- [ ] 호스트 권한 검증 (필요 시)
- [ ] 데이터 무결성 검증

### 4. 레이스 시뮬레이션 로직

- [ ] 능력치 계산 로직 (증강 효과 적용)
- [ ] 컨디션 보정 공식 구현
- [ ] 주행 습성별 작전 성공률 계산
- [ ] 지구력 회복 로직
- [ ] 레이스 진행 tick 단위 시뮬레이션
- [ ] 최종 순위 및 기록 계산

**참고 문서**: `docs/ability-and-augment-design.md`, `docs/phaser-race-simulation-guide.md`

### 5. 증강 시스템 로직

- [ ] 증강 카드 데이터 정의 (레어도별 확률, 효과)
- [ ] 증강 카드 생성 로직 (세트별 동일 레어도 조합 보장)
- [ ] 증강 효과 적용 로직 (능력치 계산 시)

**참고 문서**: `docs/ability-and-augment-design.md`

---

## 프론트엔드 담당 업무 (React)

### 1. Firestore 실시간 동기화 구현

- [ ] Zustand 스토어 생성 (`stores/roomStore.ts`, `stores/gameStore.ts`)
- [ ] Firestore 실시간 리스너 설정 (onSnapshot)
- [ ] 룸 상태 구독 및 UI 업데이트
- [ ] 플레이어 리스트 실시간 동기화
- [ ] 게임 상태 전환 감지 및 화면 전환

### 2. 룸 생성 및 참가 기능

- [ ] 랜딩 페이지에서 `createRoom` 호출
- [ ] 초대 URL 생성 및 클립보드 복사 기능 (이미 UI 완료, 연동 필요)
- [ ] URL 파라미터로 룸 참가 기능 (`/lobby/:roomId`)
- [ ] `joinRoom` 함수 호출 및 플레이어 등록

### 3. 대기실 페이지 Firestore 연동

- [ ] 하드코딩된 데이터를 Firestore 실시간 데이터로 교체
- [ ] 플레이어 준비 상태 토글 기능
- [ ] 호스트 전용 "게임 시작" 버튼 활성화
- [ ] 플레이어 이름 편집 기능 (Firestore 업데이트)

### 4. 주행 습성 선택 화면

- [ ] 주행 습성 선택 페이지 구현 (`/run-style-selection`)
- [ ] 3가지 랜덤 습성 제시 UI
- [ ] 선택 확정 버튼 및 `selectRunStyle` 호출
- [ ] 모든 플레이어 선택 완료 대기 상태 표시

### 5. 증강 선택 화면

- [ ] 증강 선택 페이지 구현 (`/augment-selection`)
- [ ] 증강 카드 UI 컴포넌트 (레어도별 스타일링)
- [ ] 3장 증강 카드 표시
- [ ] 카드 선택 및 선택 상태 표시
- [ ] 새로고침 버튼 및 남은 횟수 표시
- [ ] `selectAugment`, `rerollAugments` 함수 호출
- [ ] 다른 플레이어 진행 상황 표시 ("x명의 플레이어가 증강 선택 중입니다")

### 6. 레이스 화면

- [ ] Phaser 3 씬 초기화 및 설정
- [ ] 트랙 및 말 아이콘 렌더링
- [ ] 실시간 순위 및 진행률 표시
- [ ] 레이스 결과 수신 및 애니메이션
- [ ] 스킵 버튼 구현 (세트 스킵)

**참고 문서**: `docs/phaser-race-simulation-guide.md`

### 7. 세트 결과 화면

- [ ] 세트 결과 페이지 구현 (`/set-result`)
- [ ] 순위 카드 UI
- [ ] 기록 표시
- [ ] 다음 세트 진행 버튼

### 8. 최종 결과 화면

- [ ] 최종 결과 페이지 구현 (`/final-result`)
- [ ] 우승 연출 애니메이션
- [ ] 최종 순위 리스트
- [ ] 다시 플레이 및 로비 복귀 버튼
- [ ] 결과 공유 버튼

### 9. 상태 관리 및 라우팅

- [ ] React Router 라우트 설정
- [ ] Zustand 스토어 구조 설계
- [ ] 게임 상태에 따른 화면 전환 로직
- [ ] 에러 처리 및 로딩 상태 관리

### 10. UI/UX 개선

- [ ] Framer Motion 애니메이션 적용
- [ ] 로딩 스피너 및 스켈레톤 UI
- [ ] 에러 메시지 표시
- [ ] 반응형 디자인 최적화

---

## 공동 작업 영역

### 1. 데이터 인터페이스 정의

**공유 TypeScript 타입 정의 파일 생성 필요**: `shared/types.ts` 또는 각 프로젝트에 동일한 타입 정의

```typescript
// 예시: 공유 타입 정의
export type RunStyleId = 'paceSetter' | 'frontRunner' | 'stalker' | 'closer' | 'midRunner'
export type RoomStatus = 'waiting' | 'runStyleSelection' | 'augmentSelection' | 'racing' | 'setResult' | 'finished'
export type AugmentRarity = 'common' | 'rare' | 'epic'
export type AugmentCategory = 'speed' | 'stamina' | 'runStyle' | 'condition' | 'jockey'

export interface AugmentDefinition {
  id: string
  name: Record<string, string> // locale key
  description: Record<string, string>
  category: AugmentCategory
  rarity: AugmentRarity
  effects: AugmentEffect[]
}

export interface RaceResult {
  setIndex: number
  rankings: PlayerRanking[]
  records: Record<string, number> // playerId → 기록(초)
}
```

**책임**: 백엔드가 초안 작성, 프론트엔드가 검토 및 수정 요청

### 2. API 인터페이스 정의

**Cloud Functions 호출 시 데이터 형식 명확화**

- [ ] 각 함수의 입력/출력 스키마 문서화
- [ ] 에러 응답 형식 통일
- [ ] 함수명 및 파라미터 네이밍 컨벤션 합의

### 3. 게임 상태 전환 플로우

**상태 전환 시점 및 조건 명확화**

```
waiting → runStyleSelection: 호스트가 "게임 시작" 클릭, 모든 플레이어 ready
runStyleSelection → augmentSelection: 모든 플레이어가 주행 습성 선택 완료
augmentSelection → racing: 모든 플레이어가 증강 선택 완료
racing → setResult: 레이스 시뮬레이션 완료
setResult → augmentSelection: 다음 세트 진행 (currentSet < setCount)
setResult → finished: 마지막 세트 완료 (currentSet === setCount)
```

**책임**: 백엔드가 상태 전환 로직 구현, 프론트엔드가 UI 반영

### 4. 테스트 및 디버깅

- [ ] Firebase Emulator Suite를 활용한 통합 테스트
- [ ] 로컬 환경에서 실시간 동기화 테스트
- [ ] 에러 케이스 시나리오 테스트

---

## 진행 상황 체크리스트

### Phase 1: 기본 인프라 및 룸 관리 (1-2주차)
- [ ] 백엔드: `joinRoom`, `leaveRoom`, `updateRoomSettings` 함수 구현
- [ ] 백엔드: Firestore 보안 규칙 완성
- [ ] 프론트엔드: Firestore 실시간 동기화 구현
- [ ] 프론트엔드: 대기실 페이지 Firestore 연동
- [ ] 프론트엔드: 룸 생성 및 참가 기능 완성

### Phase 2: 주행 습성 및 증강 선택 (3주차)
- [ ] 백엔드: `selectRunStyle`, `generateAugments`, `selectAugment`, `rerollAugments` 함수 구현
- [ ] 백엔드: 증강 카드 데이터 정의 및 생성 로직
- [ ] 프론트엔드: 주행 습성 선택 화면 구현
- [ ] 프론트엔드: 증강 선택 화면 구현

### Phase 3: 레이스 시뮬레이션 (4주차)
- [ ] 백엔드: 레이스 시뮬레이션 로직 구현
- [ ] 백엔드: `simulateRace`, `startRace` 함수 구현
- [ ] 프론트엔드: Phaser 3 레이스 씬 구현
- [ ] 프론트엔드: 실시간 레이스 진행 상황 표시

### Phase 4: 결과 화면 및 게임 완성 (5주차)
- [ ] 백엔드: `nextSet`, `finishGame` 함수 구현
- [ ] 프론트엔드: 세트 결과 화면 구현
- [ ] 프론트엔드: 최종 결과 화면 구현
- [ ] 프론트엔드: 애니메이션 및 UX 개선

### Phase 5: 배포 및 QA (6주차)
- [ ] 통합 테스트
- [ ] 성능 최적화
- [ ] 배포 준비
- [ ] 버그 수정 및 피드백 반영

---

## 협업 가이드라인

### 1. 커뮤니케이션

- **주간 미팅**: 매주 진행 상황 공유 및 이슈 논의
- **이슈 트래커**: GitHub Issues를 활용한 작업 관리
- **문서 업데이트**: 중요한 결정사항은 이 문서 또는 관련 문서에 반영

### 2. 코드 리뷰

- **Pull Request 필수**: 모든 변경사항은 PR을 통해 리뷰
- **리뷰 기준**: 기능 동작, 코드 품질, 타입 안정성, 보안

### 3. 브랜치 전략

- `main`: 프로덕션 배포용 (안정적인 버전만)
- `develop`: 개발 통합 브랜치
- `feature/*`: 기능 개발 브랜치
- `fix/*`: 버그 수정 브랜치

### 4. 데이터 구조 변경 시

1. 백엔드가 Firestore 문서 구조 변경 제안
2. 프론트엔드와 논의 및 합의
3. 양쪽 모두 타입 정의 업데이트
4. 마이그레이션 스크립트 필요 시 작성

### 5. 함수 추가/변경 시

1. 백엔드가 함수 스펙 문서화 (입력/출력, 에러 케이스)
2. 프론트엔드가 호출 코드 작성 전 스펙 확인
3. 테스트 후 통합

### 6. 환경 변수 및 설정

- **프론트엔드**: `.env` 파일 사용 (Git에 커밋하지 않음)
- **백엔드**: `firebase functions:config:set` 사용
- **공유 설정**: `README.md`에 문서화

---

## 기술 스택 요약

### 백엔드
- Firebase Cloud Functions (TypeScript)
- Firebase Admin SDK
- Firestore
- Zod (데이터 검증)

### 프론트엔드
- React 19 + Vite + TypeScript
- Tailwind CSS
- Zustand (상태 관리)
- React Router
- Phaser 3 (게임 렌더링)
- Framer Motion (애니메이션)
- Firebase Client SDK
- i18next (다국어)

---

## 참고 문서

- [README.md](../README.md) - 프로젝트 개요 및 초기 세팅
- [ability-and-augment-design.md](./ability-and-augment-design.md) - 능력치 및 증강 시스템 설계
- [phaser-race-simulation-guide.md](./phaser-race-simulation-guide.md) - 레이스 시뮬레이션 가이드

---

## 업데이트 이력

- 2024-XX-XX: 초안 작성

