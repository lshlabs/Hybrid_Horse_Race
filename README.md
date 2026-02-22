# Hybrid Horse Race

Phaser 3 기반 레이스 게임을 React/Vite + Firebase(Firestore/Functions)로 멀티플레이 동기화한 프로젝트입니다.

## 개요

이 프로젝트는 Firebase callable + Firestore realtime 구독을 사용해서 멀티플레이 레이스 흐름을 구성합니다.
레이스 결과는 서버에서 먼저 계산하고(`authoritative`), 클라이언트는 서버가 준비한 키프레임/이벤트 타임라인을 재생합니다.

메인 플레이 흐름:
- 랜딩 → 로비 → 말 선택 → 증강 선택 → 레이스 → 결과 → 다음 라운드/최종 결과

핵심 특징:
- 서버 권위 레이스 시뮬레이션 (`shared/race-core`)
- 클라이언트 authoritative replay 렌더링 (`RaceScene`)
- Firestore realtime room/player 상태 동기화 (`useRoom`)
- Firebase callable 기반 상태 전이/검증/도메인 로직 (`functions/src/domains/*`)

## 배포 상태

배포 완료:
- `staging`: `https://hybrid-horse-race-staging.web.app`
- `prod`: `https://hybrid-horse-race-prod.web.app`

Firebase 프로젝트 alias:
- `staging`: `hybrid-horse-race-staging`
- `prod`: `hybrid-horse-race-prod`

## 빠른 시작

### 1) 설치

```bash
nvm use || nvm install
npm install
npm install --prefix frontend
npm install --prefix functions
```

### 2) Firebase 에뮬레이터 실행

```bash
npm run emulators
```

### 3) 프론트 개발 서버 실행

```bash
npm run dev
```

## 주요 스크립트

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run emulators
npm run predeploy:verify:staging
npm run predeploy:verify:prod
npm run deploy:staging
npm run deploy:prod
npm run contract:check
npm run doctor:runtime
```

## 배포 파이프라인

현재는 `staging -> prod` 순서의 수동 배포 파이프라인을 사용합니다.

1. 사전 검증
   - `npm run predeploy:verify:staging` / `npm run predeploy:verify:prod`
   - 내부적으로 `functions build`, `frontend build`, `frontend test`, `contract:check` 등을 실행합니다.
2. Staging 배포
   - `npm run deploy:staging`
3. Staging 스모크 테스트
   - 방 생성/입장/말 선택/증강 선택/레이스/결과/다음 라운드
4. Production 배포
   - `npm run deploy:prod`
5. Production 스모크 테스트
   - 핵심 경로(방 생성/입장/레이스 1세트)를 우선 확인합니다.

관련 문서:
- `DEPLOYMENT_RUNBOOK.md`
- `DEPLOYMENT_RELEASE_LOG.md`

## 아키텍처 요약

주요 코드 위치:
- `frontend/src/hooks/useRoom.ts`: room/players Firestore realtime 구독
- `frontend/src/lib/firebase-functions.ts`: Firebase callable 클라이언트 래퍼
- `functions/src/index.ts`: Functions 엔트리 wiring/export
- `functions/src/domains/*`: 서버 도메인별 callable 구현 (room/selection/race/result)
- `functions/src/common/*`: request guard / auth helper / response builder 등 공통 로직
- `shared/race-core/*`: 서버/클라이언트 공용 레이스 계산 코어
- `frontend/src/components/game/scenes/race/RaceScene.ts`: 레이스 재생 오케스트레이터
- `frontend/src/components/game/scenes/race/helpers/*`: authoritative sync/debug/result recovery/augment wait 보조 로직

## 레이스 파이프라인 (Authoritative Replay)

현재 레이스는 서버가 결과를 먼저 계산하고, 클라이언트가 이를 재생하는 구조입니다.

1. `prepareRace`
   - host가 세트 레이스를 서버에서 미리 계산합니다.
   - 서버는 `keyframes`, `events`, `rankings`, `raceResult`를 만들고 `prepared` 상태로 저장합니다.
2. `getRaceState` polling
   - 클라이언트는 `prepared` 상태에서도 키프레임을 먼저 받아 버퍼링합니다.
3. `startRace`
   - `3,2,1,GO` 직후 host가 호출합니다.
   - 서버가 `startedAt`을 확정하고 `running` 상태로 전환합니다.
4. 클라이언트 재생
   - `startedAtMillis` 이후 서버 시간축 기준으로 재생합니다.
   - 키프레임 보간 + 이벤트 처리 + HUD/순위 갱신을 수행합니다.
5. 결과/다음 라운드
   - `getSetResult`, `readyNextSet`, `submitFinalRaceResult`로 흐름을 이어갑니다.

`getRaceState` 상태:
- `prepared`
- `running`
- `completed`

## 스탯 시스템

레이스에서 사용하는 기본 스탯은 6종입니다.

- `Speed`: 최고 속도/전반적인 속도 구간에 영향
- `Stamina`: 체력 소모량과 지속력에 영향
- `Power`: 가속 성능과 속도 회복 구간에 영향
- `Guts`: 후반 감속 하한(버티는 힘)에 영향
- `Start`: 출발 반응/초반 가속 보정에 영향
- `Luck`: 컨디션 롤 및 일부 보너스 계산에 영향

주요 위치:
- 공용 스탯 계산: `shared/race-core/stat-system-core.ts`
- 프론트 엔진 스탯 계산: `frontend/src/engine/race/stat-system.ts`
- 말 시뮬레이션 코어: `shared/race-core/horse-core.ts`
- 프론트 말 구현: `frontend/src/engine/race/horse.ts`

## 증강 시스템

증강은 세트마다 선택하며, 서버에서 seed 기반으로 생성/확정합니다.

증강 특징:
- 희귀도: `common`, `rare`, `epic`, `legendary` (+ 특수 `hidden`)
- 효과 유형:
  - 스탯 증가형 (`statType`, `statValue`)
  - 특수 능력형 (`lastSpurt`, `overtake`, `escapeCrisis`)

증강 선택 흐름:
1. `getAugmentSelection`
   - 세트 문서에 선택지가 없으면 서버가 생성합니다.
2. `selectAugment`
   - 플레이어가 증강을 확정합니다.
   - 전원 선택 완료 시 최종 스탯 계산 후 `racing` 단계로 전환합니다.
3. `rerollAugments`
   - 개인/방 리롤 횟수를 차감하고 선택지를 다시 생성합니다.
   - seed + `rerollIndex`를 사용해 재생성 결과를 안정적으로 관리합니다.

주요 위치:
- 서버 선택 로직: `functions/src/domains/selection.ts`
- 프론트 증강 데이터/생성 유틸: `frontend/src/engine/race/augments.ts`
- 공용 코어/타입: `shared/race-core/*`

## 트랙 길이/거리 기준

현재 레이스 트랙 길이는 프론트/백엔드 기준을 맞춰서 운영합니다.

- 프론트 시각 트랙: `raceTiles = 100` 기준 (`TileMapManager`)
- 프론트 계산 기준 길이: `505m`
- 서버 authoritative 시뮬레이션 길이: `505m`

트랙 길이 관련 값을 변경할 때는 프론트 렌더링 길이와 서버 시뮬레이션 길이를 함께 맞춰야 합니다.

## 라우팅

### 메인 경로
- `/`
- `/lobby`
- `/horse-selection`
- `/race`
- `/race-result`

### DEV 테스트 페이지
- `/landing-test`
- `/lobby-test`
- `/horse-selection-test`
- `/race-test`
- `/race-result-test`

## 환경 변수

`frontend/.env.example`를 참고하세요.

핵심 변수:
- `VITE_USE_FIREBASE_EMULATOR`
- `VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST`
- `VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT`
- `VITE_FIREBASE_FIRESTORE_EMULATOR_HOST`
- `VITE_FIREBASE_FIRESTORE_EMULATOR_PORT`
- `VITE_ENABLE_MOCK_ROOM_FALLBACK`

운영 주의사항:
- `VITE_ENABLE_MOCK_ROOM_FALLBACK`는 운영 경로에서 사용하지 않습니다.
- `staging` / `prod`는 각 Firebase 프로젝트 설정값을 분리해서 사용합니다.

## 검증 기준

기본 검증:
1. `npm run build --prefix functions`
2. `npm run build --prefix frontend`
3. `npm run test --prefix frontend -- --run`
4. `npm run contract:check`
5. `npm run doctor:runtime`

추가 정합성 검증(권장):
- `npm run test --prefix frontend -- --run src/engine/race/horse-shared-core.golden.test.ts`

## 런타임 권장사항

- Functions 런타임 기준은 `nodejs22`입니다 (`firebase.json`).
- 로컬 Node 버전이 다르면 에뮬레이터에서 경고가 날 수 있습니다.
- 루트 `.nvmrc`는 `22`입니다.

## 코드 읽기 순서

1. `frontend/src/pages/*`
2. `frontend/src/hooks/useRoom.ts`, `frontend/src/lib/firebase-functions.ts`
3. `functions/src/domains/*`
4. `frontend/src/components/game/scenes/race/RaceScene.ts`
5. `shared/race-core/*`, `frontend/src/engine/race/*`

## 관련 문서

- `frontend/src/components/game/README.md`: 게임 클라이언트 구성 메모
- `docs/root-docs/PORTFOLIO_CORE_FEATURES.md`: 핵심 기능 요약
