# RaceScene 최적화 평가: 오버엔지니어링 여부

## 1. 적용한 변경 요약

| 항목 | 내용 |
|------|------|
| create() 분할 | setupGameArea, createManagers, createHorsesAndHUD, setupAugmentSelection 등으로 분리 |
| utils/raceRanking | computeRoundRankings 순수 함수 |
| utils/fireworks | createFireworks(scene) |
| CountdownManager | 3,2,1,GO! 카운트다운 전담 |
| raceScene/types | IRaceSceneFlowContext, IRaceSceneResultContext (컨텍스트 인터페이스) |
| raceScene/raceFlow | runHandleStart, runShowAugmentSelection, runOnAugmentSelected |
| raceScene/raceResult | runShowRaceResult, runHandleFinalResult, runStartNewSet |
| RaceScene | 위 모듈 위임 + 컨텍스트용 public 세터 10개 + get sceneData |

---

## 2. 복잡도·오버엔지니어링 관점

### 2-1. 부담이 적고 유지보수에 도움되는 부분

- **create() 분할**  
  같은 파일 안에서 메서드만 나눈 것. 흐름 읽기 좋고, “어디서 뭘 만드는지” 한눈에 보임. 복잡도 거의 없음.
- **utils/raceRanking**  
  순수 함수 하나. 테스트·재사용 쉬움. RaceScene과 결합도 낮음.
- **utils/fireworks**  
  씬 하나 받아서 이펙트만 수행. 역할이 명확함.
- **CountdownManager**  
  “카운트다운 UI + 완료 콜백”만 담당. 기존 씬과 역할이 잘 갈라져 있음.

→ 이 네 가지는 **과한 추상화가 아니고**, 코드 구조를 더 단순·명확하게 만든다고 보는 게 타당함.

---

### 2-2. 부담이 생기는 부분 (raceFlow / raceResult / types)

- **컨텍스트 인터페이스 비대**  
  - `IRaceSceneFlowContext`: 프로퍼티 + 세터 + 메서드 합쳐 20개 이상.  
  - `IRaceSceneResultContext`: 25개 이상.  
  - flow/result가 겹치는 멤버(scene, horseManager, mapManager, hud, setRaceStarted, updateHUDInitial 등)가 많아 **인터페이스 자체가 중복·비대**해짐.

- **RaceScene에 세터·getter만을 위한 public API 증가**  
  - `setRemainingRerolls`, `setAugmentSelectionActive`, `setRaceStarted`, … 등 **10개 이상의 public 세터**가 “컨텍스트 구현” 목적으로만 추가됨.  
  - `get sceneData`도 컨텍스트용.  
  - 씬이 원래 캡슐화하던 상태를 **외부 모듈(raceFlow/raceResult)이 세터로만 조작**하는 구조가 됨.  
  → “진짜 공개 API”가 아니라 “분리한 함수를 위해 억지로 붙인 인터페이스”에 가깝고, **역할이 흐려짐**.

- **타입 안전성 회피**  
  - `this as unknown as IRaceSceneFlowContext` / `IRaceSceneResultContext` 를 매번 넘기는 방식.  
  - 타입 단언으로 “이 씬이 곧 컨텍스트”라고 우회하고 있어, **컴파일 단계에서의 이점이 줄어듦**.  
  - 나중에 인터페이스와 씬 구현이 어긋나도 컴파일러가 잡기 어렵고, 수동으로 맞춰야 함.

- **흐름 추적 비용**  
  - 예: “증강 선택 후 뭘 하는가?”  
    - 이전: RaceScene 한 파일에서 `onAugmentSelected` 안만 보면 됨.  
    - 현재: RaceScene `onAugmentSelected` → `runOnAugmentSelected(ctx)` → raceFlow.ts, 그리고 ctx가 실제로는 RaceScene이므로 “어디 상태가 바뀌는지”를 보려면 **파일·인터페이스를 오가며** 추적해야 함.  
  - **인지 부하**가 분명히 늘어남.

- **파일·역할 수 증가**  
  - “레이스 씬 동작”이 이제 RaceScene + types + raceFlow + raceResult + (기존) CountdownManager, utils 등 **여러 파일에 나뉘어 있음**.  
  - 한 기능을 고치거나 이해하려면 **여러 곳을 동시에** 보게 됨.

정리하면, **raceFlow/raceResult 분리와 그에 딸린 types + 세터**는 “코드 라인 수 감소” 대비 **인터페이스 비대화, 타입 우회, 추적 난이도 증가**라는 비용이 꽤 큼.  
즉, **일부 오버엔지니어링에 해당한다**고 보는 게 타당함.

---

## 3. 정리 평가

| 구분 | 판단 |
|------|------|
| create 분할, CountdownManager, utils (raceRanking, fireworks) | **적정 수준**. 복잡도 거의 안 올리고 가독성·재사용은 좋아짐. |
| raceFlow / raceResult / types / RaceScene 세터 | **과한 추상화에 가깝다**. 컨텍스트 인터페이스·세터·타입 단언이 많아지고, 한 동작을 따라가기 위해 여러 파일을 오가야 함. |

- **RaceScene 900줄 → 600줄**로 줄어든 것은 사실이지만,  
  그 “빠진 300줄”이 **types 70줄 + raceFlow 70줄 + raceResult 130줄 + RaceScene 세터/위임 60줄** 등으로 재분배되면서,  
  **전체 복잡도(파일 수, 인터페이스 크기, 추적 경로)** 는 오히려 늘어났다고 보는 게 맞음.

- “더 복잡해졌는가?”  
  - **단일 파일 기준**으로는 RaceScene이 짧아져서 단순해 보임.  
  - **시스템 전체**로 보면, 컨텍스트 계약·세터·파일 간 이동 때문에 **복잡해진 부분이 있다**고 평가하는 게 맞음.

---

## 4. 권장 방향

- **유지할 것**  
  - create() 분할  
  - CountdownManager  
  - utils/raceRanking, utils/fireworks  

- **롤백을 고려할 것**  
  - raceScene/types.ts  
  - raceScene/raceFlow.ts  
  - raceScene/raceResult.ts  
  - RaceScene의 “컨텍스트용” public 세터·get sceneData  
  - 위 세 모듈로의 위임(handleStart, showAugmentSelection, onAugmentSelected, showRaceResult, handleFinalResult, startNewSet)

즉, **“create 분할 + CountdownManager + utils”만 남기고, raceFlow/raceResult/context 패턴은 제거**하면,  
**라인 수는 어느 정도 늘어나더라도** 전체 구조는 더 단순해지고, 오버엔지니어링 느낌이 줄어듦.

원하면 “raceFlow/raceResult/types만 롤백하는 패치”도 단계별로 정리해 줄 수 있음.
