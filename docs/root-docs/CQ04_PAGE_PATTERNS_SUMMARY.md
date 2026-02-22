# CQ-04 Page Refactor Pattern Summary

작성일: 2026-02-22  
대상: `LandingPage`, `LobbyPage`, `HorseSelectionPage`  
목적: 페이지 컴포넌트에서 UI / 상태 전환 / 서버 호출 로직이 섞이는 문제를 줄이기 위해, 이번 리팩터링에서 정리한 공통 패턴을 문서화한다.

## 1. 왜 이 문서가 필요한가

이 프로젝트는 기능을 빠르게 붙이며 성장했기 때문에, 페이지 파일 안에 아래가 섞이기 쉬웠다.

- 렌더링(UI)
- 서버 호출(callable)
- 페이지 이동(라우팅)
- 실패 처리(에러 메시지)
- 테스트용(mock) fallback

이 문서는 "주니어 포트폴리오 기준"으로 페이지 코드를 어떻게 정리했는지 설명하기 위한 요약이다.

## 2. 이번 CQ-04에서 적용한 공통 패턴

### 패턴 A: `effect`는 "언제 실행할지"만 남기고, 절차는 helper로 분리

적용 예시:
- `frontend/src/pages/LobbyPage.tsx`
  - 자동 참가 effect (`joinRoom`) 분리
  - `shouldAutoJoinRoom()`
  - `runAutoJoinRoom()`
  - `handleAutoJoinRoomFailure(...)`

- `frontend/src/pages/HorseSelectionPage.tsx`
  - `room.status` 기반 라우팅 분리
  - `navigateWithRoomAndPlayer(...)`
  - `handleRoomStatusRedirect(...)`

효과:
- effect를 읽을 때 "조건 -> 실행 -> 정리" 흐름이 먼저 보인다.
- 실제 로직 수정 지점(helper)이 분리되어 디버깅이 쉬워진다.

### 패턴 B: 반복되는 실패 처리 패턴은 최소 helper로 통일

적용 예시:
- `frontend/src/pages/LobbyPage.tsx`
  - `reportLobbyActionError(logMessage, error, messageKey)`

대상 핸들러:
- 준비 토글
- 게임 시작
- 닉네임 저장

효과:
- `console.error + setErrorMessage(...)` 반복 제거
- 액션 핸들러가 "검증 / 호출 / 상태 변경"에 집중됨

주의점:
- 과도한 공통화는 하지 않음 (모든 액션을 하나의 실행기로 감싸지 않음)
- 주니어 포트폴리오 관점에서 읽기 쉬운 수준만 공통화

### 패턴 C: mock/realtime 분기는 이름 붙여서 드러내기

적용 예시:
- `frontend/src/pages/LobbyPage.tsx`
  - `lobbyDataMode`
  - `isRealtimeLobbyMode`
  - `isPlayerCurrentUser(...)`

효과:
- JSX 내부 삼항 분기 중첩 감소
- 현재 페이지가 어떤 모드(mock/realtime)로 동작하는지 변수명만 보고 파악 가능

## 3. `HorseSelectionPage`에서 정리한 핵심 패턴

### 패턴 D: 큰 액션 핸들러를 단계별 helper로 분리

적용 예시:
- `frontend/src/pages/HorseSelectionPage.tsx` `handleConfirm`

분리된 단계:
1. `getHorseConfirmValidationError()`
2. `buildSavedHorseData(...)`
3. `trySubmitHorseSelectionRealtime(...)`
4. `saveHorseSelectionToLocalFallback(...)`

효과:
- 흐름이 `검증 -> 데이터 생성 -> 서버 시도 -> fallback -> 상태 반영` 순서로 읽힘
- 서버 연동 정책 변경과 로컬 테스트 fallback 수정이 분리됨

추가 메모:
- helper 분리 후 TypeScript 좁히기 문제가 생기면 `confirmParams` 같은 로컬 확정 객체로 해결
- 이 방식은 주니어 개발자가 의도를 명시적으로 보여주기 좋다

## 4. 이번 CQ-04의 성과 (포트폴리오 관점)

좋아진 점:
- 페이지가 여전히 하나의 파일이지만, "무엇을 하는지"가 함수명으로 설명된다.
- 리팩터링이 기능 변경 없이 진행되어 회귀 원인 추적이 쉽다.
- mock/realtime 공존 구조를 유지하면서도 분기 의도가 드러난다.

아직 남은 점:
- `LobbyPage`, `HorseSelectionPage`는 여전히 파일 크기가 큼
- hook 추출/유틸 추출은 가능하지만, 과추상화 없이 단계적으로 진행해야 함

## 5. 다음 단계 가이드 (CQ-05 이전)

1. 페이지 리팩터링은 "한 번에 한 흐름"만 정리한다.
- 예: 자동 참가, leave lifecycle, 말 선택 확정 등

2. 구조 변경 후에는 최소 빌드 검증을 바로 실행한다.
- `npm run build --prefix frontend`

3. 문서에 문제/해결/검증을 남긴다.
- `PLAN_CODE_QUALITY_REFACTOR.md`
- 이 문서(`CQ04_PAGE_PATTERNS_SUMMARY.md`)

## 6. 파일 참조

- `frontend/src/pages/LobbyPage.tsx`
- `frontend/src/pages/HorseSelectionPage.tsx`
- `PLAN_CODE_QUALITY_REFACTOR.md`
- `JUNIOR_CHANGE_WORKFLOW.md`
