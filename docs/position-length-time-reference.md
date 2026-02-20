# Position / Length / Time 전역 참조 문서

레이스 관련 **position(위치), 길이, 시간**이 정의·사용되는 모든 곳을 파일·줄 단위로 정리한 문서입니다. 수동 롤백/정리 시 참고용.

---

## 1. 상수 정의 (단일 진실 공급원)

### `frontend/src/engine/race/constants.ts`

| 상수 | 값 | 의미 | 사용처 |
|------|-----|------|--------|
| `DEFAULT_RACE_TILES_COUNT` | 100 | raceTiles 미지정 시 기본 경주 구간 타일 수 | horse.ts (trackLengthM 기본값), index.ts |
| `METERS_PER_TILE_M` | 5 | 타일 1개 = 5m. trackLengthM = (raceTiles+1) × 이 값 | constants 주석, horse.ts, TileMapManager.getTrackLengthM |
| `FINISH_LINE_OFFSET_M` | 0.35 | 결승선 오프셋(m). 기록/연출은 position + 이 값이 trackLengthM에 도달할 때. 말 코 기준 맞출 때 사용 | horse.ts, CameraScrollManager.ts |
| `SIM_STEP_SEC` | 0.05 | 시뮬레이션 스텝(초) | simulator.ts (engine) |
| `MAX_SIM_TIME_SEC` | 120 | 최대 시뮬레이션 시간(초) | simulator.ts |

- **주의**: `START_LINE_OFFSET_M`은 현재 코드베이스에 없음. 출발선은 `HorseManager.HORSE_RIGHT_EDGE_OFFSET`(px)로 처리됨.

---

## 2. 트랙 길이·시작/끝 좌표 (미터·픽셀)

### 2.1 TileMapManager

**파일**: `frontend/src/components/game/managers/TileMapManager.ts`

| 항목 | 정의/계산 | 줄 | 비고 |
|------|-----------|-----|------|
| `TILE` | 64 (px) | 21 | 타일 한 칸 픽셀 |
| `preTiles` | config.preTiles ?? 3 | 74 | 출발 전 타일 수 |
| `raceTiles` | config.raceTiles ?? 30 | 76 | 경주 구간 타일 수 |
| `postTiles` | config.postTiles ?? 3 | 76 | 도착 후 타일 수 |
| `startTileIndex` | preTiles | 84 | 출발 타일 인덱스 |
| `finishTileIndex` | preTiles + raceTiles | 85 | 결승 타일 인덱스 |
| `trackStartWorldXPx` | startTileIndex * TILE | 96 | 트랙 시작 월드 X (px) |
| `trackFinishWorldXPx` | finishTileIndex * TILE | 98 | 트랙 끝 월드 X (px) |
| `trackLengthPx` (내부) | (finishTileIndex - startTileIndex) * TILE | 99 | 경주 구간만 (E타일 왼쪽까지) |

**공개 getter**:

| 메서드 | 반환 | 줄 |
|--------|------|-----|
| `getTrackStartWorldXPx()` | trackStartWorldXPx | 252-254 |
| `getTrackLengthPx()` | trackLengthPx + TILE | 257-259 (결승선 = E타일 오른쪽 끝까지) |
| `getTrackLengthM()` | (raceTiles + 1) * METERS_PER_TILE_M | 267-269 |
| `getRaceTiles()` | raceTiles | 262-264 |
| `getTrackFinishWorldXPx()` | trackFinishWorldXPx | 271-273 |

- **관계**: 시뮬레이션 트랙 길이 = (raceTiles + 1) 타일 = (raceTiles + 1) * METERS_PER_TILE_M (m).

---

## 3. 말 시뮬레이션 (position, 시간, 결승)

### 3.1 Horse 클래스

**파일**: `frontend/src/engine/race/horse.ts`

| 필드/개념 | 타입/의미 | 줄 | 비고 |
|-----------|-----------|-----|------|
| `position` | number (m) | 69 | 말의 현재 위치(미터). 시뮬레이션의 진짜 위치 |
| `finished` | boolean | 71 | 결승선 통과 여부 |
| `finishTime` | number \| null (sim 초) | 72 | 결승 통과 시각(시뮬레이션 시간) |
| `trackLengthM` (private) | number (m) | 74 | prepareForRace(raceTiles)로 설정 = raceTiles * METERS_PER_TILE_M |
| `raceStartTime` | number (sim 초) | 75 | 출발 딜레이 반영한 “실제” 레이스 시작 시각 |

**결승 판정** (step 내부):

| 식 | 줄 | 의미 |
|----|-----|------|
| `effectiveFinishLine = this.trackLengthM - FINISH_LINE_OFFSET_M` | 230 | 결승선 위치(m). position이 여기 이상이면 완주 |
| `this.position >= effectiveFinishLine` | 231 | 완주 시 finished=true, finishTime 기록 |
| (이동 후) `this.position >= effectiveFinishLine && !this.finished` | 331 | 스텝 적분 후 한 번 더 완주 체크, 정밀 finishTime 보간(335-338) |

**진행률(progress)** (step 내부, 능력 등용):

- `progress = clamp(this.position / this.trackLengthM, 0, 1)` (239)
- `startBoostDistance = this.trackLengthM * 0.2` (246) — 초반 20% 구간

**prepareForRace(raceTiles?)** (153-156):

- `this.trackLengthM = raceTiles * METERS_PER_TILE_M` (raceTiles 있을 때)
- position=0, finished=false, finishTime=null, raceStartTime=startDelay 등 초기화 (198-204)

---

## 4. position → 월드 X (픽셀) 변환

### 4.1 CameraScrollManager

**파일**: `frontend/src/components/game/managers/CameraScrollManager.ts`

**보관 값**:

- `trackStartWorldXPx`, `trackLengthPx` — 생성자 또는 setTrackCoords로 설정 (22, 33, 36-38)

**getHorseWorldX(simHorse, simElapsedSec)** (41-58):

| 조건 | progress / effectivePosition | 줄 |
|------|------------------------------|-----|
| `simHorse.finished === true` | timeSinceFinish = simElapsedSec - (finishTime ?? simElapsedSec); runPastM = timeSinceFinish * 15; effectivePosition = position + FINISH_LINE_OFFSET_M + runPastM; progress = effectivePosition / trackLengthM | 46-51 |
| else (미완주) | effectivePosition = position + FINISH_LINE_OFFSET_M; progress = Math.min(1, effectivePosition / trackLengthM) | 53-54 |

- `trackLengthM` = mapManager.getTrackLengthM()
- 최종: `horseScreenDistance = progress * this.trackLengthPx`, `return trackStartWorldXPx + horseScreenDistance` (56-57)

**update() (스크롤 시작 판정)** (64-74):

- 스크롤 전: `progress = simHorse.position / getTrackLengthM()` (오프셋 없음), `horseWorldX = trackStartWorldXPx + progress * trackLengthPx`, 화면 중앙 넘으면 스크롤 시작
- `leadingHorsePositionMAtScrollStart = Math.max(...simHorses.map(h => h.position))` (77)
- 스크롤 중: `maxPosition = Math.max(...simHorses.map(h => h.position))`, 카메라 스크롤량을 (maxPosition - leadingHorsePositionMAtScrollStart) / trackLengthM * trackLengthPx 로 계산 (85-89)

---

## 5. 출발선 (말이 서 있는 X)

### 5.1 HorseManager

**파일**: `frontend/src/components/game/managers/HorseManager.ts`

| 항목 | 값/의미 | 줄 |
|------|----------|-----|
| `HORSE_RIGHT_EDGE_OFFSET` | 35 (px) | 218 |
| 출발선 startX | trackStartWorldXPx + HORSE_RIGHT_EDGE_OFFSET | 232 |
| resetToIdle 시 스프라이트 x | config.startX (동일 값) | 89 |
| 플레이어 인디케이터 기준 X | trackStartWorldXPx + HORSE_RIGHT_EDGE_OFFSET | 323 |

- RaceScene에서 HorseManager 생성 시 `trackStartWorldXPx: this.mapManager.getTrackStartWorldXPx()` 만 전달 (277). trackLengthPx/trackLengthM 미전달.

---

## 6. RaceScene 시간·진행

**파일**: `frontend/src/components/game/scenes/race/RaceScene.ts`

| 상수/변수 | 값/의미 | 줄 |
|-----------|----------|-----|
| `PHYSICS_DT_SEC` | 0.02 (시뮬 스텝, 초) | 44 |
| `SIM_TIME_PER_FRAME_SEC` | 0.02 (프레임당 시뮬 진행 초) | 47 |
| `simElapsedSec` | 시뮬레이션 경과 시간(초) | 76 |
| `simTimeAccumulatorSec` | 프레임당 누적, PHYSICS_DT마다 step 호출 | 459-464, 481 |
| `raceStartTimestampMs` | performance.now() (실제 시간, 참고용) | 77, 319 |
| `simPlaybackScale` | 1 또는 슬로우모 시 감소 | 460 |
| `simSlowmoRestoreMs` | 300 (슬로우모 복구 트윈 duration) | 57 |

**결승 연출 트리거**:

- `finishTriggerM = Math.max(0, trackLengthM - 10)` (419)
- 조건: playerHorse 존재, !finished, playerHorse.position >= finishTriggerM, !isFinishSequenceTriggered → triggerFinishSequence() (419-426)

**시뮬레이션 루프** (457-486):

- `currentRanking` = simHorses.filter(h => !h.finished).sort(position 내림차순) → 1,2,3... 순위 부여 후 updateRank
- finished가 아닌 말만 step(dtPerStep, simElapsedSec) 호출
- 매 스텝 끝에 `simElapsedSec += dtPerStep`

**말 위치 갱신** (489-498):

- 각 simHorse에 대해 worldX = cameraScrollManager.getHorseWorldX(simHorse, this.simElapsedSec) → horseManager.updateHorsePositions(worldXArray)

**디버그 1등선** (502-508):

- 1등 = simHorses.reduce((a,b) => a.position >= b.position ? a : b)
- worldX = getHorseWorldX(leading, this.simElapsedSec), debugPositionLine.setPosition(worldX, 0)

**세트 시작 시 리셋** (658-676):

- simElapsedSec, simTimeAccumulatorSec, raceStartTimestampMs 등 0으로
- 각 simHorse: position=0, currentSpeed=0, finished=false, finishTime=null, prepareForRace(raceTiles + 1)

**prepareForRace 호출**:

- 플레이어 말: prepareForRace(this.mapManager.getRaceTiles() + 1) (291)
- 세트 시작 시: prepareForRace(raceTiles + 1) (675)

→ Horse.trackLengthM = (raceTiles + 1) * METERS_PER_TILE_M = TileMapManager.getTrackLengthM()와 일치.

---

## 7. 결승선/디버그 라인 (RaceScene)

**createFinishLineDebug()** (246-262):

- 결승선(빨간 굵은선) X: `finishWorldXPx = getTrackStartWorldXPx() + getTrackLengthPx()` (249)
- 1등 추적용 빨간 얇은선 초기 위치: getTrackStartWorldXPx() (262), 매 프레임 updateDebugLeadingLine에서 getHorseWorldX(leading)로 갱신 (506-507)

---

## 8. 진행바 (ProgressBarManager)

**파일**: `frontend/src/components/game/managers/ProgressBarManager.ts`

| 항목 | 의미 | 줄 |
|------|------|-----|
| `trackLengthM` | 생성자에서 mapManager.getTrackLengthM() 전달 | 12, 32, 241 |
| progress | Math.min(1, Math.max(0, playerHorse.position / this.trackLengthM)) | 136 |
| indicatorX | startX + progress * barWidth | 143 |

- 오프셋 없이 position / trackLengthM 사용.

---

## 9. HUD / 결과 (position, finishTime, finished)

**RaceHUD** (`frontend/src/components/game/managers/RaceHUD.ts`):

- 정렬: finished 우선, 동시 완주는 finishTime 빠른 순, 미완주는 position 큰 순 (480-492)
- 표시 시간: finished && finishTime != null && > 0 이면 finishTime 사용 (510-511)

**RaceResultScene / 결과**:

- 결과 객체에 position, finished, finishTime 전달 (RaceScene 591-593 등).

---

## 10. 요약 표 (단위·의미)

| 심볼 | 단위 | 의미 |
|------|------|------|
| position | m | 말의 시뮬레이션 위치 (코 기준) |
| trackLengthM | m | (raceTiles + 1) * METERS_PER_TILE_M = getTrackLengthM() |
| trackStartWorldXPx | px | 트랙 시작 월드 X |
| trackLengthPx | px | getTrackLengthPx() = 경주구간 px + TILE (결승선까지) |
| progress | 0~1 | position/trackLengthM 또는 (position+FINISH_LINE_OFFSET_M)/trackLengthM (표시용) |
| simElapsedSec, finishTime, currentTime | 초 | 시뮬레이션 시간 |
| FINISH_LINE_OFFSET_M | m | 0.35, 결승 판정·표시 시 position에 더해 “말 코”를 트랙 끝에 맞춤 |
| HORSE_RIGHT_EDGE_OFFSET | px | 35, 출발선에서 말 오른쪽 끝 오프셋 |

---

## 11. 파일별 사용처 인덱스

- **constants.ts**: DEFAULT_RACE_TILES_COUNT, METERS_PER_TILE_M, FINISH_LINE_OFFSET_M, SIM_STEP_SEC, MAX_SIM_TIME_SEC
- **horse.ts**: position, finished, finishTime, trackLengthM, raceStartTime, effectiveFinishLine, progress(내부), prepareForRace
- **TileMapManager.ts**: TILE, preTiles, raceTiles, startTileIndex, finishTileIndex, trackStartWorldXPx, trackFinishWorldXPx, trackLengthPx, getTrackStartWorldXPx, getTrackLengthPx, getTrackLengthM, getRaceTiles
- **CameraScrollManager.ts**: trackStartWorldXPx, trackLengthPx, getHorseWorldX (position→worldX, FINISH_LINE_OFFSET_M, runPastM), update(스크롤, position 기반)
- **HorseManager.ts**: HORSE_RIGHT_EDGE_OFFSET, startX = trackStartWorldXPx + 35, resetToIdle(startX)
- **RaceScene.ts**: PHYSICS_DT_SEC, SIM_TIME_PER_FRAME_SEC, simElapsedSec, simTimeAccumulatorSec, finishTriggerM, updateSimulation, updateHorsePositions, updateDebugLeadingLine, createFinishLineDebug, prepareForRace(raceTiles+1)
- **ProgressBarManager.ts**: trackLengthM, progress = position / trackLengthM
- **RaceHUD.ts**: position, finished, finishTime (정렬·표시)

이 문서는 위 경로·줄 번호 기준으로, position/길이/시간이 쓰이는 코드를 빠짐없이 나열한 참조용입니다.
