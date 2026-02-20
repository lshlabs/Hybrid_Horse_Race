# 네이밍 정리 — 같은 개념, 이름 하나만

"트랙 거리", "트랙 길이", "시작점에서 도착점까지 거리"처럼 비슷한 말이 여러 개라서 복잡해 보이니까, **이 프로젝트에서 쓰는 이름을 한 가지로 고정**한 표입니다. 코드/주석 쓸 때 이거만 쓰면 됩니다.

**m(미터)과 px(픽셀)을 왜 둘 다 쓰는지** → [meters-vs-pixels.md](./meters-vs-pixels.md) 참고.

---

## 1. 트랙 관련 — "길이" 하나로 통일

| 쓰지 말 것 (혼동 유발) | 쓸 것 | 단위 | 의미 |
|------------------------|--------|------|------|
| 트랙 거리, 시작~도착 거리, race length, distance… | **트랙 길이** | m 또는 px | 출발(S) 왼쪽 ~ 결승(E) 왼쪽까지의 길이 |

- **트랙 길이(m)**: `trackLengthM` 또는 getter `getTrackLengthM()`  
  → 공식 하나: `raceTiles × METERS_PER_TILE_M` (또는 현재처럼 `(raceTiles+1)×…` 한 가지만)
- **트랙 길이(px)**: `trackLengthPx` 또는 getter `getTrackLengthPx()`  
  → `raceTiles × TILE`

주석/문서에서는 "트랙 거리", "시작점에서 도착점까지 거리" 같은 표현 쓰지 말고 **"트랙 길이"**만 쓰기.

---

## 2. 위치(좌표) — "시작 X / 결승 X" 하나씩

| 쓰지 말 것 | 쓸 것 | 의미 |
|------------|--------|------|
| track start, start position, 출발점, 시작점… | **시작 X** (또는 `startWorldXPx` / `getTrackStartWorldXPx`) | 트랙이 시작하는 월드 X(px) |
| track finish, end position, 도착점, 결승선 위치… | **결승 X** (또는 `finishWorldXPx` / `getTrackFinishWorldXPx`) | 결승선이 있는 월드 X(px) |

"시작점", "도착점" 말고 **시작 X**, **결승 X** (또는 코드에서는 `trackStartWorldXPx`, `trackFinishWorldXPx`)만 쓰면 됨.

---

## 3. 맵 구조 — 타일 개수

| 이름 | 의미 | 비고 |
|------|------|------|
| **raceTiles** | 경주 구간 타일 개수 (S와 E 사이 T 타일 수) | "트랙 길이" 아님. 트랙 길이 = raceTiles × 1타일 |
| **startTileIndex** / **finishTileIndex** | 출발 타일 인덱스 / 결승 타일 인덱스 | 맵 배열 인덱스용 |

---

## 4. 말 관련

| 이름 | 의미 |
|------|------|
| **position** | 말 현재 위치 (m). 출발선 = 0m |
| **trackLengthM** (Horse 내부) | 트랙 길이(m). 위 "트랙 길이(m)"와 동일한 값. |

---

## 5. 정리

- **트랙 길이** = 출발(S) 왼쪽 ~ 결승(E) 왼쪽 길이 → **m면 trackLengthM, px면 trackLengthPx** 하나만.
- **시작 X / 결승 X** = 그냥 좌표(px). "거리"랑 섞지 말기.
- "트랙 거리", "시작점에서 도착점까지 거리" 같은 표현은 쓰지 말고, 전부 **"트랙 길이"**로 통일.

이렇게 하면 변수명이 "트랙 거리 / 트랙 길이 / 시작~도착 거리"처럼 여러 개로 느껴지지 않고, **트랙 길이(m/px), 시작 X, 결승 X** 정도만 기억하면 됩니다.
