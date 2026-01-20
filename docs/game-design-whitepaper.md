# Hybrid Horse Race - 게임 설계 백서 (Game Design Whitepaper)

## 목차
1. [개요](#개요)
2. [핵심 설계 철학](#핵심-설계-철학)
3. [게임 상수 및 기본 설정](#게임-상수-및-기본-설정)
4. [능력치 시스템](#능력치-시스템)
5. [말 클래스 구조](#말-클래스-구조)
6. [레이스 시뮬레이션 로직](#레이스-시뮬레이션-로직)
7. [특수 능력 시스템](#특수-능력-시스템)
8. [증강 시스템](#증강-시스템)
9. [밸런스 분석 시스템](#밸런스-분석-시스템)
10. [경마 고증 분석 및 개선 제안](#경마-고증-분석-및-개선-제안)

---

## 개요

Hybrid Horse Race는 경마를 모티브로 한 레이싱 시뮬레이션 게임으로, 6가지 핵심 능력치와 특수 능력 시스템을 통해 전략적 깊이를 제공합니다.

### 기본 스펙
- **트랙 길이**: 500m (단거리 스프린트 레이스)
- **참가 말 수**: 8두 (기본값)
- **시뮬레이션 주기**: 0.05초 (20 FPS)
- **최대 시뮬레이션 시간**: 120초

---

## 핵심 설계 철학

### 1. 몰빵 방지 시스템
능력치 20 초과 시 효율이 감소하여 올라운드 빌드를 유도합니다.

**정규화 공식**:
```
stat <= 20: normalized = stat / 20
stat > 20:  normalized = 1.0 + (stat - 20) / 40  (초과분 50% 효율)
```

**예시**:
- Speed 20 → 정규화 1.0 (100%)
- Speed 30 → 정규화 1.25 (125% = 100% + 25%)
- Speed 40 → 정규화 1.5 (150% = 100% + 50%)

### 2. 로또형 컨디션 시스템
Consistency 능력치를 통해 매 레이스마다 운 요소를 도입하되, 높은 Consistency로 리스크를 줄일 수 있습니다.

### 3. 위치 기반 특수 능력
순위와 진행도에 따라 발동되는 특수 능력으로 역전 드라마와 전략적 선택을 제공합니다.

---

## 게임 상수 및 기본 설정

### 속도 관련
```typescript
MIN_SPEED_KMH = 58      // 최소 최고속도 (km/h)
MAX_SPEED_KMH = 68      // 최대 최고속도 (km/h)
```

**실제 변환**:
- 58 km/h ≈ 16.11 m/s
- 68 km/h ≈ 18.89 m/s

### 트랙 및 시간
```typescript
TRACK_REAL_M = 500      // 트랙 길이 (m)
DT = 0.05               // 시뮬레이션 주기 (초)
MAX_SIM_TIME = 120      // 최대 시뮬레이션 시간 (초)
```

### 구간 기준
```typescript
EARLY_THRESHOLD = 0.33   // 초반 구간 (33%, 165m)
MID_THRESHOLD = 0.66     // 중반 구간 (66%, 330m)
```

### 스태미나 소모 계수
```typescript
BASE_STAMINA_COST_PER_M = 0.1        // 1m당 기본 소모량
SPEED_STAMINA_COST_PER_M = 0.08      // 속도 비례 추가 소모
STAMINA_COST_SPEED_CAP_MS = 16.67    // 소모 계산용 속도 상한 (60km/h)
```

**스태미나 소모 공식**:
```
staminaCostPerM = BASE_STAMINA_COST_PER_M 
                + SPEED_STAMINA_COST_PER_M * (currentSpeed / SPEED_CAP)
                
speedPenalty = 1.0 + 0.1 * normalizedSpeed  // Speed 스탯에 따른 추가 페널티

finalCost = staminaCostPerM * speedPenalty * staminaCostFactor * distance
```

### 가속 관련
```typescript
ACCEL_MIN = 0.3    // Power 0일 때 가속 계수
ACCEL_MAX = 1.5    // Power 20일 때 가속 계수
```

**로그 램프 가속 공식**:
```
v(t) = v_target * log(1 + k * t) / log(1 + k * T)

where:
  t = 레이스 시작 후 경과 시간
  T = 목표 가속 시간 (3~7초, Power와 Start에 따라 변동)
  k = 가속 계수 (Power 기반, Start 버프 적용)
  v_target = 목표 속도 (피로 보정 반영)
```

**특징**:
- 초반: 빠른 가속 (로그 함수의 급격한 상승)
- 중반 이후: 완만한 수렴 (점진적으로 목표 속도 도달)
- Power와 Start가 높을수록 T가 작아져 더 빠르게 가속

### 컨디션 롤 범위
```typescript
COND_MIN_BONUS = -0.03   // 최소 -3%
COND_MAX_BONUS = 0.03    // 최대 +3%
```

**Consistency에 따른 롤 범위**:
- Consistency 0: -3% ~ +3% (완전 랜덤)
- Consistency 10: -1.5% ~ +3% (음수 범위 축소)
- Consistency 20: 0% ~ +3% (음수 없음)
- Consistency 30: +0.75% ~ +3% (저점 상승)
- Consistency 40: +1.5% ~ +3% (더 높은 저점)

---

## 능력치 시스템

### 6대 핵심 능력치

#### 1. Speed (속도)
**역할**: 말의 최고 속도 결정

**효과**:
```typescript
// 비선형 변환 적용 (몰빵 효율 감소)
tSpeed <= 1.0: tSpeedEff = pow(tSpeed, 0.65)
tSpeed > 1.0:  tSpeedEff = 1.0 + (tSpeed - 1.0) * 0.5

maxSpeedKmh = 58 + (68 - 58) * tSpeedEff
```

**페널티**: 속도가 높을수록 스태미나 소모 증가
```typescript
speedPenalty = 1.0 + 0.1 * normalizedSpeed
// Speed 20일 때 10% 추가 소모
```

**설계 의도**: 
- 목표 상관계수: 0.35 (중간 정도 영향)
- 속도는 중요하지만, 스태미나 관리가 더 중요하도록 설계

#### 2. Stamina (지구력)
**역할**: 스태미나 소모 효율 결정

**효과**:
```typescript
maxStamina = 100  // 모든 말 동일

staminaCostFactor = 1.0 - 0.55 * min(tStamina, 1.0) 
                        - 0.2 * max(0, tStamina - 1.0)
// 최소값: 0.45 (Stamina 높을수록 소모 감소)
```

**범위**:
- Stamina 0: 소모 계수 1.0 (기본 소모)
- Stamina 20: 소모 계수 0.45 (55% 감소)
- Stamina 30+: 추가 감소 (초과분은 효율 감소)

**설계 의도**:
- 목표 상관계수: 0.5 (가장 중요한 능력치)
- 레이스 전체를 통틀어 가장 큰 영향력

#### 3. Power (가속)
**역할**: 가속 능력 및 목표 속도 도달 시간 결정

**효과**:
```typescript
accelFactor = 0.3 + (1.5 - 0.3) * tPower

targetAccelTime = 7.0 - (tPower + tStart) * 2.0
// 3~7초 범위로 제한
```

**범위**:
- Power 0: 가속 계수 0.3, 목표 시간 7초
- Power 20: 가속 계수 1.5, 목표 시간 3초
- Power + Start 20: 최단 3초 도달

**설계 의도**:
- 목표 상관계수: 0.45 (꽤 강한 영향)
- 초중반 순위 형성에 중요

#### 4. Guts (근성)
**역할**: 피로 시 최소 속도 바닥 결정

**효과**:
```typescript
fatigueFloor = 0.55 + 0.25 * tGuts
// 범위: 0.55 ~ 0.80
```

**피로 보정 로직**:
```typescript
// 스태미나 85% 이하일 때부터 적용
if (staminaRatio < 0.85) {
  x = staminaRatio / 0.85
  fatigueCurve = pow(x, 0.8)  // 완만한 감소
  fatigueFactor = fatigueFloor + (1 - fatigueFloor) * fatigueCurve
  
  finalTargetSpeed *= fatigueFactor
}
```

**범위**:
- Guts 0: 스태미나 0%일 때 속도 55%까지 감소
- Guts 20: 스태미나 0%일 때 속도 80%까지만 감소

**설계 의도**:
- 목표 상관계수: 0.45 (꽤 강한 영향)
- 후반 스퍼트 능력에 영향

#### 5. Start (출발)
**역할**: 초반 가속 버프 및 출발 딜레이 결정

**효과**:
```typescript
// 초반 가속 버프 (100m까지 적용)
startAccelBoost = 1 + 0.3 * tStart
// Start 0 → 1.0, Start 20 → 1.3

// 출발 딜레이
maxDelay = 1.0 - tStart
startDelay = random(0, maxDelay)
// Start 0: 0~1초, Start 20: 0초
```

**설계 의도**:
- 목표 상관계수: 0.1 (약한 영향)
- 초반 포지션 선점에만 영향, 최종 결과에는 제한적

#### 6. Consistency (안정성)
**역할**: 컨디션 롤 범위 결정 (로또형 운빨 능력치)

**효과**:
```typescript
// Consistency 0: -3% ~ +3% (완전 랜덤)
// Consistency 20: 0% ~ +3% (음수 없음)

normalizedCons = Consistency <= 20 ? Consistency / 20 
                                    : 1.0 + (Consistency - 20) / 40

if (normalizedCons <= 1.0) {
  minBonus = -3% * (1 - normalizedCons)
} else {
  excessCons = normalizedCons - 1.0
  minBonus = excessCons * 0.5 * 3%  // 저점 상승
}

conditionRoll = random(minBonus, 3%)
effectiveStats = baseStats * (1.0 + conditionRoll)
```

**컨디션은 Speed/Stamina/Power/Guts/Start에만 적용** (Consistency 자체에는 미적용)

**설계 의도**:
- 목표 상관계수: -0.25 (높을수록 안정적이지만, 최고값은 나오기 어려움)
- 저투자 = 고위험 고수익
- 고투자 = 저위험 안정적

---

## 말 클래스 구조

### Horse 클래스 주요 속성

#### 기본 능력치
```typescript
baseStats: Stats          // 기본 능력치
effStats: EffectiveStats  // 컨디션 적용 후 능력치
conditionRoll: number     // 컨디션 롤 값 (-3% ~ +3%)
```

#### 파생 파라미터
```typescript
maxSpeed_ms: number           // 최고 속도 (m/s)
maxStamina: number            // 최대 스태미나 (항상 100)
accelFactor: number           // 가속 계수
tSpeedNormalized: number      // Speed 정규화 값
staminaCostFactor: number     // 스태미나 소모 계수
fatigueFloor: number          // 피로 시 최소 속도 바닥
startAccelBoost: number       // 초반 가속 버프
startDelay: number            // 출발 딜레이 (초)
targetAccelTime: number       // 목표 가속 시간 (3~7초)
```

#### 현재 상태
```typescript
currentSpeed: number      // 현재 속도 (m/s)
position: number          // 현재 위치 (m)
stamina: number           // 현재 스태미나
finished: boolean         // 완주 여부
finishTime: number|null   // 완주 시간
raceStartTime: number     // 실제 레이스 시작 시간 (딜레이 반영)
```

#### 순위 추적
```typescript
currentRank: number       // 현재 순위
previousRank: number      // 이전 순위 (추월 감지용)
```

### prepareForRace() - 레이스 준비

**실행 순서**:

1. **컨디션 롤** (Consistency 기반)
   ```typescript
   normalizedCons = normalizeCons(Consistency)
   minBonus = calculateMinBonus(normalizedCons)
   conditionRoll = random(minBonus, COND_MAX_BONUS)
   effStats = baseStats * (1.0 + conditionRoll)
   ```

2. **능력치 정규화** (몰빵 페널티)
   ```typescript
   tSpeed = normalizeStat(effStats.Speed)
   tStamina = normalizeStat(effStats.Stamina)
   tPower = normalizeStat(effStats.Power)
   tGuts = normalizeStat(effStats.Guts)
   tStart = normalizeStat(effStats.Start)
   ```

3. **파생 파라미터 계산**
   ```typescript
   maxSpeed_ms = calculateMaxSpeed(tSpeed)
   staminaCostFactor = calculateStaminaCost(tStamina)
   accelFactor = calculateAccel(tPower)
   targetAccelTime = calculateTargetTime(tPower, tStart)
   fatigueFloor = calculateFatigueFloor(tGuts)
   startAccelBoost = calculateStartBoost(tStart)
   startDelay = random(0, 1.0 - tStart)
   ```

4. **초기 상태 설정**
   ```typescript
   currentSpeed = 0
   position = 0
   stamina = maxStamina
   finished = false
   raceStartTime = startDelay
   ```

### step() - 시뮬레이션 스텝

**0.05초마다 실행되는 핵심 로직**:

#### 1. 출발 딜레이 체크
```typescript
if (currentTime < raceStartTime) {
  return  // 아직 출발 안 함
}
```

#### 2. 완주 체크
```typescript
if (position >= TRACK_REAL_M) {
  finished = true
  finishTime = currentTime
  return
}
```

#### 3. 목표 속도 계산
```typescript
let targetSpeed = maxSpeed_ms

// 위기 탈출 보너스 (순위 4위 이하일 때)
if (escapeCrisisActive) {
  crisisBonus = (escapeCrisisValue / 10) * 0.1  // 6~10%
  targetSpeed *= (1.0 + crisisBonus)
}
```

#### 4. 가속 계수 조정
```typescript
let accel = accelFactor

// 초반 100m까지 Start 버프
if (position < 100) {
  accel *= startAccelBoost
}
```

#### 5. 추월 보너스 적용
```typescript
if (overtakeBonusActive && overtakeCount > 0) {
  speedBonusPerOvertake = (overtakeBonusValue - 6) * 0.005 + 0.01
  // 수치 6→1%, 7→1.5%, 8→2%, 9→2.5%, 10→3%
  
  finalTargetSpeed *= pow(1.0 + speedBonusPerOvertake, overtakeCount)
}
```

#### 6. 스태미나 소모
```typescript
speedForCost = min(currentSpeed, STAMINA_COST_SPEED_CAP_MS)
distanceThisStep = currentSpeed * dt
speedNorm = speedForCost / STAMINA_COST_SPEED_CAP_MS

staminaCostPerM = BASE_STAMINA_COST_PER_M 
                + SPEED_STAMINA_COST_PER_M * speedNorm

speedPenalty = 1.0 + 0.1 * tSpeedNormalized
staminaCostPerM *= speedPenalty

staminaCost = staminaCostPerM * distanceThisStep * staminaCostFactor

stamina -= staminaCost
```

#### 7. 라스트 스퍼트 체크
```typescript
progress = position / TRACK_REAL_M

if (!lastSpurtActive && progress >= lastSpurtTriggerProgress) {
  lastSpurtActive = true  // 피로 보정 무시
}
```

#### 8. 피로 보정
```typescript
fatigueFactor = 1.0

if (!lastSpurtActive && staminaRatio < 0.85) {
  x = staminaRatio / 0.85
  fatigueCurve = pow(x, 0.8)
  fatigueFactor = fatigueFloor + (1 - fatigueFloor) * fatigueCurve
}

finalTargetSpeed *= fatigueFactor
```

#### 9. 로그 램프 가속
```typescript
elapsedTime = currentTime - raceStartTime

logRampFactor = log(1 + accel * elapsedTime) / log(1 + accel * targetAccelTime)
clampedFactor = min(logRampFactor, 1.0)

currentSpeed = finalTargetSpeed * clampedFactor
```

#### 10. 위치 업데이트
```typescript
position += currentSpeed * dt

if (position >= TRACK_REAL_M) {
  finished = true
  finishTime = currentTime
}
```

---

## 레이스 시뮬레이션 로직

### runRace() - 메인 레이스 함수

**입력 옵션**:
```typescript
interface RaceOptions {
  numHorses?: number                           // 참가 말 수 (기본 8)
  horses?: Array<{name: string, stats: Stats}> // 커스텀 말 리스트
  trackDistance?: number                       // 트랙 거리 (기본 500m)
  fixedSpeed?: number                          // Speed 고정 실험용
}
```

**실행 흐름**:

1. **말 생성 및 준비**
   ```typescript
   if (customHorses) {
     // 커스텀 말 사용
     horses = customHorses.map(h => new Horse(h.name, h.stats))
   } else {
     // 랜덤 생성
     horses = generateRandomHorses(numHorses, fixedSpeed)
   }
   
   horses.forEach(h => h.prepareForRace())
   ```

2. **시뮬레이션 루프** (MAX_SIM_TIME까지 또는 전원 완주 시까지)
   ```typescript
   time = 0
   while (time < MAX_SIM_TIME && !allFinished) {
     // 순위 계산 및 업데이트
     currentRanking = calculateRanking(horses)
     horses.forEach(h => h.updateRank(ranking[h.name]))
     
     // 각 말의 스텝 실행
     horses.forEach(h => {
       if (!h.finished) {
         h.step(DT, time)
       }
     })
     
     // 구간 스냅샷 저장
     if (maxProgress >= EARLY_THRESHOLD && !earlySnapshot) {
       earlySnapshot = snapshotOrder(horses)
     }
     if (maxProgress >= MID_THRESHOLD && !midSnapshot) {
       midSnapshot = snapshotOrder(horses)
     }
     
     time += DT
   }
   ```

3. **결과 집계**
   ```typescript
   results = horses
     .sort((a, b) => {
       // 완주자는 기록순, 미완주자는 거리순
       if (a.finished && b.finished) {
         return a.finishTime - b.finishTime
       }
       if (a.finished) return -1
       if (b.finished) return 1
       return b.position - a.position
     })
     .map((h, idx) => ({
       rank: idx + 1,
       horse: h,
       finishTime: h.finishTime,
       position: h.position,
       staminaRatio: h.stamina / h.maxStamina,
       earlyRank: earlyRankMap[h.name],
       midRank: midRankMap[h.name],
       finalRank: idx + 1,
       conditionRoll: h.conditionRoll
     }))
   ```

### 순위 추적 및 업데이트

**updateRank() - 순위 업데이트 및 특수 능력 발동**:

```typescript
updateRank(rank: number) {
  wasFirstUpdate = (currentRank === 999)
  previousRank = currentRank
  currentRank = rank
  
  if (wasFirstUpdate) return  // 첫 업데이트는 스킵
  
  // 추월 보너스 발동
  if (overtakeBonusValue > 0 && currentRank < previousRank) {
    overtakeBonusActive = true
    overtakeCount += 1  // 중첩
    
    // 스태미나 회복 (항상 +3)
    stamina = min(stamina + 3, maxStamina)
    lastStaminaRecovery = 3
  }
  
  // 위기 탈출 발동
  if (escapeCrisisValue > 0 && !escapeCrisisUsed && currentRank >= 4) {
    escapeCrisisActive = true
    escapeCrisisUsed = true  // 1회 제한
  } else {
    escapeCrisisActive = false
  }
}
```

---

## 특수 능력 시스템

### 1. Last Spurt (라스트 스퍼트)

**효과**: 특정 진행률 이후 피로 보정 무시

**발동 조건**:
```typescript
progress >= lastSpurtTriggerProgress
```

**발동 지점 계산**:
```typescript
// abilityValue: 6~10
lastSpurtTriggerProgress = 1.0 - (abilityValue / 10) * 0.2

// 수치 6 → 0.88 (440m에서 발동)
// 수치 7 → 0.86 (430m에서 발동)
// 수치 8 → 0.84 (420m에서 발동)
// 수치 9 → 0.82 (410m에서 발동)
// 수치 10 → 0.80 (400m에서 발동)
```

**효과 상세**:
- 발동 전: 스태미나 85% 이하 시 피로 보정 적용
- 발동 후: `fatigueFactor = 1.0` 고정 (피로 무시)
- **지속 시간**: 발동 후 완주까지 영구 지속

**전략적 의미**:
- Guts가 낮아도 후반 속도 유지 가능
- Stamina 관리 실패 시 역전 가능
- 후반형 빌드의 핵심 증강

### 2. Overtake (추월 보너스)

**효과**: 추월 시마다 속도 증가 + 스태미나 회복 (중첩 가능)

**발동 조건**:
```typescript
currentRank < previousRank  // 순위가 올라감
```

**효과 계산**:
```typescript
// abilityValue: 6~10
speedBonusPerOvertake = (abilityValue - 6) * 0.005 + 0.01

// 수치 6 → 1% 증가/추월
// 수치 7 → 1.5% 증가/추월
// 수치 8 → 2% 증가/추월
// 수치 9 → 2.5% 증가/추월
// 수치 10 → 3% 증가/추월

finalSpeed *= pow(1.0 + speedBonusPerOvertake, overtakeCount)
```

**스태미나 회복**:
```typescript
// 수치와 관계없이 추월당 +3 고정
stamina = min(stamina + 3, maxStamina)
```

**중첩 예시** (수치 10 기준):
- 1회 추월: 속도 +3%, 스태미나 +3
- 2회 추월: 속도 +6.09%, 스태미나 +6
- 3회 추월: 속도 +9.27%, 스태미나 +9
- 5회 추월: 속도 +15.93%, 스태미나 +15

**전략적 의미**:
- 중위권 출발 후 역전 전략에 최적
- Power/Start 투자를 줄이고 후반 스탯에 집중 가능
- 추월 기회가 많을수록 폭발적 성장

### 3. Escape Crisis (위기 탈출)

**효과**: 4위 이하일 때 능력치 증가 (게임당 1회)

**발동 조건**:
```typescript
currentRank >= 4 && !escapeCrisisUsed
```

**효과 계산**:
```typescript
// abilityValue: 6~10
crisisBonus = (abilityValue / 10) * 0.1

// 수치 6 → 6% 증가
// 수치 7 → 7% 증가
// 수치 8 → 8% 증가
// 수치 9 → 9% 증가
// 수치 10 → 10% 증가

targetSpeed *= (1.0 + crisisBonus)
```

**발동 및 해제**:
- 4위 이하가 되면 즉시 발동
- 다시 4위 이하가 되어도 재발동 안 됨 (escapeCrisisUsed = true)

**전략적 의미**:
- 초반 불리한 출발 커버
- Start가 낮은 빌드의 보험
- 1회 제한으로 남용 방지

---

## 증강 시스템

### 개요

증강(Augment) 시스템은 레이스 전에 말의 능력치를 강화하거나 특수 능력을 부여하는 핵심 메타 게임 시스템입니다.

**핵심 특징**:
- **레이스 전 선택**: 레이스 시작 전 3개의 증강 중 1개를 선택
- **슬롯머신 연출**: 등급 추첨을 시각적으로 표현하는 연출 시스템
- **리롤 시스템**: 최대 3회까지 선택지를 다시 뽑을 수 있음
- **공정한 경쟁**: 모든 말이 동일 등급의 증강을 받지만, 플레이어만 선택 가능
- **전략적 선택**: 말의 기본 능력치와 시너지를 고려한 빌드 구성

---

### 증강 등급 시스템

#### 5가지 등급

증강은 5가지 등급으로 나뉘며, 등급이 높을수록 강력한 효과를 제공합니다.

```typescript
type AugmentRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'hidden'
```

**등급별 특징**:

| 등급 | 한글명 | 능력치 범위 | 출현 확률 | 특수 능력 |
|------|--------|-------------|-----------|-----------|
| Common | 일반 | +1 ~ +2 | 35% | 없음 |
| Rare | 레어 | +3 ~ +4 | 25% | 없음 |
| Epic | 영웅 | +5 ~ +6 | 25% | 없음 |
| Legendary | 전설 | +7 ~ +10 | 15% | 15% 확률로 특수 능력 |
| Hidden | 히든 | +6 ~ +10 | 직접 생성 | 항상 특수 능력 |

**등급 시각적 구분**:
- 각 등급은 고유한 색상 테마로 구분
- 상위 등급일수록 화려한 시각 효과

**등급별 가중치**:
```typescript
const AUGMENT_RARITY_WEIGHTS: Record<AugmentRarity, number> = {
  common: 35,      // 35%
  rare: 25,        // 25%
  epic: 25,        // 25%
  legendary: 15,   // 15%
  hidden: 0,       // 특수 조건으로만 생성
}
```

**히든 등급 출현 조건**:
- 전설 등급 추첨 시 15% 확률로 특수 능력 포함
  - 5% 확률: 라스트 스퍼트
  - 5% 확률: 추월 보너스
  - 5% 확률: 위기 탈출

---

### 일반 증강 (능력치 증강)

#### 6가지 능력치 증강

일반 증강은 말의 기본 능력치를 직접 상승시킵니다.

```typescript
type AugmentStatType = 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Consistency'
```

**능력치별 효과**:

| 증강 타입 | 한글명 | 설명 | 시너지 |
|-----------|--------|------|--------|
| Speed | 최고속도 | 최대 속도 증가 | 단거리, 스피드 빌드 |
| Stamina | 지구력 | 체력 소모율 감소 | 장거리, 지구력 빌드 |
| Power | 가속 | 가속도 향상 | 초반 포지션 선점 |
| Guts | 근성 | 후반 속도 유지력 향상 | 라스트 스퍼트 빌드 |
| Start | 출발 | 출발 속도 증가 | 초반 리드 전략 |
| Consistency | 일관성 | 컨디션 변동폭 감소 | 안정적인 성적 |

**능력치 상승량**:
```typescript
const AUGMENT_STAT_VALUES: Record<AugmentRarity, { min: number; max: number }> = {
  common: { min: 1, max: 2 },      // +1 ~ +2
  rare: { min: 3, max: 4 },        // +3 ~ +4
  epic: { min: 5, max: 6 },        // +5 ~ +6
  legendary: { min: 7, max: 10 },  // +7 ~ +10
  hidden: { min: 6, max: 10 },     // +6 ~ +10 (특수 능력 전용)
}
```

**증강 적용 방식**:
```typescript
// 증강을 baseStats에 직접 더함
function applyAugmentsToStats(baseStats: Stats, augments: Augment[]): Stats {
  const result: Stats = { ...baseStats }
  
  for (const augment of augments) {
    if (augment.statType && augment.statValue != null) {
      result[augment.statType] += augment.statValue
    }
  }
  
  return result
}
```

**적용 시점**:
- 증강 선택 후 즉시 baseStats에 반영
- prepareForRace() 호출 시 컨디션 롤 적용
- 몰빵 페널티 적용 (20 초과 시 효율 감소)

**예시**:
```
기본 Speed 15 + 증강 Speed +8 = Speed 23
→ 정규화: 1.0 + (23-20)/40 = 1.075 (효율 감소 적용)
```

---

### 특수 증강 (특수 능력)

#### 3가지 특수 능력 증강

특수 증강은 능력치 상승 대신 특수 능력을 부여합니다.

```typescript
type SpecialAbilityType = 'lastSpurt' | 'overtake' | 'escapeCrisis'
```

**특수 능력 목록**:

| 능력 | 한글명 | 등급 | 수치 범위 | 효과 |
|------|--------|------|-----------|------|
| lastSpurt | 라스트 스퍼트 | Hidden | 6~10 | 후반 피로 무시 |
| overtake | 추월 보너스 | Hidden | 6~10 | 추월 시 속도 증가 + 스태미나 회복 |
| escapeCrisis | 위기 탈출 | Hidden | 6~10 | 4위 이하일 때 능력치 증가 |

**수치별 효과 차이**:

##### 1. 라스트 스퍼트
```typescript
lastSpurtTriggerProgress = 1.0 - (abilityValue / 10) * 0.2

// 수치 6 → 440m (88%) 발동
// 수치 7 → 430m (86%) 발동
// 수치 8 → 420m (84%) 발동
// 수치 9 → 410m (82%) 발동
// 수치 10 → 400m (80%) 발동
```

##### 2. 추월 보너스
```typescript
speedBonusPerOvertake = (abilityValue - 6) * 0.005 + 0.01

// 수치 6 → 1% 속도 증가/추월
// 수치 7 → 1.5% 속도 증가/추월
// 수치 8 → 2% 속도 증가/추월
// 수치 9 → 2.5% 속도 증가/추월
// 수치 10 → 3% 속도 증가/추월

// 스태미나 회복: 수치 무관하게 +3 고정
```

##### 3. 위기 탈출
```typescript
crisisBonus = (abilityValue / 10) * 0.1

// 수치 6 → 6% 능력치 증가
// 수치 7 → 7% 능력치 증가
// 수치 8 → 8% 능력치 증가
// 수치 9 → 9% 능력치 증가
// 수치 10 → 10% 능력치 증가
```

**특수 능력 생성 함수**:

```typescript
// 라스트 스퍼트
function createLastSpurtAugment(): Augment {
  const abilityValue = randomInt(6, 10)
  return {
    id: `lastSpurt-hidden-${abilityValue}-${Date.now()}-${Math.random()}`,
    name: '라스트 스퍼트',
    rarity: 'hidden',
    specialAbility: 'lastSpurt',
    specialAbilityValue: abilityValue,
  }
}

// 추월 보너스
function createOvertakeAugment(): Augment {
  const abilityValue = randomInt(6, 10)
  return {
    id: `overtake-hidden-${abilityValue}-${Date.now()}-${Math.random()}`,
    name: '추월 보너스',
    rarity: 'hidden',
    specialAbility: 'overtake',
    specialAbilityValue: abilityValue,
  }
}

// 위기 탈출
function createEscapeCrisisAugment(): Augment {
  const abilityValue = randomInt(6, 10)
  return {
    id: `escapeCrisis-hidden-${abilityValue}-${Date.now()}-${Math.random()}`,
    name: '위기 탈출',
    rarity: 'hidden',
    specialAbility: 'escapeCrisis',
    specialAbilityValue: abilityValue,
  }
}
```

**특수 능력 적용**:
```typescript
// Horse 클래스에 특수 능력 설정
horse.setSpecialAbility(augment.specialAbility, augment.specialAbilityValue)

// prepareForRace() 호출 후에도 특수 능력 유지
```

---

### 증강 생성 및 확률

#### 증강 선택지 생성 프로세스

**1단계: 등급 추첨**
```typescript
function generateRandomRarity(): AugmentRarity {
  const rarities: AugmentRarity[] = ['common', 'rare', 'epic', 'legendary']
  const weights = [35, 25, 25, 15]  // 백분율
  return weightedRandom(rarities, weights)
}
```

**2단계: 증강 선택지 3개 생성**
```typescript
function generateAugmentChoices(rarity: AugmentRarity): Augment[] {
  const choices: Augment[] = []
  
  // 전설 등급인 경우 15% 확률로 특수 능력 포함
  if (rarity === 'legendary') {
    const roll = Math.random()
    if (roll < 0.05) {
      choices.push(createLastSpurtAugment())
    } else if (roll < 0.1) {
      choices.push(createOvertakeAugment())
    } else if (roll < 0.15) {
      choices.push(createEscapeCrisisAugment())
    }
  }
  
  // 나머지 슬롯을 일반 증강으로 채움
  const availableStats = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Consistency']
  while (choices.length < 3) {
    const statType = randomChoice(availableStats)
    const augment = createAugment(rarity, statType)
    choices.push(augment)
  }
  
  // 순서 섞기
  shuffle(choices)
  
  return choices
}
```

**확률 표**:

| 시나리오 | 확률 | 내용 |
|----------|------|------|
| 일반 증강 3개 | 85% | 전설 등급 포함, 일반 능력치 증강만 |
| 특수 능력 1개 + 일반 2개 | 15% | 전설 등급에서 특수 능력 1개 포함 |
| 라스트 스퍼트 포함 | 5% | 전설 등급의 5% |
| 추월 보너스 포함 | 5% | 전설 등급의 5% |
| 위기 탈출 포함 | 5% | 전설 등급의 5% |

**전체 확률 계산**:
```
특수 능력 획득 확률 = 전설 등급 확률 × 특수 능력 확률
                    = 15% × 15%
                    = 2.25%

각 특수 능력 획득 확률 = 15% × 5% = 0.75%
```

---

### 증강 선택 프로세스

#### 게임 플로우

```
[게임 시작]
    ↓
[등급 추첨 - 슬롯머신 연출 (5초)]
    ↓
[증강 선택지 3개 표시]
    ↓
[플레이어 선택 또는 리롤]
    ↓
[모든 말에게 동일 등급 증강 배분]
    ↓
[능력치 적용 및 HUD 업데이트]
    ↓
[카운트다운 (3, 2, 1, GO!)]
    ↓
[레이스 시작]
```

#### 증강 선택 인터페이스

**표시 형식**:
- 3개의 카드 형태로 제시
- 등급별 시각적 차별화 (색상, 효과)

**카드 정보**:
1. **아이콘**: 능력치 또는 특수 능력 식별
2. **이름**: 증강 이름 (예: "최고속도 +8")
3. **수치**: 능력치 상승량 또는 특수 능력 수치
4. **설명**: 효과 설명
5. **등급 표시**: 등급 시각적 구분

**선택 방식**:
- 3개 중 1개 선택
- 선택 후 확정 필요
- 리롤로 선택지 재생성 가능

---

### 리롤 시스템

#### 리롤 메커니즘

**기본 규칙**:
- 최대 리롤 횟수: 3회
- 리롤 시 동일 등급 내에서 새로운 선택지 생성
- 리롤 후에는 이전 선택지로 돌아갈 수 없음
- 리롤 횟수 소진 시 버튼 비활성화

**리롤 로직**:
```typescript
function reroll() {
  // 리롤 가능 여부 확인
  if (rerollCount >= maxRerolls) return
  
  // 리롤 횟수 증가
  rerollCount++
  
  // 현재 선택 초기화
  selectedAugment = null
  
  // 리롤 횟수 표시 업데이트
  displayRerollCount(maxRerolls - rerollCount, maxRerolls)
  
  // 리롤 소진 시 버튼 비활성화
  if (rerollCount >= maxRerolls) {
    disableRerollButton()
  }
  
  // 새로운 증강 선택지 생성
  augmentChoices = generateAugmentChoices(rarity)
}
```

**리롤 전략**:
1. **1회차**: 특수 능력 또는 고수치 증강 기대
2. **2회차**: 말의 능력치와 시너지 고려
3. **3회차 (마지막)**: 최선의 선택지 확보

**리롤 제한의 의미**:
- 무한 리롤 방지로 게임 템포 유지
- 선택의 중요성 강조
- 운 요소 도입으로 리플레이 가치 증가

---

### AI 증강 배분 시스템

#### 공정 경쟁 원칙

**핵심 규칙**:
- 모든 말이 동일한 등급의 증강을 받음
- 플레이어는 선택 가능, AI는 랜덤 배정
- 히든 등급 선택 시 AI는 91% 확률로 전설 등급 대체

**증강 배분 로직**:
```typescript
function assignAugmentsToAllHorses(rarity: AugmentRarity) {
  for (let i = 0; i < 8; i++) {
    if (i === playerHorseIndex) {
      // 플레이어 말: 선택한 증강 사용
      augments[i] = selectedAugment
    } else {
      // AI 말: 랜덤 증강 배정
      if (rarity === 'hidden') {
        // 히든 등급: 9% 히든, 91% 전설
        const roll = Math.random()
        if (roll < 0.09) {
          // 9% 확률: 히든 등급 특수 능력
          augments[i] = randomChoice([
            createLastSpurtAugment(),
            createOvertakeAugment(),
            createEscapeCrisisAugment(),
          ])
        } else {
          // 91% 확률: 전설 등급
          const choices = generateAugmentChoices('legendary')
          augments[i] = randomChoice(choices)
        }
      } else {
        // 일반 등급: 3개 선택지 중 랜덤
        const choices = generateAugmentChoices(rarity)
        augments[i] = randomChoice(choices)
      }
    }
  }
}
```

**히든 등급 처리 이유**:
- 히든 등급의 특수 능력이 너무 강력하여 밸런스 조정
- AI가 모두 특수 능력을 가지면 플레이어 불리
- 91% 전설 등급으로 희석하여 공정성 확보

**증강 적용 순서**:
```typescript
function applyAugmentsToAllHorses() {
  for (let i = 0; i < horses.length; i++) {
    const horse = horses[i]
    const augments = horseAugments[i]
    
    // 1. 능력치 증강 적용
    horse.baseStats = applyAugmentsToStats(horse.baseStats, augments)
    
    // 2. 특수 능력 설정
    for (const augment of augments) {
      if (augment.specialAbility) {
        horse.setSpecialAbility(
          augment.specialAbility,
          augment.specialAbilityValue
        )
      }
    }
    
    // 3. prepareForRace 재호출 (effStats 재계산)
    horse.prepareForRace()
  }
}
```

---

### 슬롯머신 연출

#### 연출 목적

등급 추첨 과정을 시각적으로 표현하여 긴장감과 흥미를 유발합니다.

**연출 단계**:

##### 1단계: 슬롯머신 등장 (0~0.3초)
- 화면 중앙에 슬롯머신 프레임 표시
- 강조 테두리 효과

##### 2단계: 등급 스크롤 (0.3~5초)
- 등급 텍스트가 위에서 아래로 스크롤
- 점점 느려지는 감속 효과 (Ease-out)
- 4가지 등급을 반복 표시

##### 3단계: 최종 등급 강조 (5~5.6초)
- 선택된 등급에서 정지
- 펄스 확대 애니메이션
- 파티클 폭발 효과

##### 4단계: 전환 (5.6~6.4초)
- 슬롯머신 페이드 아웃
- 증강 선택 화면으로 전환

**총 소요 시간**: 약 6초

---

### 히든 등급 특수 연출

히든 등급 증강은 일반 등장 효과 위에 추가 특수 효과가 적용됩니다.

**추가 효과**:

##### 1. 파티클 수집 효과 (0.3~1.3초)
- 카드 주변에서 중심으로 수렴하는 발광 파티클
- 원형 배치 (16개)
- 금색 계열 효과

##### 2. 별 폭발 효과 (1.3~2.1초)
- 카드 중심에서 외부로 방사되는 별 파티클
- 방사형 배치 (12개)
- 밝은 빛 효과

**연출 차별화**:
- 일반 증강: 기본 페이드 인 효과만
- 히든 증강: 기본 효과 + 파티클 수집 + 별 폭발
- **목적**: 희귀한 특수 능력 획득 시 특별함 강조

---

### 개발자 모드

#### 디버깅 도구

**활성화 방법**:
- 단축키 또는 개발 버튼으로 접근

**제공 기능**:
1. **등급 선택**: 원하는 등급 직접 선택
2. **능력치 지정**: 특정 능력치 증강 생성
3. **수치 조정**: 증강 수치 직접 설정 (1~10)
4. **특수 능력 생성**: 특수 능력 직접 생성
5. **슬롯머신 스킵**: 연출 생략 및 즉시 선택

**생성 파라미터**:
- 등급: Common ~ Hidden
- 타입: 능력치 또는 특수 능력
- 능력치: 6가지 중 선택
- 특수 능력: 3가지 중 선택
- 수치: 1~10 범위

**활용 목적**:
- 특정 조합 테스트
- 밸런스 검증
- 특수 능력 효과 확인
- 데모 및 프레젠테이션
- 개발 중 빠른 반복 테스트

---

### 증강 시스템의 전략적 깊이

#### 빌드 구성 전략

**1. 시너지 증강**
```
Speed 몰빵 빌드 (Speed 20+)
→ Speed +10 증강 선택
→ 최고 속도 극대화
→ 단점: 스태미나 소모 증가

Stamina 지구력 빌드 (Stamina 20+)
→ Stamina +10 증강 선택
→ 장거리 레이스 최적화
→ 단점: 초반 속도 부족
```

**2. 약점 보완**
```
Start가 낮은 빌드
→ Start +10 증강으로 초반 딜레이 감소
→ 또는 위기 탈출로 후반 역전

Consistency가 낮은 빌드
→ Consistency +10 증강으로 안정화
→ 컨디션 리스크 최소화
```

**3. 특수 능력 활용**
```
Guts 낮은 + 라스트 스퍼트
→ 후반 피로 무시로 약점 완전 커버

Power/Start 낮은 + 추월 보너스
→ 중위권 출발 → 추월로 역전

Start 낮은 + 위기 탈출
→ 초반 불리 → 4위 이하에서 능력치 폭발
```

#### 리스크 관리

**고위험 고수익**:
- Consistency 낮은 말 + 일반 증강
- 컨디션 운이 좋으면 압승, 나쁘면 꼴찌
- 레전더리 증강으로 기대값 극대화

**저위험 안정적**:
- Consistency 높은 말 + Consistency 증강
- 컨디션 변동폭 최소화
- 특수 능력으로 상한선 확보

**중간 전략**:
- 밸런스형 말 + 시너지 증강
- 안정적인 중위권 이상 보장
- 상황에 따라 유연한 대응

---

### 증강 시스템의 밸런스 설계

#### 등급 간 밸런스

**기대값 계산**:
```
Common: 평균 +1.5
Rare: 평균 +3.5 (Common 대비 2.33배)
Epic: 평균 +5.5 (Common 대비 3.67배)
Legendary: 평균 +8.5 (Common 대비 5.67배)

특수 능력: 등급 환산 불가 (상황 의존적)
```

**출현 확률 보정**:
```
Common: 35% × 1.5 = 52.5 기대값
Rare: 25% × 3.5 = 87.5 기대값
Epic: 25% × 5.5 = 137.5 기대값
Legendary: 15% × 8.5 = 127.5 기대값

→ Legendary가 Epic보다 낮은 기대값
→ 특수 능력(15% 확률)으로 보상
```

#### 특수 능력 밸런스

**라스트 스퍼트**:
- 발동 시점: 후반 60~100m
- 효과: 피로 보정 무시
- 밸런스: Guts 대체 효과, 후반형 빌드에 필수

**추월 보너스**:
- 발동 조건: 순위 상승 시마다
- 효과: 속도 증가 + 스태미나 회복 (중첩)
- 밸런스: 초반 불리 → 후반 역전, 가장 강력

**위기 탈출**:
- 발동 조건: 4위 이하 (1회 제한)
- 효과: 능력치 6~10% 증가
- 밸런스: 안정적인 보험, Start 낮은 빌드에 유용

#### 몰빵 페널티와의 상호작용

**예시**:
```
Speed 18 + 증강 +10 = Speed 28
→ 정규화: 1.0 + (28-20)/40 = 1.2
→ 비선형 변환: 1.0 + (1.2-1.0)*0.5 = 1.1
→ 효율: 1.1 / 1.4 = 78.6%

Speed 15 + 증강 +10 = Speed 25
→ 정규화: 1.0 + (25-20)/40 = 1.125
→ 비선형 변환: 1.0 + (1.125-1.0)*0.5 = 1.0625
→ 효율: 1.0625 / 1.25 = 85%

→ 중간 능력치에 증강을 투자하는 것이 더 효율적
```

---

### 증강 시스템 개선 제안

#### 현재 문제점

1. **증강 선택지 중복**
   - 같은 능력치가 여러 번 나올 수 있음
   - 선택의 다양성 부족

2. **특수 능력 희소성**
   - 전체 확률 2.25%로 너무 낮음
   - 대부분의 게임에서 경험 불가

3. **AI 증강 불투명성**
   - 상대 말의 증강 정보를 알 수 없음
   - 전략적 예측 불가

#### 개선 방안

**1. 중복 방지 시스템**
```typescript
// 이미 나온 능력치 제외
const usedStats = new Set<AugmentStatType>()

while (choices.length < 3) {
  let statType = randomChoice(availableStats)
  
  // 중복 체크
  while (usedStats.has(statType)) {
    statType = randomChoice(availableStats)
  }
  
  usedStats.add(statType)
  choices.push(createAugment(rarity, statType))
}
```

**2. 특수 능력 확률 조정**
```typescript
// 옵션 1: 전설 등급 확률 증가
const AUGMENT_RARITY_WEIGHTS = {
  common: 30,      // 35% → 30%
  rare: 25,
  epic: 25,
  legendary: 20,   // 15% → 20%
  hidden: 0,
}

// 옵션 2: 특수 능력 확률 증가
if (rarity === 'legendary') {
  const roll = Math.random()
  if (roll < 0.1) {        // 5% → 10%
    choices.push(createLastSpurtAugment())
  } else if (roll < 0.2) { // 5% → 10%
    choices.push(createOvertakeAugment())
  } else if (roll < 0.3) { // 5% → 10%
    choices.push(createEscapeCrisisAugment())
  }
}

// 최종 확률: 20% × 30% = 6% (기존 2.25%의 2.67배)
```

**3. AI 증강 정보 표시**
```typescript
// 레이스 결과 화면에 각 말의 증강 표시
interface RaceRanking {
  rank: number
  name: string
  time: number
  augments: Augment[]  // 증강 정보 추가
}

// HUD에 실시간 증강 효과 표시
// 예: "Horse_3: 라스트 스퍼트 발동!"
```

**4. 증강 조합 시스템**
```typescript
// 여러 개의 증강을 선택할 수 있는 시스템
// 예: 레이스 3개마다 1개씩 선택, 최대 3개 보유
interface AugmentSet {
  augments: Augment[]
  maxSlots: number
}

// 시너지 효과
// 예: Speed +5 + Power +5 = 추가 가속 보너스
```

---

## 밸런스 분석 시스템

### 1. 단일 레이스 분석 (analyzeRaceResults)

**목적**: 해당 레이스에서 어떤 스탯이 유리했는지 분석

**방법론**:
```typescript
// 상위 3위와 하위 3위의 스탯 평균 비교
topHorses = results.slice(0, 3)
bottomHorses = results.slice(-3)

avgTop = calculateAvgStats(topHorses)
avgBottom = calculateAvgStats(bottomHorses)

diff = avgTop - avgBottom
```

**해석 기준**:
- `|diff| < 0.3`: 영향 거의 없음
- `0.3 <= |diff| < 0.8`: 약한 영향
- `0.8 <= |diff| < 1.0`: 중간 영향
- `|diff| >= 1.0`: 강한 영향

**출력 예시**:
```
이번 판에서 특히 잘 먹힌 스탯: Speed(속도), Power(가속)
상위권에서 살짝 우세했던 스탯: Stamina(지구력)
오히려 높다고 좋은 건 아니었던 스탯: Consistency(안정성)
```

### 2. 전역 메타 분석 (simulateStatImpact)

**목적**: 수백~수천 판을 돌려 전체 메타에서 각 스탯의 중요도 파악

**방법론**:
```typescript
// 각 스탯과 성능(기록)의 상관계수 계산
for each race:
  for each horse:
    perf = -finishTime  // 기록이 짧을수록 높은 성능
    
    // 피어슨 상관계수 계산용 누적
    sumStat += stat
    sumStatSq += stat * stat
    sumPerf += perf
    sumPerfSq += perf * perf
    sumStatPerf += stat * perf

correlation = cov(stat, perf) / (stdDev(stat) * stdDev(perf))
```

**설계 목표 상관계수** (Design Target):
```typescript
Speed: 0.35        // 중간 영향
Stamina: 0.5       // 가장 중요
Power: 0.45        // 꽤 중요
Guts: 0.45         // 꽤 중요
Start: 0.1         // 약한 영향
Consistency: -0.25 // 높을수록 안정적 (음의 상관)
```

**상관계수 해석**:
- `|corr| < 0.1`: 거의 영향 없음
- `0.1 <= |corr| < 0.25`: 약한 영향
- `0.25 <= |corr| < 0.4`: 중간 영향
- `0.4 <= |corr| < 0.6`: 꽤 강한 영향
- `|corr| >= 0.6`: 매우 강한 핵심 스탯

**Gap 분석**:
```typescript
gap = actualCorrelation - designTarget

// Gap이 크면 밸런스 조정 필요
// Gap > 0: 의도보다 강함 → 너프 필요
// Gap < 0: 의도보다 약함 → 버프 필요
```

### 3. Speed 고정 메타 분석 (simulateStatImpactFixedSpeed)

**목적**: Speed OP 문제 분리 분석

**방법**:
```typescript
// 모든 말의 Speed를 동일하게 고정
for each horse:
  stats.Speed = fixedSpeed
  // 나머지 스탯은 랜덤 분배

// 이후 동일한 상관계수 분석 수행
```

**활용**:
- Speed의 영향력을 제거한 순수 나머지 스탯 메타 파악
- Speed 밸런스 조정 시 참고 자료
- 비교 분석: 기본 분석 vs Speed 고정 분석

---

## 경마 고증 분석 및 개선 제안

### 현실 경마와의 차이점

#### 1. **트랙 거리 문제**

**현재**: 500m (매우 짧은 단거리)

**현실**:
- 단거리: 1000m ~ 1400m
- 중거리: 1600m ~ 2000m (가장 일반적)
- 장거리: 2400m ~ 3200m

**문제점**:
- 500m는 실제 경마에 존재하지 않는 거리
- 너무 짧아서 전략적 깊이가 부족할 수 있음
- 스태미나의 중요도가 과소평가될 가능성

**개선 제안**:
```typescript
// 옵션 1: 거리 연장
TRACK_REAL_M = 1200  // 단거리 레이스

// 옵션 2: 다양한 거리 지원
enum TrackDistance {
  Sprint = 1000,      // 스프린트
  Short = 1400,       // 단거리
  Mile = 1600,        // 마일
  Middle = 2000,      // 중거리
  Long = 2400,        // 장거리
  Marathon = 3200     // 초장거리
}

// 거리별 스탯 밸런스 조정
// - 단거리: Speed, Power 중요도 증가
// - 장거리: Stamina, Guts 중요도 증가
```

#### 2. **속도 범위 문제**

**현재**: 58-68 km/h (평균 속도 기준)

**현실**:
- 경주마 평균 속도: 60-65 km/h
- 최고 속도: 70-75 km/h (단거리 스프린트)
- 순간 최고 속도: 80+ km/h 가능

**문제점**:
- 최고 속도가 다소 낮게 설정됨
- 속도 편차가 10 km/h로 현실보다 큼 (실제는 개체 간 5-8 km/h 차이)

**개선 제안**:
```typescript
// 옵션 1: 속도 범위 조정
MIN_SPEED_KMH = 62  // 느린 말
MAX_SPEED_KMH = 70  // 빠른 말

// 옵션 2: 순간 최고 속도 vs 평균 속도 구분
BASE_SPEED_KMH = 63          // 평균 속도
MAX_SPEED_BURST_KMH = 75     // 순간 최고 속도 (라스트 스퍼트 시)
BURST_STAMINA_COST = 2.0     // 최고 속도 시 스태미나 2배 소모
```

#### 3. **출발 딜레이 문제**

**현재**: 0~1초 랜덤 딜레이 (Start 스탯에 따라)

**현실**:
- 게이트 출발은 거의 동시 (±0.1초 이내)
- 출발 실수는 극히 드묾
- 차이는 게이트를 나서는 반응 속도 (±0.2초)

**문제점**:
- 1초 딜레이는 500m 레이스에서 너무 큼 (16-18m 차이)
- 현실성이 떨어짐

**개선 제안**:
```typescript
// 옵션 1: 딜레이 대폭 축소
maxDelay = 0.2 - tStart * 0.2  // Start 0 → 0~0.2초, Start 20 → 0초

// 옵션 2: 출발 반응 속도로 변경 (딜레이 제거)
// Start가 높으면 초반 0.5초간 추가 가속력
if (elapsedTime < 0.5) {
  startReactionBonus = 1.0 + 0.5 * tStart  // Start 20일 때 50% 추가 가속
  accel *= startReactionBonus
}
```

#### 4. **추월 시 스태미나 회복 문제**

**현재**: 추월할 때마다 스태미나 +3 회복

**현실**:
- 추월은 오히려 더 많은 체력 소모
- 앞말을 따라잡기 위해 가속 필요
- 회복은 불가능 (체력은 소모만 됨)

**문제점**:
- 비현실적 메커니즘
- 추월이 이득이 되어 게임 플레이가 왜곡됨

**개선 제안**:
```typescript
// 옵션 1: 스태미나 회복 제거
if (overtakeBonusValue > 0 && currentRank < previousRank) {
  overtakeBonusActive = true
  overtakeCount += 1
  // stamina += 3  <- 제거
  
  // 대신 추월 성공 시 일시적 속도 버프
  overtakeSpeedBuff = 1.0 + (overtakeBonusValue / 10) * 0.05
  overtakeBuffDuration = 2.0  // 2초간 지속
}

// 옵션 2: 심리적 효과로 재해석
// "추월 성공으로 인한 사기 상승" → 페이스 효율 증가
if (overtakeSuccess) {
  staminaCostFactor *= 0.95  // 5% 소모 감소 (간접적 회복 효과)
  // 또는
  fatigueFloor += 0.05       // 피로 저항력 증가
}
```

#### 5. **피로 보정 시작점 문제**

**현재**: 스태미나 85% 이하부터 피로 적용

**현실**:
- 경주마는 초반부터 서서히 피로 누적
- 60-70% 지점부터 체감 가능한 속도 저하
- 50% 이하에서 급격한 페이스 다운

**문제점**:
- 85%는 너무 높아 초중반 피로가 거의 없음
- Stamina와 Guts의 차별성이 부족

**개선 제안**:
```typescript
// 옵션 1: 구간별 피로 보정
if (staminaRatio > 0.7) {
  fatigueFactor = 1.0 - 0.05 * (1 - staminaRatio / 0.85)  // 미세한 감소
} else if (staminaRatio > 0.3) {
  // 중간 피로 (선형)
  x = (staminaRatio - 0.3) / 0.4
  fatigueFactor = 0.85 - (0.85 - fatigueFloor) * 0.5 * (1 - x)
} else {
  // 극심한 피로 (급격한 감소)
  x = staminaRatio / 0.3
  fatigueFactor = fatigueFloor * x
}

// 옵션 2: 거리 기반 피로
// 전체 거리 대비 누적 피로
totalFatigue = 0
fatigue += (currentSpeed / maxSpeed) * dt * 0.5  // 속도에 비례한 피로 누적
fatigueFactor = 1.0 - totalFatigue * (1 - fatigueFloor)
```

#### 6. **라스트 스퍼트 발동 시점 문제**

**현재**: 80-88% 지점 (400-440m)

**현실**:
- 실제 경마의 라스트 스퍼트는 마지막 200-300m (전체 거리의 10-20%)
- 1600m 레이스 기준: 1300-1400m 지점부터 (81-87%)
- 2000m 레이스 기준: 1700-1800m 지점부터 (85-90%)

**문제점**:
- 500m 기준 80-88%는 실제로 100-60m 남은 지점
- 60-100m는 라스트 스퍼트치고는 너무 긴 구간
- 500m 레이스에서는 라스트 스퍼트가 80-90% 구간이 아니라 90-95% 구간에서 발동되어야 자연스러움

**개선 제안**:
```typescript
// 옵션 1: 거리 기반 발동 (% 대신 m 기준)
lastSpurtTriggerDistance = TRACK_REAL_M - (100 - abilityValue * 5)
// 수치 6 → 마지막 70m (430m 지점)
// 수치 10 → 마지막 50m (450m 지점)

// 옵션 2: 트랙 길이별 동적 조정
if (TRACK_REAL_M <= 1000) {
  // 단거리: 마지막 10-15%
  lastSpurtTriggerProgress = 0.85 + (abilityValue - 6) / 40 * 0.1
} else {
  // 중장거리: 마지막 15-20%
  lastSpurtTriggerProgress = 0.80 + (abilityValue - 6) / 40 * 0.1
}
```

#### 7. **가속 로직 문제**

**현재**: 로그 램프 가속 (3-7초에 걸쳐 점진적 가속)

**현실**:
- 경주마는 게이트 출발 후 약 2-3초 내에 최고 속도의 90%에 도달
- 이후 약 5-10초에 걸쳐 최고 속도의 95-100%로 미세 조정
- 전체 가속 시간: 약 5-10초 (단거리는 더 짧음)

**문제점**:
- Power 0일 때 7초는 500m 레이스에는 너무 긴 시간
- 7초면 이미 110-130m 이상 진행 (전체의 22-26%)

**개선 제안**:
```typescript
// 옵션 1: 가속 시간 단축
targetAccelTime = 5.0 - (tPower + tStart) * 1.5
// Power 0 + Start 0: 5초
// Power 20 + Start 20: 2초

// 옵션 2: 2단계 가속 시스템
// 1단계: 급가속 (0-90% 속도, 2-3초)
// 2단계: 미세 조정 (90-100% 속도, 3-5초)
if (elapsedTime < quickAccelTime) {
  // 1단계: 빠른 가속
  factor = pow(elapsedTime / quickAccelTime, 0.5)
  currentSpeed = targetSpeed * 0.9 * factor
} else {
  // 2단계: 완만한 수렴
  remainingTime = elapsedTime - quickAccelTime
  factor = log(1 + accel * remainingTime) / log(1 + accel * fineAccelTime)
  currentSpeed = targetSpeed * (0.9 + 0.1 * factor)
}
```

#### 8. **컨디션 시스템 문제**

**현재**: 매 레이스마다 -3% ~ +3% 랜덤 컨디션 롤

**현실**:
- 말의 컨디션은 하루 단위로 변동 (당일 여러 레이스를 뛰지 않음)
- 컨디션 변동 폭은 ±5-10% 정도로 더 큼
- 부상, 질병, 컨디션 난조 등 특수 상황에서는 -20% 이상도 가능

**문제점**:
- ±3%는 너무 작은 변동폭
- Consistency의 중요도가 낮아짐

**개선 제안**:
```typescript
// 옵션 1: 컨디션 범위 확대
COND_MIN_BONUS = -0.08  // 최소 -8%
COND_MAX_BONUS = 0.08   // 최대 +8%

// Consistency 0: -8% ~ +8% (매우 위험)
// Consistency 10: -4% ~ +8% (중간)
// Consistency 20: 0% ~ +8% (안정적)

// 옵션 2: 컨디션 등급 시스템
enum ConditionGrade {
  Terrible = -0.15,    // 최악 (1% 확률)
  Poor = -0.08,        // 나쁨 (9% 확률)
  BelowAverage = -0.03,// 평균 이하 (20% 확률)
  Average = 0.0,       // 평균 (40% 확률)
  Good = 0.05,         // 좋음 (20% 확률)
  Excellent = 0.10,    // 매우 좋음 (9% 확률)
  Perfect = 0.15       // 완벽 (1% 확률)
}

// Consistency가 높으면 나쁜 등급 확률 감소
```

#### 9. **스태미나 시스템 문제**

**현재**: 모든 말이 최대 스태미나 100으로 동일

**현실**:
- 말마다 체력 총량이 다름 (지구력 스탯의 차이)
- 소모 효율만 다른 것이 아니라, 총량 자체도 다름

**문제점**:
- Stamina가 "소모 효율"만 관여하여 직관적이지 않음
- "지구력이 높다" = "오래 달릴 수 있다"가 더 직관적

**개선 제안**:
```typescript
// 옵션 1: 최대 스태미나도 Stamina 스탯 반영
maxStamina = 80 + 40 * tStamina  // Stamina 0 → 80, Stamina 20 → 120
staminaCostFactor = 1.0  // 소모 효율은 동일하게

// 옵션 2: 최대 스태미나와 소모 효율 모두 반영 (혼합)
maxStamina = 90 + 20 * tStamina  // Stamina 0 → 90, Stamina 20 → 110
staminaCostFactor = 1.0 - 0.3 * tStamina  // 소모 효율도 30% 개선

// 이렇게 하면 Stamina 투자의 체감이 더 명확해짐
```

#### 10. **Guts (근성) 개념 문제**

**현재**: 피로 시 최소 속도 바닥 결정

**현실**:
- 근성은 "고통을 참고 끝까지 달리는 정신력"
- 실제로는 후반 지쳤을 때 얼마나 속도를 유지하는가
- 또는 접전에서 경쟁심이 발동하는가

**문제점**:
- 현재 구현은 나쁘지 않지만, "정신력"이라는 추상적 개념을 잘 표현하지 못함

**개선 제안**:
```typescript
// 옵션 1: 접전 보너스 추가
// 앞말과의 거리가 5m 이내일 때 Guts 발동
distanceToLeader = leaderPosition - currentPosition
if (distanceToLeader < 5.0 && distanceToLeader > 0) {
  gutsBonus = 1.0 + 0.1 * tGuts  // Guts 20일 때 10% 속도 증가
  targetSpeed *= gutsBonus
}

// 옵션 2: 역경 극복
// 순위가 예상보다 낮을 때 Guts 발동
expectedRank = calculateExpectedRank(stats)
if (currentRank > expectedRank + 2) {
  gutsRecovery = tGuts * 0.5  // Guts 20일 때 초당 10 스태미나 회복
  stamina += gutsRecovery * dt
}

// 기존 fatigueFloor 로직과 병행
```

### 게임 플레이 관점 개선 제안

#### 11. **날씨 시스템 추가**

**제안**: 날씨에 따른 컨디션 변동 및 스탯 영향

```typescript
enum Weather {
  Sunny,      // 맑음 (기본)
  Cloudy,     // 흐림 (영향 미미)
  Rainy,      // 비 (Speed 감소, Power 중요도 증가)
  Heavy,      // 폭우 (Speed 대폭 감소, Guts 중요도 증가)
  Hot,        // 더움 (Stamina 소모 증가)
  Cold        // 추움 (가속 느려짐)
}

// 날씨별 보정
switch (weather) {
  case Weather.Rainy:
    maxSpeed_ms *= 0.95        // 속도 5% 감소
    staminaCost *= 1.1         // 스태미나 10% 증가 소모
    accelFactor *= 1.15        // 가속력 중요도 증가
    break
  case Weather.Heavy:
    maxSpeed_ms *= 0.85        // 속도 15% 감소
    fatigueFloor += 0.1        // Guts 중요도 증가
    break
  case Weather.Hot:
    staminaCost *= 1.25        // 스태미나 25% 증가 소모
    break
}
```

#### 12. **트랙 상태 시스템**

**제안**: 트랙 컨디션에 따른 게임 플레이 변화

```typescript
enum TrackCondition {
  Firm,       // 양호 (기본)
  Good,       // 좋음 (Speed 약간 증가)
  Yielding,   // 다소 무거움 (Power 중요)
  Soft,       // 무거움 (Stamina 중요)
  Heavy       // 매우 무거움 (Guts 중요)
}

// 트랙별 보정
switch (trackCondition) {
  case TrackCondition.Good:
    maxSpeed_ms *= 1.03
    break
  case TrackCondition.Soft:
    accelFactor *= 0.85
    staminaCost *= 1.15
    break
  case TrackCondition.Heavy:
    accelFactor *= 0.7
    staminaCost *= 1.3
    fatigueFloor += 0.1
    break
}
```

#### 13. **기수 능력 시스템**

**제안**: 기수의 능력이 말의 성능에 영향

```typescript
interface Jockey {
  name: string
  skill: number          // 0-100
  weight: number         // kg (49-60)
  specialization: 'Sprint' | 'Middle' | 'Long'
}

// 기수 효과
jockeySkillBonus = 0.9 + (jockey.skill / 100) * 0.2  // 0.9 ~ 1.1
allStats *= jockeySkillBonus

// 체중 패널티
weightPenalty = 1.0 - (jockey.weight - 50) / 100  // 49kg → +1%, 60kg → -10%
maxSpeed_ms *= weightPenalty
accelFactor *= weightPenalty

// 특화 거리 보너스
if (jockey.specialization matches trackDistance) {
  strategyBonus = 1.05  // 5% 보너스
  staminaCostFactor *= 0.95
}
```

#### 14. **말 성장 시스템**

**제안**: 레이스 경험을 통한 능력치 성장

```typescript
interface HorseProgress {
  totalRaces: number
  wins: number
  top3Finishes: number
  experience: number
  
  // 경험치로 능력치 상승
  statGrowth: Partial<Stats>
}

// 레이스 후 경험치 획득
function gainExperience(rank: number, totalHorses: number) {
  baseExp = 10
  rankBonus = (totalHorses - rank + 1) * 5
  return baseExp + rankBonus
}

// 레벨업 시 능력치 증가
function levelUp(progress: HorseProgress): Partial<Stats> {
  level = Math.floor(progress.experience / 100)
  
  return {
    Speed: level * 0.1,
    Stamina: level * 0.15,
    Power: level * 0.1,
    // ...
  }
}
```

### 기술적 개선 제안

#### 15. **물리 기반 시뮬레이션 개선**

**현재 문제**: 속도가 목표 속도를 즉시 추종하여 비현실적

**개선 제안**: 가속도 기반 물리 시뮬레이션

```typescript
// 현재: 속도 직접 설정
currentSpeed = finalTargetSpeed * clampedFactor

// 개선: 가속도 기반
const acceleration = (finalTargetSpeed - currentSpeed) / dt * accelFactor
const maxAcceleration = 5.0  // m/s^2 (현실적 한계)
const clampedAccel = clamp(acceleration, -maxAcceleration, maxAcceleration)

currentSpeed += clampedAccel * dt
currentSpeed = clamp(currentSpeed, 0, finalTargetSpeed)
```

#### 16. **충돌 및 위치 시스템**

**현재 문제**: 말들이 서로 겹쳐서 달림 (위치 개념 없음)

**개선 제안**: 레인 시스템 또는 충돌 회피

```typescript
interface HorsePosition {
  distance: number  // 진행 거리
  lane: number      // 레인 위치 (1-8)
}

// 앞말과 너무 가까우면 속도 제한
function checkCollision(horse: Horse, allHorses: Horse[]) {
  horsesInSameLane = allHorses.filter(h => 
    h.lane === horse.lane && 
    h.distance > horse.distance &&
    h.distance - horse.distance < 2.0  // 2m 이내
  )
  
  if (horsesInSameLane.length > 0) {
    leadHorse = horsesInSameLane[0]
    maxSpeed = leadHorse.currentSpeed * 0.95  // 앞말보다 5% 느리게
    horse.currentSpeed = Math.min(horse.currentSpeed, maxSpeed)
  }
}

// 추월 시 레인 변경
function tryOvertake(horse: Horse) {
  if (canChangeLane(horse)) {
    horse.lane += (Math.random() < 0.5 ? -1 : 1)
    horse.lane = clamp(horse.lane, 1, 8)
  }
}
```

#### 17. **시각적 피드백 개선**

**제안**: 게임 상태를 더 명확하게 표현

```typescript
interface VisualEffects {
  // 특수 능력 발동 표시
  lastSpurtEffect: boolean
  overtakeEffect: boolean
  crisisEffect: boolean
  
  // 상태 표시
  fatigueLevel: 'Fresh' | 'Normal' | 'Tired' | 'Exhausted'
  staminaPercentage: number
  speedPercentage: number
  
  // 위치 표시
  distanceToLeader: number
  distanceToNext: number
}

function getFatigueLevel(staminaRatio: number): string {
  if (staminaRatio > 0.7) return 'Fresh'
  if (staminaRatio > 0.4) return 'Normal'
  if (staminaRatio > 0.15) return 'Tired'
  return 'Exhausted'
}
```

### 밸런스 조정 우선순위

#### 높은 우선순위 (즉시 적용 권장)
1. **출발 딜레이 축소** (1초 → 0.2초)
2. **추월 시 스태미나 회복 제거** (비현실적)
3. **가속 시간 단축** (7초 → 5초)

#### 중간 우선순위 (검토 후 적용)
4. **트랙 거리 연장** (500m → 1200m)
5. **피로 보정 시작점 하향** (85% → 70%)
6. **컨디션 범위 확대** (±3% → ±8%)

#### 낮은 우선순위 (장기 개선)
7. **날씨/트랙 시스템 추가**
8. **기수 시스템 추가**
9. **성장 시스템 추가**
10. **충돌/레인 시스템 추가**

---

## 결론

Hybrid Horse Race는 경마를 모티브로 하되 **게임적 재미**를 우선시한 설계입니다.

### 강점
- 6가지 능력치의 명확한 역할 분담
- 몰빵 방지 시스템으로 전략적 깊이 제공
- 특수 능력을 통한 역전 드라마
- 컨디션 시스템으로 매 판마다 신선함
- **증강 시스템으로 메타 게임 제공** (5가지 등급, 리롤, 특수 능력)
- 슬롯머신 연출 등 화려한 비주얼 피드백
- 체계적인 밸런스 분석 도구

### 약점 (현실성 관점)
- 일부 메커니즘이 비현실적 (추월 시 회복 등)
- 트랙 거리가 너무 짧음
- 출발 딜레이가 과도함
- 충돌/위치 개념 부재

### 최종 권고
**"경마 시뮬레이터"를 목표로 한다면** → 고증 개선 제안 적극 반영  
**"경마 테마 게임"을 목표로 한다면** → 현재 설계 유지하되 밸런스만 조정

게임의 목표와 타겟 유저에 따라 적절한 수준의 현실성을 선택하는 것이 중요합니다.

---

**문서 버전**: 1.1.0  
**최종 수정일**: 2025-01-01  
**작성자**: Hybrid Horse Race Development Team

**변경 이력**:
- v1.1.0 (2025-01-01): 증강 시스템 전체 문서화 추가
- v1.0.0 (2025-01-01): 초기 버전 (레이스 시뮬레이션 및 능력치 시스템)

