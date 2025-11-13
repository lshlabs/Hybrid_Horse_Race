# 능력치 및 증강 설계 초안

최종 레이스 시뮬레이션과 밸런싱 패치를 고려한 1차 설계 문서입니다. 실제 수치는 추후 테스팅을 통해 조정하며, 본 문서는 데이터 구조와 로직 방향성을 정리합니다.

---

## 1. 말(마)의 기본 능력치

| 키 | 설명 | 수치 범위(초안) | 비고 |
| --- | --- | --- | --- |
| `speed` | 최고 속도에 영향을 미치는 기본 값 | 60 ~ 120 | 증강과 컨디션에 의해 변동 |
| `stamina` | 지구력. 0이 되면 속도가 절반으로 감소 | 60 ~ 120 | 회복 로직 존재 |
| `temper` (runStyle) | 주행 습성. 아래 5가지 중 하나 | - | 성공 확률에 컨디션/기수 영향 |
| `condition` | 컨디션(0~100). 구간별 보너스/패널티 | 0 ~ 100 | 속도, 지구력, 작전 성공률 수정 |
| `jockeySkill` | 기수 능력치. 회복/가속/작전 성공률 보정 | 0 ~ 100 | 증강/카드로 상승 가능 |

### 1.1 주행 습성 (Temper / Run Style)

| 코드 | 이름 | 역할 |
| --- | --- | --- |
| `paceSetter` | 도주마 | 초반 리드를 잡고 끝까지 유지하는 타입 |
| `frontRunner` | 선행마 | 선두 그룹에 머무르면서 중반 이후 승부 |
| `stalker` | 선입마 | 중단에서 기회를 보다가 막판 추월 |
| `closer` | 추입마 | 후반 폭발적인 추월을 노리는 타입 |

각 습성은 **작전 성공률**과 **피로 누적 패턴**을 가진다. 컨디션과 기수 능력치가 해당 성공률에 영향을 준다.  
주행 습성은 증강 선택 이전 단계에서 플레이어가 직접 선택하며, **5가지 습성 중 무작위로 제시되는 3가지** 중 하나를 선택한다. 세트 전체 동안 동일한 습성을 유지하며, 이후 증강 선택과 레이스 진행에 영향을 준다.

### 1.2 컨디션 보정 공식

| 컨디션 구간 | 스피드/지구력 보정 | 작전 성공률 보정 |
| --- | --- | --- |
| 80 ~ 100 | +10% | +10% |
| 60 ~ 79 | +5% | +5% |
| 40 ~ 59 | ±0% | ±0% |
| 20 ~ 39 | -5% | -5% |
| 0 ~ 19  | -10% | -10% |

보정은 `base * (1 + bonus)` 형태로 적용한다. 작전 성공률은 확률에 곱셈 적용.

### 1.3 지구력 회복 로직 (스태미나)

1. 지구력이 0 이하가 되면 스피드가 즉시 50%로 감소.
2. 감속 상태에서 일정 tick마다 지구력을 회복 (`baseRecovery + jockeySkillBonus`).
3. 지구력이 100% 회복되면 다시 최고 스피드로 가속 (`acceleration` = `baseAccel * (1 + jockeySkillBonus)`).
4. 기수 능력치가 회복량/가속도를 추가로 증가시킨다.

---

## 2. 증강(Augment) 시스템

### 2.0 진행 순서 개요

1. **말 선택 / 주행 습성 선택 단계**
   - 플레이어는 5가지 습성 중 랜덤하게 제시된 3가지 중 1개를 선택한다.
   - 모든 플레이어가 선택을 마치면 다음 단계로 전환된다.
2. **증강 선택 단계**
   - 동일 레어도의 증강 카드(3장)가 모든 플레이어에게 제공된다.
   - 리롤 횟수는 공통 규칙을 따르며, 플레이어별 사용 횟수는 누적 관리된다.
   - UI 상단에 `x명의 플레이어가 증강 선택 중입니다` 같은 안내 문구를 표시해 실시간 진행 상황을 공유한다.
3. **레이스 진행 단계**
   - 선택된 습성과 증강 효과가 말/기수 능력치에 적용된 상태로 시뮬레이션을 실행한다.

### 2.1 라운드 흐름

1. 각 세트 시작 전, 플레이어는 **3장의 증강 카드**를 랜덤으로 받는다.
2. 플레이어는 1장을 확정 선택하거나, 보유한 **새로고침 리롤 횟수**를 사용해 다시 뽑을 수 있다.
3. 세트 수가 `setCount = N`이라면 총 N번 증강을 선택한다.
4. 새로고침은 누적 공유 리소스다. 예: 초기 3회 리롤이 허용되면, 1세트에서 1회 사용 시 잔여 2회가 이후 세트에 적용된다.
5. 리롤을 모두 소진하면 남은 세트에서는 리롤 없이 제공된 카드 중 선택해야 한다.

### 2.2 증강 카드 유형 예시

| 카테고리 | 예시 효과 | 대상 |
| --- | --- | --- |
| 속도 강화 | `speed +10`, 컨디션 구간마다 추가 보너스 | 말 |
| 지구력 강화 | `stamina +15`, 회복 속도 +5% | 말 |
| 작전 보조 | 특정 습성 성공률 +12%, 실패 패널티 감소 | 말 |
| 컨디션 유지 | 레이스 시작 시 컨디션 최소 60 보장 | 말 |
| 기수 스킬 | 회복/가속 보너스 상향, 안정적인 작전 수행 | 기수 |

카드는 레어도(예: Common, Rare, Epic)로 분리해 각 레어도별 등장 확률과 수치 범위를 조정한다. 한 세트 내 모든 플레이어는 **동일한 레어도 조합**(예: Rare 1장 + Common 2장) 또는 동일 레어도 카드 목록을 제공받아 공정성을 유지한다.

### 2.3 데이터 구조 초안

```ts
type AugmentCategory =
  | 'speed'
  | 'stamina'
  | 'runStyle'
  | 'condition'
  | 'jockey'

type AugmentRarity = 'common' | 'rare' | 'epic'

interface AugmentDefinition {
  id: string
  name: Record<string, string> // locale key 또는 별도 데이터
  description: Record<string, string>
  category: AugmentCategory
  rarity: AugmentRarity
  effects: AugmentEffect[]
}

type AugmentEffect =
  | { type: 'speedBonus'; amount: number }
  | { type: 'staminaBonus'; amount: number }
  | { type: 'runStyleSuccess'; style: TemperType; bonus: number }
  | { type: 'conditionFloor'; value: number }
  | { type: 'jockeyBonus'; accel: number; recovery: number }
```

### 2.4 리롤 상태 추적

```ts
interface AugmentSessionState {
  setIndex: number
  totalSets: number
  rerollLimit: number
  rerollUsed: number
  currentCards: AugmentDefinition[]
  selectedAugments: AugmentDefinition[]
}
```

`rerollUsed`를 전 세트에 걸쳐 누적 관리하면 남은 횟수를 쉽게 계산할 수 있다. Firestore 문서 구조에 `sets/{setId}`에 `rerollUsed` 필드를 포함해 저장한다.

---

## 3. 증강 선택 화면 UI 요구 사항

1. **카드 영역**: 3장 카드 리스트
   - 카드 클릭 → 선택 상태 표시
   - 카드 설명: 이름, 레어도, 효과 요약
2. **새로고침 버튼**
   - 남은 횟수 표시 (`remainingRerolls = rerollLimit - rerollUsed`)
   - 남은 횟수 0일 때 비활성화
3. **선택 확정 버튼**
   - 카드 선택 후 활성화
4. **세트 정보**
   - 현재 세트 번호 / 전체 세트 수
   - 남은 증강 횟수
5. **다국어 지원**
   - 카드명/설명은 i18n 키 기반

---

## 4. 다음 단계

1. 주행 습성 선택 단계 UI/로직 설계
2. 증강 카드 샘플 데이터 작성 (`src/data/augments.ts` 등)
3. 증강 화면 레이아웃 구현 (`/augment` 라우트) 및 “플레이어 진행 상태” 안내
4. 상태 관리(Zustand 예정)에서 습성·증강 세션 상태를 보존
5. Firestore와 연동해 세션 간 동기화
6. 시뮬레이터 로직과 연동하여 실제 능력치에 적용

문서 수정 시 `docs/ability-and-augment-design.md`를 업데이트하여 밸런싱 변동 사항을 기록한다.

