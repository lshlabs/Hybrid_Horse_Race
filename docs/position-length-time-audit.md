# Position / Length / Time 중복·복잡성 검사 보고서

같은 개념이 여러 곳에 나뉘어 있고, 공식이 섞여 있어서 복잡해진 부분을 정리한 보고서입니다.

---

## 1. 트랙 길이(m) — 4곳에서 사용, 2가지 정의 방식

| 위치 | 저장/계산 방식 | 비고 |
|------|----------------|------|
| **TileMapManager** | `getTrackLengthM() = (raceTiles + 1) * METERS_PER_TILE_M` | 여기만 “진짜” 정의 |
| **Horse** | `private trackLengthM` = `prepareForRace(인자) * METERS_PER_TILE_M` | 인자로 받은 값으로만 설정됨 |
| **ProgressBarManager** | `private trackLengthM` = 생성자에서 `mapManager.getTrackLengthM()` 받아서 저장 | TileMapManager의 복사본 |
| **CameraScrollManager** | 저장 안 함. `getHorseWorldX()` 안에서 매번 `mapManager.getTrackLengthM()` 호출 | 매번 조회 |

**문제점**

- “트랙 길이(m)”가 **한 곳(TileMapManager)에서만 정의**되면 되는데, Horse·ProgressBar는 **각자 필드로 들고 있음**. TileMapManager가 바뀌면 RaceScene에서 넘겨주는 부분만 맞춰야 하고, Horse는 `prepareForRace(raceTiles + 1)`처럼 **+1을 호출하는 쪽에서 맞춰야** 함.
- Horse 쪽 공식은 `trackLengthM = raceTiles * METERS_PER_TILE_M`인데, 실제로는 **인자로 `raceTiles + 1`을 넘기기 때문에** “(raceTiles+1)*METERS_PER_TILE_M”과 같아짐. 즉 **이름(raceTiles)과 의미(실제로는 타일 수 = raceTiles+1)가 어긋남**.

**정리 제안**

- “트랙 길이(m)”의 단일 정의: **TileMapManager.getTrackLengthM()**만 두고, 나머지는 이걸 **매번 호출**하거나, 필요하면 “트랙 길이 제공자” 하나를 두고 거기서만 읽기.
- Horse는 `prepareForRace(trackLengthM: number)`처럼 **미터 단위**를 받거나, `prepareForRace(raceTiles: number)`로 두되 “이 raceTiles가 타일 개수인지, 경주 구간 타일 수인지” 주석/이름으로 명확히 하기.

---

## 2. 트랙 길이(px) — 2곳

| 위치 | 저장/계산 |
|------|-----------|
| **TileMapManager** | `trackLengthPx = (finishTileIndex - startTileIndex) * TILE`, getter는 `trackLengthPx + TILE` 반환 |
| **CameraScrollManager** | 생성자/ setTrackCoords로 `trackLengthPx` 받아서 **복사 보관** |

**문제점**

- “트랙 길이(px)”를 TileMapManager가 계산하고, CameraScrollManager가 **그대로 복사**해서 들고 있음. 맵 설정이 바뀌면 RaceScene에서 다시 넘겨줘야 해서, **같은 값을 두 군데서 관리**하는 구조.

**정리 제안**

- CameraScrollManager는 `trackLengthPx`를 필드로 두지 말고, **필요할 때마다 mapManager.getTrackLengthPx()** 호출하거나, “좌표/스크롤만 담당하고 길이는 맵에서만 읽기”로 단일 소스 유지.

---

## 3. 트랙 시작 X(px) — 3곳

| 위치 | 저장/계산 |
|------|-----------|
| **TileMapManager** | `trackStartWorldXPx = startTileIndex * TILE`, getter 제공 |
| **CameraScrollManager** | 생성자에서 받아서 `trackStartWorldXPx` 필드로 보관 |
| **HorseManager** | 생성자에서 `trackStartWorldXPx` 받아서 `startX = trackStartWorldXPx + HORSE_RIGHT_EDGE_OFFSET` 계산에만 사용 |

**문제점**

- “시작 월드 X”도 TileMapManager 한 곳에서만 정의하면 되는데, CameraScroll·HorseManager가 **각자 인자로 받아서** 들고 있음. TileMapManager와 **동기화 책임이 호출자(RaceScene)** 쪽에 있음.

**정리 제안**

- CameraScrollManager·HorseManager는 mapManager만 주입받고, `trackStartWorldXPx`는 **필드로 두지 말고 getTrackStartWorldXPx()** 로만 사용하면 “시작 X” 정의는 한 곳으로 모임.

---

## 4. progress / position → 픽셀 변환 — 공식이 3종

같은 “진행률” 같은 개념인데, **오프셋 적용 여부**가 달라서 공식이 셋으로 나뉨.

| 위치 | 공식 | 용도 |
|------|------|------|
| **CameraScrollManager.getHorseWorldX()** (미완주) | `(position + FINISH_LINE_OFFSET_M) / trackLengthM` → progress, cap 1 | 말 스프라이트 X |
| **CameraScrollManager.getHorseWorldX()** (완주) | 위 + `runPastM = timeSinceFinish * 15` | 결승선 넘어 달리기 연출 |
| **CameraScrollManager.update()** (스크롤 시작 판정) | `position / trackLengthM` (오프셋 없음) | “화면 중앙 도달” 판정 |
| **ProgressBarManager.update()** | `position / trackLengthM` (오프셋 없음) | 진행바 채움 |
| **horse.ts step()** (내부) | `position / trackLengthM` (clamp 0~1) | 라스트 스퍼트 등 능력치용 |

**문제점**

- “position → progress” 변환이 **getHorseWorldX에서는 오프셋 있음**, **나머지는 전부 오프셋 없음**. 그래서 “같은 position”이어도 **어디서 쓰느냐에 따라 progress가 달라짐**.
- progress 계산 로직이 CameraScrollManager 한 곳에만 있는 게 아니라, “스크롤 시작”과 “말 위치”가 **같은 파일 안에서도 서로 다른 식**을 씀. 읽을 때 헷갈림.

**정리 제안**

- “position → progress (0~1)” 계산을 **한 함수/한 모듈**로 모으고 (예: `toProgress(position, trackLengthM, options?: { useFinishOffset?: boolean })`), CameraScroll·ProgressBar·horse 내부는 모두 그걸 호출하도록 하면, 공식이 한 곳에만 있음.
- 스크롤 시작 판정도 “오프셋 없는 progress”를 쓸지, “오프셋 있는 progress”를 쓸지 정책을 정한 뒤, 위 공용 함수로 맞추기.

---

## 5. raceTiles vs “실제 트랙 길이에 쓰는 타일 수” — +1 혼란

| 위치 | 사용 방식 |
|------|------------|
| **TileMapManager** | `raceTiles` = 경주 구간 타일 수 (config 기본 30). `getTrackLengthM() = (raceTiles + 1) * METERS_PER_TILE_M` |
| **Horse.prepareForRace(인자)** | `trackLengthM = 인자 * METERS_PER_TILE_M`. RaceScene은 `getRaceTiles() + 1`을 넘김 (예: 31) |
| **RaceScene** | `prepareForRace(this.mapManager.getRaceTiles() + 1)`, `applyAugmentsToAllHorses(this.mapManager.getRaceTiles())` 등 |

**문제점**

- “경주 구간 타일 수”는 `raceTiles`(30)인데, “트랙 길이(m)에 쓰는 타일 수”는 **30+1=31**이라서, 코드 곳곳에 **+1이 붙음**. `getRaceTiles()`와 `getTrackLengthM()`이 서로 다른 공식(raceTiles vs raceTiles+1)을 쓰는 걸 모르면 “왜 여기만 +1?”이 됨.
- Horse는 “raceTiles”라는 이름의 인자를 받지만, 실제로는 **“길이 계산용 타일 수(raceTiles+1)”**를 받고 있음. 이름과 의미 불일치.

**정리 제안**

- “경주 구간 타일 수”와 “트랙 길이 계산에 쓰는 타일 수(출발~결승 타일 개수)”를 변수/이름으로 구분하거나, `getTrackLengthM()` / `getTrackLengthInTiles()` 같은 getter를 두고 **+1은 TileMapManager 안에서만** 쓰기.
- Horse.prepareForRace는 **미터 단위 trackLengthM**을 받거나, 인자 이름을 `trackLengthInTiles` 같이 바꿔서 “타일 개수(이미 +1 반영)”임을 드러내기.

---

## 6. 오프셋 관련 — 단위·역할이 다른 값이 여러 개

| 이름 | 단위 | 값 | 쓰이는 곳 |
|------|------|-----|------------|
| **FINISH_LINE_OFFSET_M** | m | 0.35 | horse.ts (결승 판정), CameraScrollManager (말 위치→픽셀) |
| **HORSE_RIGHT_EDGE_OFFSET** | px | 35 | HorseManager (출발선에서 말 오른쪽 끝) |
| **finishTriggerM** (RaceScene) | m | `trackLengthM - 10` | 결승 연출 트리거 (10m 전) |
| **runPastM** (CameraScrollManager) | m | `timeSinceFinish * 15` | 완주 후 “계속 달리는” 연출 |

**문제점**

- “오프셋”이라는 말만 보면 비슷해 보이지만, **결승선 오프셋(m)** / **출발선 오프셋(px)** / **연출 트리거(m)** / **연출용 가상 진행(m)** 이라서 서로 다른 개념. 주석 없으면 헷갈림.
- 출발선은 **미터 단위 상수(START_LINE_OFFSET_M)** 없이 **픽셀 35**로만 되어 있어서, “트랙 길이(px/m)가 바뀌어도 출발선 보정”이 불가능. (원하면 m 단위로 바꿔서 trackLengthPx/M 비율로 픽셀 계산하는 방식으로 통일 가능.)

**정리 제안**

- constants.ts 또는 한 문서에 “오프셋/매직넘버 정리” 표로 넣어두기: 이름, 단위, 값, 용도, 사용 파일.
- 출발선을 m 단위로 맞추고 싶다면 `START_LINE_OFFSET_M`을 도입하고, `startX = trackStartWorldXPx + START_LINE_OFFSET_M * (trackLengthPx / trackLengthM)` 같은 식으로 한 곳에서만 계산.

---

## 7. 타입/주석과 실제 단위 불일치

| 위치 | 내용 | 실제 |
|------|------|------|
| **frontend/src/types/race.ts** | `HorseData.position`: "트랙 상의 위치 (0.0 ~ 1.0)" | 엔진에서는 position이 **미터(m)**. 0~1이 아님. |
| **RaceConfig.trackLength** | 이름이 trackLength | 다른 곳은 전부 trackLength**M**(m) 사용. 단위가 이름에 없음. |

**문제점**

- 타입/주석이 옛 설계(0~1 정규화)인데, 구현은 m 단위. 나중에 이 타입을 쓰는 코드가 “0~1”로 착각하면 버그 유발.

**정리 제안**

- `HorseData.position` 주석을 “미터 단위”로 바꾸거나, 실제로 0~1만 쓴다면 엔진과의 경계에서 변환하는 지점을 명시.
- `RaceConfig.trackLength` → `trackLengthM` 등 **단위가 드러나는 이름**으로 통일 검토.

---

## 8. 요약 — “왜 복잡해 보이는가”

1. **트랙 길이(m/px)·시작 X**가 TileMapManager에만 정의되면 되는데, Horse / ProgressBar / CameraScroll / HorseManager가 **복사본이나 인자로 따로 들고 있음** → 같은 것이 2~4곳에 흩어져 있음.
2. **progress(진행률)** 계산이 “오프셋 있음/없음”으로 나뉘어 있고, 그 차이가 **한 파일(CameraScrollManager) 안에서도** 공식이 둘로 갈라져 있음 → 한 개념이 여러 공식.
3. **raceTiles**와 “트랙 길이에 쓰는 타일 수(raceTiles+1)”가 이름으로 구분되지 않고, **+1이 호출하는 쪽**에만 있어서 의미가 불명확함.
4. **오프셋**이 여러 개인데 단위(m/px)와 역할(결승/출발/연출 트리거/연출 가상 진행)이 제각각이라, 한눈에 정리되지 않음.
5. **타입/주석**은 “0~1 위치”처럼 되어 있는데, 실제 값은 **m 단위**라서 타입과 구현이 어긋나 보임.

---

## 9. 정리 시 우선순위 제안

| 순위 | 내용 | 기대 효과 |
|------|------|------------|
| 1 | “트랙 길이(m)”, “트랙 시작 X”, “트랙 길이(px)”를 **한 곳(TileMapManager)에서만 정의**하고, 나머지는 getter 호출만 하도록 정리 | 중복 저장 제거, 단일 소스 |
| 2 | **position → progress** 변환을 한 함수/모듈로 모으고, 오프셋 사용 여부를 옵션으로 명시 | 공식 일원화, 동작 일관성 |
| 3 | **raceTiles vs (raceTiles+1)** 를 이름/주석으로 구분하고, Horse.prepareForRace 인자 의미 고정 | +1 혼란 제거 |
| 4 | **오프셋/매직넘버** 표를 문서·상수 파일에 추가 | 유지보수 시 찾기 쉬움 |
| 5 | **types/race.ts**의 position 주석·이름을 실제 단위(m)와 맞추기 | 타입과 구현 일치 |

이 순서로 정리하면 “같은 걸 여러 번 정의한 느낌”과 “비슷한데 조금씩 다른 공식”이 줄어듭니다.
