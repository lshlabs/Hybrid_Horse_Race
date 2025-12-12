# 경마 시뮬레이터 능력치 & 계산식 설계 문서

> 버전: v2.0 (현재 구현 기준)  
> 전제: **최대 8명**까지 참여 가능한 내기/뽑기용 경마 시뮬레이터  
> 목표: **공정한 뽑기 + 약간의 운빨**, 고증을 어느 정도 반영한 속도 설계

---

## 0. 전역 설정

### 0.1. 스탯 & 총합 규칙

- 말 하나당 스탯 6개:
  - **Speed**: 최고속도
  - **Stamina**: 지구력
  - **Power**: 가속/추월력
  - **Guts**: 막판 근성
  - **Start**: 출발 능력
  - **Consistency**: 컨디션 기복(운빨 정도)
- 각 스탯 범위: **1 ~ 20**
- 말 하나당 **스탯 총합 = 90**

### 0.2. 스탯 생성 규칙 (랜덤 분배)

1. 각 스탯에 **기본값 8**을 부여  
   → 6개 × 8 = 48
2. 남은 **42포인트(= 90 - 48)** 를 랜덤으로 분배
   - 매 포인트마다 스탯 하나를 랜덤으로 골라 +1
   - 단, 해당 스탯이 **20을 초과하지 않도록** 제한

> 결과  
> - 각 스탯은 대략 **8 ~ 18** 구간에 존재  
> - 총합은 항상 **90**으로 동일 → 재능 총량은 공정  
> - 분배 방식에 따라 말의 성향(스피드형, 탱커형, 로또형 등)이 자동으로 다양해짐

### 0.3. 트랙 & 속도 고증 설정

- 실제 경주마 최고속도 범위:
  - `MIN_SPEED_KMH = 58`  
  - `MAX_SPEED_KMH = 68`
- 트랙 설정:
  - 실제 거리: `TRACK_REAL_M = 500` (500m 레이스)
- 시간 단위:
  - `dt`: 초 단위 프레임 시간 (0.05s)

---

## 1. Speed – 최고속도

### 1.1. 역할

- 말의 **이론상 최고속도**를 결정.
- "이 말이 기본적으로 빠른 말인가?"를 정의하는 핵심 스탯.
- Speed가 높을수록 스태미나 소모 페널티가 있음.

### 1.2. 수식

1. 정규화 (0 ~ 1)
    ```
    t_speed = Speed / 20
    ```

2. 비선형 변환 (몰빵 방지)
    ```
    t_speedEff = t_speed^0.65
    ```

3. km/h 단위 최고속도
    ```
    maxSpeed_kmh = 58 + (68 - 58) × t_speedEff
    ```
    - Speed = 0: 58 km/h
    - Speed = 20: 68 km/h

4. m/s 변환
    ```
    maxSpeed_ms = maxSpeed_kmh × 1000 / 3600
    ```

### 1.3. 스태미나 소모 페널티

- Speed 스탯이 높을수록 추가 스태미나 소모
    ```
    speedPenalty = 1.0 + 0.1 × t_speed
    ```
    - Speed = 0: +0% (페널티 없음)
    - Speed = 20: +10% 추가 소모

---

## 2. Stamina – 지구력

### 2.1. 역할

- **스태미나 소모 효율**을 결정.
- Stamina가 높을수록 같은 거리를 달려도 스태미나를 덜 소모.
- 최대 스태미나는 모든 말 동일하게 100.

### 2.2. 수식

1. 최대 스태미나
    ```
    maxStamina = 100  // 모든 말 동일
    ```

2. 스태미나 소모 효율
    ```
    t_stamina = Stamina / 20
    staminaCostFactor = 1.0 - 0.55 × t_stamina
    ```
    - Stamina = 0: 1.0 (100% 소모, 효율 없음)
    - Stamina = 20: 0.45 (45% 소모, 55% 절약)

3. 스태미나 소모 계산
    ```
    staminaCost = baseStaminaCost × staminaCostFactor
    ```

---

## 3. Power – 가속 & 추월력

### 3.1. 역할

- **목표 속도까지 얼마나 빨리 붙는지**를 담당.
- 추월 상황에서 "치고 나가는 느낌"을 만드는 주요 스탯.

### 3.2. 수식

1. 정규화
    ```
    t_power = Power / 20
    ```

2. 가속 계수
    ```
    ACCEL_MIN = 0.03
    ACCEL_MAX = 0.8

    accelFactor = ACCEL_MIN + (ACCEL_MAX - ACCEL_MIN) × t_power
    ```
    - Power = 0: 0.03 (매우 느린 가속)
    - Power = 20: 0.8 (매우 빠른 가속)

3. 매 프레임 속도 갱신
    ```
    currentSpeed = currentSpeed + (targetSpeed - currentSpeed) × accelFactor
    ```

> Power가 높을수록 목표 속도에 빨리 근접 → 스타트, 추월 시 체감이 좋음.

---

## 4. Guts – 막판 근성

### 4.1. 역할

- 스태미나가 부족하거나 바닥났을 때 **속도를 얼마나 유지할 수 있는지** 결정.
- "막판에 그대로 뻗어버릴지, 끝까지 버틸지"를 가르는 스탯.

### 4.2. 수식

1. 피로 시 최소 속도 바닥
    ```
    t_guts = Guts / 20
    fatigueFloor = 0.55 + 0.25 × t_guts
    ```
    - Guts = 0: 0.55 (최대 속도의 55%까지 떨어짐)
    - Guts = 20: 0.8 (최대 속도의 80%까지 유지)

2. 피로 보정 계산
    ```
    staminaRatio = stamina / maxStamina
    
    if (staminaRatio < 0.92) {
      x = staminaRatio / 0.92
      fatigueCurve = x^0.6
      fatigueFactor = fatigueFloor + (1 - fatigueFloor) × fatigueCurve
      currentSpeed ×= fatigueFactor
    }
    ```

> 스태가 충분할 때는 Guts 영향이 거의 없고,  
> 스태가 떨어지면 Guts가 높은 말일수록 "막판에 더 버티는" 연출이 가능.

---

## 5. Start – 출발 능력

### 5.1. 역할

- **초반 가속 버프**와 **출발 딜레이**를 결정.
- 초반 "스타트 싸움"의 핵심 요소.

### 5.2. 수식

1. 정규화
    ```
    t_start = Start / 20
    ```

2. 초반 가속 버프
    ```
    startAccelBoost = 1.0 + 0.5 × t_start
    ```
    - Start = 0: 1.0 (버프 없음)
    - Start = 20: 1.5 (50% 버프)
    - 적용 구간: 초반 100m

3. 출발 딜레이
    ```
    maxDelay = 1.0 - t_start
    startDelay = random(0, maxDelay)
    ```
    - Start = 0: 0~1.0초 딜레이
    - Start = 10: 0~0.5초 딜레이
    - Start = 20: 0초 딜레이 (즉시 출발)

4. 초반 가속 적용
    ```
    if (position < 100m) {
      accel ×= startAccelBoost
    }
    ```

> Start가 높으면 초반에 목표 속도에 더 빨리 도달하고, 출발 딜레이도 없음.

---

## 6. Consistency – 컨디션 기복

### 6.1. 역할

- 판마다 말의 성능이 **얼마나 출렁이는지(운빨 정도)**를 결정.
- 뽑기/내기 게임에서 "로또 말 vs 안정형 말"을 구분하는 스탯.

### 6.2. 수식 (경기 시작 시 1회 롤)

1. 정규화
    ```
    t_cons = Consistency / 20
    ```

2. 최대 컨디션 변동폭
    ```
    condRange = 0.005 + 0.01 × (1 - t_cons)
    ```
    - Consistency = 0: ±1.5% 변동
    - Consistency = 20: ±0.5% 변동

3. 실제 컨디션 보정값 추첨
    ```
    cond = random(-condRange, condRange)
    consistencyBonus = 0.03 × t_cons  // Consistency 20일 때 +3%
    mult = 1.0 + cond + consistencyBonus
    ```

4. 컨디션을 주요 스탯에 적용
    ```
    effectiveSpeed   = baseSpeed   × mult
    effectiveStamina = baseStamina × mult
    effectivePower   = basePower   × mult
    effectiveGuts    = baseGuts    × mult
    effectiveStart   = baseStart   × mult
    effectiveConsistency = baseConsistency  // 컨디션 영향 없음
    ```

> Consistency가 낮은 말: -1.5% ~ +1.5% 로 크게 출렁 → **로또형**  
> Consistency가 높은 말: -0.5% ~ +1.5% 내에서만 움직임 (평균 +3% 보너스) → **안정형**

---

## 7. 스태미나 소모 시스템

### 7.1. 소모량 계산

매 프레임(dt = 0.05초)마다:

1. 속도 정규화
    ```
    speedForCost = min(currentSpeed, 60km/h)
    speedNorm = speedForCost / 60km/h  // 0 ~ 1
    ```

2. 1m당 소모량 계산
    ```
    staminaCostPerM = 0.1 + 0.08 × speedNorm
    ```
    - 기본 소모: 0.1 (1m당, 속도 무관)
    - 속도 비례 소모: 0.08 × speedNorm (1m당)

3. Speed 페널티 적용
    ```
    speedPenalty = 1.0 + 0.1 × t_speed
    staminaCostPerM ×= speedPenalty
    ```

4. 실제 이동 거리만큼 소모
    ```
    distanceThisStep = currentSpeed × dt
    staminaCost = staminaCostPerM × distanceThisStep
    ```

5. Stamina 효율 적용
    ```
    staminaCost ×= staminaCostFactor
    stamina -= staminaCost
    ```

---

## 8. 피로 보정 시스템

### 8.1. 피로 시작 조건

```
staminaRatio = stamina / maxStamina
if (staminaRatio < 0.92) {
  // 피로 보정 적용
}
```

- 스태미나가 92% 이하일 때 즉시 적용

### 8.2. 피로 보정 계산

```
x = staminaRatio / 0.92
fatigueCurve = x^0.6  // 지수 함수로 급격한 감소
fatigueFactor = fatigueFloor + (1 - fatigueFloor) × fatigueCurve
currentSpeed ×= fatigueFactor
```

- `fatigueFloor`: Guts 스탯에 따라 결정 (0.55 ~ 0.8)
- 스태미나가 많이 떨어질수록 속도 감소가 가속됨

---

## 9. 한 틱(dt) 기준 시뮬레이션 흐름

말 하나에 대해, 매 프레임(dt)마다 로직 흐름은 대략 다음과 같다.

### 9.1. 레이스 시작 시 1회 수행

1. 스탯(합 90)에서 파생 값 계산
   - `maxSpeed_ms`, `maxStamina`, `accelFactor`, `staminaCostFactor` 등
2. Consistency 기반 컨디션 롤 적용
   - Speed, Stamina, Power, Guts, Start에 `mult` 곱
3. Start 기반 출발 딜레이 설정
   - `raceStartTime = startDelay`
4. 초기 상태 설정
   - `currentSpeed = maxSpeed_ms × 0.9`
   - `stamina = maxStamina`

### 9.2. 매 프레임(dt)마다 수행

1. **출발 딜레이 체크**
    ```
    if (currentTime < raceStartTime) {
      return  // 움직이지 않음
    }
    ```

2. **진행도 계산**
    ```
    progress = position / TRACK_REAL_M  // 0 ~ 1
    ```

3. **구간별 기본 목표 속도**
    ```
    if (progress < 0.3) phaseMult = 0.98  // 초반 약간 느리게
    else if (progress < 0.7) phaseMult = 1.0  // 중반 기준
    else phaseMult = 1.02  // 후반 약간 빠르게
    
    targetSpeed = maxSpeed_ms × phaseMult
    ```

4. **Power 기반 가속/감속 적용**
    ```
    accel = accelFactor
    
    // Start 기반 초반 가속 버프 (100m까지)
    if (position < 100) {
      accel ×= startAccelBoost
    }
    
    currentSpeed += (targetSpeed - currentSpeed) × accel
    ```

5. **스태미나 소모** (위 7장 참고)

6. **Guts 기반 피로 보정** (위 8장 참고)

7. **위치 업데이트**
    ```
    position += currentSpeed × dt
    ```

---

## 10. 스탯 ↔ 실제 효과 요약

- **Speed**
  - `maxSpeed_kmh` 결정 (이론상 최고속도, 58~68 km/h)
  - 스태미나 소모 페널티 (+0~10%)
- **Stamina**
  - `staminaCostFactor` 결정 (0.45~1.0) → 스태 소모량 감소
  - 최대 스태미나는 모든 말 동일 (100)
- **Power**
  - `accelFactor` 결정 (0.03~0.8) → 목표속도까지의 가속/감속 속도
- **Guts**
  - `fatigueFloor` 결정 (0.55~0.8) → 스태 부족 시 최소 속도 바닥
- **Start**
  - `startAccelBoost` 결정 (1.0~1.5) → 초반 100m 가속 버프
  - `startDelay` 결정 (0~1초) → 출발 딜레이
- **Consistency**
  - `condRange` 결정 (±0.5~±1.5%) → 판마다 컨디션 롤 범위
  - `consistencyBonus` 결정 (+0~3%) → 평균 보너스

---

## 11. 이 설계의 특징

1. **공정성**
   - 말마다 스탯 총합이 항상 90으로 동일 → 재능 총량이 같음
   - 스탯 분배만 다르므로, 특정 말이 구조적으로 "치트"는 아님

2. **운빨**
   - Consistency, Start로
     - 판마다의 컨디션
     - 출발 딜레이
     를 조절 → "공정하지만 운빨 있는" 구조

3. **고증**
   - 최고속도 구간을 58~68km/h로 제한
   - 500m 기준 레이스 타임이 대략 25~30초 정도로 현실감 있는 값이 나옴

4. **확장성**
   - 추가로 RunStyle, 스킬/증강, 트랙 상태(날씨/주로) 등을 붙이더라도  
     이 문서의 스탯/수식 구조 위에 그대로 확장 가능.

---

## 12. 비선형 구조

### 12.1. Speed (비선형)
- `t_speed^0.65` 지수 함수 사용
- Speed가 높을수록 효율이 감소 (몰빵 방지)

### 12.2. 피로 보정 곡선 (비선형)
- `x^0.6` 지수 함수 사용
- 스태미나가 많이 떨어질수록 속도 감소가 가속됨

### 12.3. 나머지 스탯 (선형)
- Stamina, Power, Guts, Start, Consistency는 모두 선형 구조
