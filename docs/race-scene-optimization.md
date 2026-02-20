# RaceScene.ts 최적화 방안

현재 약 900줄 단일 파일. 아래 순서로 적용하면 유지보수와 테스트가 쉬워집니다.

---

## 1. 같은 파일 안에서 할 수 있는 것 (리팩터만)

### 1-1. `create()` 쪼개기
`create()` 한 블록을 역할별 private 메서드로 나누기만 해도 가독성이 좋아집니다.

```ts
create() {
  this.loadGameData()
  this.setupGameArea()
  this.createManagers()      // map, camera, horse, progressBar
  this.initializeFromGameData()
  this.createHorsesAndHUD()
  this.setupAugmentSelection()
}
```

- `setupGameArea()`: gameWidth, fullHeight, gameAreaHeight, pixelArt
- `createManagers()`: TileMapManager, CameraScrollManager, ProgressBarManager, HorseManager 생성
- `createHorsesAndHUD()`: 말 생성/적용, HUD 생성, progressBar.create(), updateHUDInitial()
- `setupAugmentSelection()`: showAugmentSelection 호출까지

줄 수는 그대로여도 “무슨 단계인지” 한눈에 보입니다.

### 1-2. 순위 계산 로직 분리
`showRaceResult()` 안의 **순위 계산 + 결과 객체 만들기**를 순수 함수로 빼기.

- 예: `computeRoundRankings(simHorses, horseManager, players, playerId, simElapsedSec)`  
  → `{ rank, name, time, finished, augments, horseIndex }[]` 반환
- RaceScene은 그 결과로 `roundResults.push(rankings)` 하고 RaceResultScene만 띄우면 됨.

이렇게 하면:
- 순위/정렬 로직을 단위 테스트하기 쉽고
- `showRaceResult()`는 “진행바 숨기기 → 폭죽 → 순위 계산 → 결과 씬 띄우기” 정도로 짧아집니다.

### 1-3. 데이터 로드/구독 한곳으로
- `loadGameData()`: `init()` / `create()` 에서만 호출
- `onGameDataUpdated()`: 이벤트 콜백으로만 사용

이 둘을 **데이터 관련** 주석/블록으로 묶어두고,  
나중에 “씬 데이터 + Firebase 동기화”를 한 모듈로 빼기 좋게 두면 됩니다.

---

## 2. 매니저/헬퍼로 빼기 (파일 분리)

이미 MapManager, HorseManager, RaceHUD 등이 있으니, 같은 패턴으로 역할만 나누면 됩니다.

| 추출 대상 | 새 파일 (예) | 역할 |
|-----------|--------------|------|
| 카운트다운 | `managers/CountdownManager.ts` | 3, 2, 1, GO! 표시 + 끝나면 `onComplete()` 콜백. 씬에서 `handleStart` 연결 |
| 증강 선택 플로우 | `managers/AugmentFlowManager.ts` 또는 씬 내 메서드만 유지 | showAugmentSelection / onAugmentSelected. “증강 선택 → 적용 → 카운트다운”만 담당 |
| 순위 계산 | `utils/raceRanking.ts` | `computeRoundRankings(...)` 순수 함수. showRaceResult에서 호출 |
| 폭죽 효과 | `managers/EffectsManager.ts` 또는 `utils/fireworks.ts` | `createFireworks(scene)` 한 함수. 씬만 넘기고 파티클은 내부에서 생성 |

- **CountdownManager**: 씬 ref + `start(onComplete: () => void)` 정도만 있으면 됨.
- **AugmentFlowManager**: 씬 ref + 룸/리롤/말 매니저 참조. “선택 띄우기 / 선택됐을 때 적용”만 담당하면 RaceScene이 짧아짐.
- **raceRanking**: 엔진/타입만 import하는 순수 함수라 테스트/재사용이 쉬움.

---

## 3. 씬을 여러 파일로 나누기 (선택)

Phaser 씬은 한 클래스가 길어지기 쉬우므로, **클래스는 한 파일에 두되 로직은 다른 파일로** 빼는 방식이 무난합니다.

```
scenes/
  RaceScene.ts          # class RaceScene + create() / update() 골격
  raceScene/
    createRace.ts       # create() 내용 (createManagers, createHUD 등 호출)
    raceFlow.ts         # handleStart, startCountdown, showAugmentSelection, onAugmentSelected
    raceResult.ts       # showRaceResult, handleFinalResult, startNewSet
    raceSceneTypes.ts   # 씬에서 쓰는 데이터 타입 (Room, Player, selectedHorse 등)
```

- `RaceScene.ts`:  
  - `create()` → `createRace.create(this)`  
  - `update()` → 그대로  
  - `handleStart` 등 → `raceFlow.handleStart(this)` 처럼 위임
- `createRace.ts` 등은 `(scene: RaceScene)` 받아서 scene에 매니저 붙이거나, 필요한 것만 인자로 넘기면 됨.

이렇게 하면 RaceScene.ts는 “진입점 + update + 짧은 위임” 정도로 줄어들고, 실제 로직은 파일별로 나뉩니다.

---

## 4. 적용 순서 제안

1. **1-1** `create()` 분할 (같은 파일, 30분 내)
2. **1-2** `computeRoundRankings()` 추출 (같은 파일 또는 `utils/raceRanking.ts`)
3. **2** CountdownManager 추출 → RaceScene에서 `countdownManager.start(() => this.handleStart())` 한 줄
4. **2** `createFireworks(scene)` 유틸 또는 EffectsManager
5. 필요하면 **3**에서 raceFlow / raceResult 파일로 분리

이 순서면 “한 번에 다 갈아엎지 않고” 단계적으로 줄이면서 동작도 유지하기 좋습니다.
