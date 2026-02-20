# 왜 m(미터)과 px(픽셀)을 둘 다 쓰는가

코드에서 **m**과 **px**가 혼용되는 이유와, **어디서 어떤 단위**를 쓰는지 한 번에 보는 문서입니다.

---

## 1. 요약: 역할이 다르다

| 단위 | 쓰는 곳 | 이유 |
|------|---------|------|
| **m (미터)** | 시뮬레이션·게임 로직 | "500m 경주", 속도(km/h), 스태미나 소모(1m당), 결승 판정 등은 **해상도/타일 크기와 무관**한 논리 단위로 두는 게 맞음. |
| **px (픽셀)** | Phaser·렌더링 | 월드 좌표, 타일 크기(64px), 카메라 스크롤, 말/결승선 **그리기 위치**는 모두 픽셀. |

즉, **혼용이 아니라 역할 분리**입니다.  
로직은 m, 화면은 px.

---

## 2. 어디서 m, 어디서 px

### m만 쓰는 것 (로직·진행률·판정)

- `Horse.position` — 말의 트랙 위 위치 (출발선 = 0m)
- `trackLengthM` / `getTrackLengthM()` — 트랙 길이 (m)
- `positionToProgress(position, trackLengthM)` — 진행률 0~1 계산
- 결승 판정: `position + FINISH_LINE_OFFSET_M >= trackLengthM`
- 속도·스태미나 공식 (m/s, 1m당 소모 등)
- `FINISH_LINE_OFFSET_M`, `finishTriggerM`, `runPastM` 등 오프셋/연출용 상수 (m)

### px만 쓰는 것 (맵·카메라·그리기)

- `trackStartWorldXPx` / `getTrackStartWorldXPx()` — 트랙 시작 월드 X(px)
- `trackLengthPx` / `getTrackLengthPx()` — 트랙 길이 (픽셀)
- `cameraScrollPx` / `getCameraScrollPx()` — 카메라 스크롤량
- 말 스프라이트의 `x`, 결승선/출발선 그리기 위치
- 타일 크기 `TILE = 64` (px)

### 단위가 섞여 보이는 곳 (의도된 변환)

- **진행률 → 픽셀**: `progress * trackLengthPx` → 말/결승선이 화면에 그려질 X
- **픽셀 → 논리**: 사용하지 않음. 항상 **m → progress → px** 한 방향만 사용.

---

## 3. 변환은 한 곳에서: progress(0~1)

m과 px를 **직접** "1m = N px"처럼 환산하지 않습니다.

1. **m → progress**  
   `positionToProgress(position, trackLengthM)`  
   → `progress = position / trackLengthM` (0~1, 옵션으로 결승 오프셋 반영)

2. **progress → px**  
   `progress * trackLengthPx`  
   → 트랙 위에서의 픽셀 거리 → `trackStartWorldXPx + (progress * trackLengthPx)` 가 월드 X

그래서:

- **트랙 길이(m)** 는 `(raceTiles+1) × METERS_PER_TILE_M` 로만 정의되고,
- **트랙 길이(px)** 는 타일 개수 × `TILE`(64px) 로만 정의되며,
- **둘을 연결하는 것은 “같은 구간을 0~1로 나눈 progress”** 하나뿐입니다.

타일 픽셀 크기나 `METERS_PER_TILE_M`을 바꿔도, progress를 쓰는 한 로직(m)과 화면(px)이 맞게 동작합니다.

---

## 4. 정리

- **m**: 시뮬레이션·진행률·결승 판정·밸런스 수식 전부 미터 단위로 유지.
- **px**: Phaser 월드/스크린 좌표, 맵·카메라·스프라이트 위치 전부 픽셀.
- **변환**: m → progress(0~1) → px 만 사용. progress 계산은 `positionUtils.positionToProgress`, px 변환은 `progress * trackLengthPx` (및 시작점 `trackStartWorldXPx`).

이렇게 나누어 두면 "지금 이 값은 로직용(m)인가, 화면용(px)인가?"만 구분하면 되어서, m/px 혼용이 혼란이 아니라 **의도된 역할 구분**으로 보이게 됩니다.
