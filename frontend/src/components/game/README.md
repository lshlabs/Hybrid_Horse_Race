# Game (Phaser)

이 폴더는 React에서 Phaser 게임을 구동하기 위한 코드만 모아둔 영역입니다.
흐름을 이해하기 쉽도록 역할별로 나눴습니다.

## 구조

- `PhaserGame.tsx`
  - React ↔ Phaser 연결 진입점
  - 게임 인스턴스 생성/파괴, 화면 스케일링 담당
- `scenes/`
  - Phaser Scene 모음
  - `race/` 레이스 진행 씬
  - `augment/` 증강 선택 씬
  - `result/` 레이스 결과 오버레이 씬
- `managers/`
  - 씬 내부 기능 분리(카메라, HUD, 말, 맵 등)
- `assets/`
  - Phaser용 에셋/유틸
  - `horses/` 말 스프라이트시트 로딩 매니페스트
  - `filters/` 렌더링 필터
  - `tilemaps/` 타일맵 로더

## 데이터 흐름 요약

React → `PhaserGame.tsx` → `RaceScene`(필요 시 다른 씬으로 확장)

## 권장 원칙

- Scene은 흐름 제어만, 화면 요소는 Manager로 분리
- 에셋 로딩은 Scene 또는 공용 LoaderScene으로 통합
