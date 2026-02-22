# CQ-05 Race Tuning Log Guide (Measurement First)

작성일: 2026-02-22  
대상: `frontend/src/components/game/scenes/race/RaceScene.ts` 권위 재생(DEV 계측 오버레이)  
목적: RaceScene 튜닝을 감각이 아니라 측정값 기반으로 기록/설명하기 위한 가이드

## 1. 왜 필요한가

현재 레이스 연출 튜닝은 체감 품질(끊김, 순간이동, 슬로모 체감)과 동기화 안정성(결과/순위 일치)을 동시에 봐야 한다.

문제는 다음과 같다.
- 체감만으로 튜닝하면 변경 이유를 설명하기 어렵다.
- 숫자만 보면 실제 플레이 체감을 놓칠 수 있다.

따라서 이 문서는 "수치 + 관찰 메모"를 함께 남기는 기준을 정의한다.

## 2. 측정 대상 (현재 DEV 오버레이 기준)

`RaceScene` DEV 오버레이에 표시되는 주요 값:

1. `hardSnap`
- 위치 오차가 임계치 이상이라 즉시 스냅한 횟수
- 많을수록 순간이동 체감 가능성이 큼

2. `soft`
- 일반 오차를 소프트 보정으로 처리한 횟수
- 수치 자체보다 `hardSnap`과의 비율로 보는 것이 중요

3. `timeSnap`
- 렌더 시간축이 권위 시간축으로 하드 스냅된 횟수
- 탭 복귀/지연 구간에서 증가 가능

4. `posErrMean`
- 프레임별 위치 오차 평균 (m)
- 전체 구간 평균 안정성 지표

5. `posErrMax`
- 관측된 최대 위치 오차 (m)
- 순간이동/좌우 튐 체감과 상관이 큼

보조 해석값 (오버레이 가독성 개선 후 추가 확인):

6. `frames`
- 현재 레이스에서 계측이 누적된 프레임 수
- 짧은 샘플/긴 샘플 비교 시 참고용

7. `samples`
- 위치 오차 평균 계산에 포함된 보정 샘플 수 (`soft + hard`)
- `posErrMean` 해석 시 표본 크기 확인용

## 3. 튜닝 대상 상수 (현재 코드 기준)

`RaceScene.ts`의 권위 재생 관련 주요 상수:

- `AUTHORITATIVE_RENDER_DELAY_MS`
- `AUTHORITATIVE_TIME_SOFT_CORRECTION_ALPHA`
- `AUTHORITATIVE_TIME_HARD_SNAP_MS`
- `AUTHORITATIVE_POSITION_HARD_SNAP_M`
- `AUTHORITATIVE_POSITION_SOFT_BLEND`
- `AUTHORITATIVE_DRIFT_CORRECTION_NORMAL`
- `AUTHORITATIVE_DRIFT_CORRECTION_SLOWMO`

원칙:
- 한 번에 1~2개만 변경
- 변경 전/후를 같은 시나리오로 비교
- 결과가 나빠지면 즉시 되돌릴 수 있게 기록

## 4. 기록 포맷 (권장 템플릿)

작업 ID:
- 예) `CQ05-TUNE-01`

목표:
- 예) `11~90 구간 계단감 감소, 순위/기록 일치 유지`

변경한 상수:
- `AUTHORITATIVE_POSITION_SOFT_BLEND: 0.28 -> 0.32`
- `AUTHORITATIVE_POSITION_HARD_SNAP_M: 2.5 -> 2.8`

테스트 시나리오:
- 2클라 동시 주행, 2라운드
- 슬로모 포함 구간 확인
- 동일 룸/동일 빌드 기준

관측값 (전):
- `frames=...`, `samples=...`
- `hardSnap=...`
- `timeSnap=...`
- `posErrMean=...m`
- `posErrMax=...m`

관측값 (후):
- `frames=...`, `samples=...`
- `hardSnap=...`
- `timeSnap=...`
- `posErrMean=...m`
- `posErrMax=...m`

체감 메모:
- 예) `초반 부드러움 개선`, `중후반 1번 말 좌우 튐 감소`, `슬로모 종료 복귀 자연스러움 유지`

판정:
- `채택` / `보류` / `롤백`

이유:
- 수치 + 체감 기준으로 2~4줄

## 5. 판정 기준 (초안)

이 값들은 절대 규칙이 아니라 "튜닝 판단 보조 기준"이다.

1. 동기화 무결성 우선
- 기록/순위 불일치가 생기면 즉시 롤백 후보

2. `hardSnap` 급증은 경고 신호
- `posErrMean`이 조금 좋아져도 `hardSnap`이 크게 늘면 체감이 나빠질 수 있음

3. `posErrMax`는 체감 버그 탐지용
- 평균보다 최대값이 더 중요할 수 있음 (순간이동/튀는 말)

4. 슬로모 구간은 별도 메모 필수
- 평상시 수치가 좋아도 슬로모 체감이 나빠질 수 있음

## 6. 실행 절차 (주니어 포트폴리오용)

1. 문제를 문장으로 적는다
- 예) `중후반 구간에서 특정 말이 좌우로 순간이동처럼 보인다`

2. 변경 상수를 1~2개로 제한한다
- 많은 상수를 동시에 바꾸지 않기

3. 동일 시나리오로 비교 측정한다
- 같은 룸 조건 / 비슷한 테스트 방식 유지

4. 결과를 문서화한다
- 수치 + 체감 + 채택/롤백 이유 기록

5. 필요하면 코드 주석도 업데이트한다
- 왜 이 값으로 유지하는지 남기기

## 7. 파일 참조

- `frontend/src/components/game/scenes/race/RaceScene.ts`
- `PLAN_CODE_QUALITY_REFACTOR.md`
- `JUNIOR_CHANGE_WORKFLOW.md`

## 8. 다음 실행 항목 (CQ05-TUNE-01 준비)

1. 2클라 수동 테스트 1회 수행 (동일 룸, 1~2라운드)
2. DEV 오버레이 수치 기록
- `hardSnap`, `soft`, `timeSnap`, `posErrMean`, `posErrMax`, `frames`, `samples`
3. 체감 메모(초반/중반/슬로모 구간)와 함께 `CQ05-TUNE-01` 항목 작성
