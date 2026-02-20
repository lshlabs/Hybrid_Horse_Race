# Hybrid Horse Race

Phaser 3 레이스 + 증강 선택 흐름을 가진 React/Vite 기반 웹 게임 프로젝트입니다.

## 현재 상태 (2026-02 기준)
- `frontend/src/pages`의 메인 페이지(`Landing/Lobby/HorseSelection/Race/RaceResult`)는 현재 **로컬 스토리지 기반 테스트 플로우**를 중심으로 동작합니다.
- `frontend/src/pages/dev/*Test.tsx` 테스트 페이지도 함께 유지되고 있으며, DEV 모드에서 별도 경로로 접근 가능합니다.
- 게임 캔버스는 `frontend/src/components/game/PhaserGame.tsx` + `RaceScene` 계열 씬에서 구동됩니다.
- Firebase 함수/훅(`useRoom`, `firebase-functions`) 코드는 저장소에 존재하지만, 현재 페이지 흐름은 mock/localStorage 시나리오를 우선 사용합니다.

## 실행 방법

### 1) 의존성 설치
```bash
npm install
npm install --prefix frontend
npm install --prefix functions
```

### 2) 프런트 개발 서버
```bash
npm run dev
```

### 3) 주요 스크립트
```bash
npm run lint
npm run format
npm run test
npm run build
npm run emulators
```

## 라우팅

### 메인 페이지
- `/` : 랜딩
- `/lobby` : 로비
- `/horse-selection` : 말 선택
- `/race` : 레이스(Phaser)
- `/race-result` : 최종 결과

### DEV 전용 테스트 페이지
- `/landing-test`
- `/lobby-test`
- `/horse-selection-test`
- `/race-test`
- `/race-result-test`

## 페이지 간 데이터 전달 방식 (현재)
메인/테스트 페이지 모두 아래 localStorage 키를 사용해 상태를 넘깁니다.
- `dev_room_config`
- `dev_player_id`
- `dev_player_ids`
- `dev_selected_horses`
- `dev_player_nickname_data`
- `dev_player_custom_names`

## 기술 스택
- Frontend: React 19, Vite 7, TypeScript, Tailwind CSS
- UI: Radix UI 기반 컴포넌트 + 커스텀 UI (`src/components/ui`)
- Game: Phaser 3
- i18n: i18next
- Charts: Recharts
- Backend(보유): Firebase Functions/Firestore

## 게임 코드 위치
- `frontend/src/components/game/`
  - `PhaserGame.tsx`: React-Phaser 브리지
  - `scenes/race/RaceScene.ts`: 레이스 메인 씬
  - `scenes/augment/AugmentSelectionScene.ts`: 증강 선택 씬
  - `scenes/result/RaceResultScene.ts`: 세트 결과 씬
  - `managers/*`: HUD/말/카메라/진행바 등 매니저

## 프로젝트 구조
```text
Hybrid_Horse_Race/
├─ frontend/
│  ├─ src/
│  │  ├─ pages/
│  │  │  ├─ *.tsx
│  │  │  └─ dev/*Test.tsx
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ lib/
│  │  └─ engine/
├─ functions/
├─ firebase.json
├─ firestore.rules
└─ package.json
```

## 참고
- 현재 구현은 테스트/로컬 검증 흐름이 강하게 반영되어 있습니다.
- 운영 배포 기준으로 전환하려면 pages 레벨에서 localStorage 의존도를 줄이고 Firebase 실연동 플로우를 다시 정리하는 작업이 필요합니다.
