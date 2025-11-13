
# Hybrid Horse Race (가칭)

## 프로젝트 개요

**Hybrid Horse Race**는 경마 규칙에 증강 시스템을 결합한 멀티플레이어 캐주얼 웹 게임입니다.  
로그인 시스템 없이, 호스트가 생성한 초대 링크로 누구나 쉽게 접속해 함께 플레이할 수 있는 환경을 목표로 합니다.  
게임 연출보다는 UI 완성도를 최우선으로 하여 직관적이고 쾌적한 게임 경험을 제공합니다.

---

## 주요 기능

### 로비
- 플레이할 세트 수 조절 UI 제공
- 증강 새로고침 횟수 조절 UI 제공
- 호스트 전용 초대 URL 생성 및 클립보드 복사 기능

### 대기실
- 참가자 리스트, 호스트/참가자 구분, 준비 상태 실시간 표시
- 빈 슬롯 노출 및 준비 완료 버튼 활성/비활성화

### 증강 선택
- 3종의 증강 카드 랜덤 제공 및 선택 확정 버튼
- 증강 새로고침 버튼과 남은 횟수 표시

### 레이스 화면
- Phaser 3 기반 트랙과 말 아이콘을 활용한 레이스 진행 상황 시각화
- 실시간 순위 및 진행률 표시
- 레이스 설정 정보 노출
- 스킵버튼을 통해 세트 스킵 가능

### 세트 결과
- 순위, 기록 카드 제공
- 다음 세트 진행 버튼

### 최종 결과
- 우승 연출 애니메이션
- 최종 순위 리스트
- 다시 플레이 및 로비 복귀 버튼
- 결과 공유 버튼

---

## 기술 스택 및 아키텍처

### 프런트엔드
- **프레임워크**: React + Vite + TypeScript (SPA)
- **스타일링**: Tailwind CSS (커스텀 테마), `shadcn/ui` 또는 `daisyUI` 선택적 활용
- **애니메이션**: Framer Motion (버튼, 카드, 화면 전환)
- **상태 관리**: Zustand
- **게임 씬 렌더링**: Phaser 3 (레이스 캔버스)

### 백엔드 및 실시간 동기화
- **실시간 DB**: Firebase Firestore (룸 상태 및 게임 데이터 동기화)
- **서버 로직**: Firebase Cloud Functions (룸 생성, 증강 새로고침, 레이스 시뮬레이션, 세트 진행)
- **환경 변수 관리**: Firebase 환경 변수로 비밀값 안전 관리

### 배포
- 프런트엔드: GitHub Pages (`gh-pages` 브랜치)
- 백엔드: Firebase Hosting 및 Firebase CLI

### 기타
- 아이콘: Lucide, Heroicons
- 일러스트 및 애니메이션: Lottie, 커스텀 SVG
- 국제화(i18n) 필요 시: i18next

---

## Firestore 데이터 모델 예시

```
rooms/{roomId}:
  - hostId: string
  - title: string
  - setCount: number
  - rerollLimit: number
  - status: string (e.g. waiting, augmentSelection, racing, finished)
  - currentSet: number
  - createdAt: timestamp

rooms/{roomId}/players/{playerId}:
  - name: string
  - avatar: string
  - isHost: boolean
  - isReady: boolean
  - horseStats: object
  - selectedAugments: array

rooms/{roomId}/sets/{setId}:
  - availableAugments: array
  - selections: object (playerId → augment)
  - raceResult: object
  - summary: object

rooms/{roomId}/logs/{logId} (선택):
  - timestamp: timestamp
  - event: string
  - details: object
```

---

## 개발 로드맵 (예상 6주)

| 주차 | 목표 및 작업 내용                              |
|-------|----------------------------------------------|
| 1주차 | 프로젝트 초기화, Tailwind 테마 설정, Firebase 환경 구성 |
| 2주차 | 로비 및 대기실 UI 구현, 세트 수 및 새로고침 횟수 입력, 초대 URL 생성 기능 |
| 3주차 | 증강 선택 화면 UI 및 증강 새로고침 로직 구현, Firestore 연동 |
| 4주차 | Phaser 3를 활용한 레이스 씬 렌더링, Cloud Functions 레이스 시뮬레이션 구현 |
| 5주차 | 세트 결과 및 최종 결과 화면 구현, 애니메이션 적용, UX 개선 |
| 6주차 | GitHub Pages 및 Firebase 배포, QA 테스트, 피드백 반영 |

---

## 품질 관리 및 운영

- **테스트**:  
  - Vitest로 증강 및 능력치 로직 단위 테스트 작성  
  - Firebase Emulator Suite로 로컬 환경에서 기능 검증  
- **모니터링**:  
  - Firebase Crashlytics(웹 지원 시) 또는 Sentry 활용하여 오류 추적  
- **디자인 시스템**:  
  - Tailwind 커스텀 테마 (다크 톤 + 네온 하이라이트)  
  - 재사용 가능한 공통 컴포넌트 (카드, 버튼, 배지 등) 제작

---

## 리스크 및 대응 방안

| 리스크               | 대응 방안                                           |
|----------------------|----------------------------------------------------|
| 실시간 지연 및 지연감 | Firestore 문서 구조 최적화 및 플레이어 수 제한(최대 8명) |
| 게임 밸런싱 문제     | 플레이 로그 기반 증강 및 능력치 데이터 분석 후 조정    |
| UI 구현 난이도       | 초기에 디자인 토큰, 컴포넌트 팔레트 정의 및 문서화       |
| Firebase 비용 증가   | 무료 플랜 사용량 주기적 모니터링, 필요 시 플랜 업그레이드 |

---

## 향후 확장 아이디어

- React Native + Expo 기반 모바일 앱 확장
- 플레이 로그 분석 도구 및 리플레이 기능 추가
- 글로벌 다국어 지원 및 커뮤니티 기능 강화

---

## 라이선스 및 기여

본 프로젝트는 개인 또는 팀 내부 용도로 개발 중이며, 오픈소스화 계획은 추후 별도 공지 예정입니다.

---

감사합니다.
