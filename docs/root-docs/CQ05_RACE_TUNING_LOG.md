# CQ-05 Race Tuning Log

작성일: 2026-02-22  
목적: `RaceScene` 권위 재생 튜닝 결과를 측정값 + 체감 메모 기준으로 누적 기록

참고 문서:

- `CQ05_RACE_TUNING_LOG_GUIDE.md`
- `PLAN_CODE_QUALITY_REFACTOR.md`

---

## CQ05-TUNE-01 (준비됨 / 측정값 입력 대기)

상태:

- `PENDING-MANUAL-MEASUREMENT`

목표:

- 2클라 기준 레이스 중후반(특히 11~90 구간) 계단감/순간이동 체감을 줄이되,
- 기록/순위/결과 일치는 유지되는지 확인

변경한 상수:

- 이번 항목은 "기준선 측정"부터 수행
- 코드 변경 없이 현재 값 측정 후 기록

현재 기준 상수 (측정 당시 기록용):

- `AUTHORITATIVE_RENDER_DELAY_MS = 150`
- `AUTHORITATIVE_TIME_SOFT_CORRECTION_ALPHA = 0.15`
- `AUTHORITATIVE_TIME_HARD_SNAP_MS = 600`
- `AUTHORITATIVE_POSITION_HARD_SNAP_M = 2.5`
- `AUTHORITATIVE_POSITION_SOFT_BLEND = 0.28`
- `AUTHORITATIVE_DRIFT_CORRECTION_NORMAL = { gain: 0.16, min: -3, max: 14 }`
- `AUTHORITATIVE_DRIFT_CORRECTION_SLOWMO = { gain: 0.04, min: -1.5, max: 1.2 }`

테스트 시나리오:

- 동일 룸 2클라
- 1~2라운드 진행
- 슬로모 구간 포함 확인
- DEV 오버레이 표시 활성화 상태

관측값 (전 / 기준선):

- 클라 A: `frames=`, `samples=`
- 클라 A: `hardSnap=`, `soft=`, `timeSnap=`
- 클라 A: `posErrMean= m`, `posErrMax= m`
- 클라 B: `frames=`, `samples=`
- 클라 B: `hardSnap=`, `soft=`, `timeSnap=`
- 클라 B: `posErrMean= m`, `posErrMax= m`

관측값 (후):

- (상수 변경 후 작성)

체감 메모:

- 초반(0~10): 
- 중반(11~90):
- 종반/슬로모:
- 특정 말만 튀는지 여부:

동기화 결과 체크:

- 순위 일치: `Y/N`
- 기록 일치: `Y/N`
- 라운드 전환 정상: `Y/N`

판정:

- `대기중`

이유:

- 2클라 수동 측정값 입력 후 결정

다음 액션:

1. 사용자 수동 테스트로 오버레이 값 기록
2. 기준선 결과 입력
3. 필요 시 `CQ05-TUNE-02`로 상수 1~2개만 조정 후 비교

