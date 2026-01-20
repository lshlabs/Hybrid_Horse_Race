// =========================
// Horse 클래스
// - 말의 상태 관리
// - 물리 시뮬레이션 (가속, 스태미나, 피로)
// - 특수 능력 (라스트 스퍼트, 추월, 위기 탈출)
// =========================

import type { Stats, EffectiveStats } from './types'
import {
  TRACK_REAL_M,
  BASE_STAMINA_COST_PER_M,
  SPEED_STAMINA_COST_PER_M,
  STAMINA_COST_SPEED_CAP_MS,
} from './constants'
import {
  rollCondition,
  calcMaxSpeed,
  calcStaminaCostFactor,
  calcAccelFactor,
  calcTargetAccelTime,
  calcFatigueFloor,
  calcStartAccelBoost,
  calcStartDelay,
  calcSpeedNormalized,
  calcSpeedPenalty,
  clamp,
} from './stat-system'

export class Horse {
  name: string
  baseStats: Stats
  effStats: EffectiveStats

  // 파생 파라미터
  maxSpeed_ms: number = 0
  maxStamina: number = 0
  accelFactor: number = 0
  tSpeedNormalized: number = 0 // Speed 정규화 값 (스태미나 페널티 계산용)

  // 스태미나 소모 관련
  staminaCostFactor: number = 1

  // 피로 관련
  fatigueFloor: number = 0.55

  // Start / Cons 관련
  startAccelBoost: number = 1 // Start 기반 초반 가속 보너스
  startStaminaShield: number = 1 // (현재는 사용 안 함, 필요시 재활용 가능)
  consPaceFactor: number = 1 // 현재는 중립(1.0)로 둠
  startDelay: number = 0 // Start 기반 출발 딜레이 (초)
  targetAccelTime: number = 5.0 // Power와 Start에 따른 목표 가속 시간 (3~7초)

  // 특수 능력 관련
  lastSpurtTriggerProgress: number = 1.0 // 라스트 스퍼트 발동 진행률 (0.7~0.9)
  lastSpurtActive: boolean = false // 라스트 스퍼트 발동 여부
  overtakeBonusActive: boolean = false // 추월 보너스 활성화 여부
  overtakeBonusValue: number = 0 // 추월 보너스 수치
  overtakeCount: number = 0 // 추월 횟수 (중첩 적용용)
  currentRank: number = 999 // 현재 순위
  previousRank: number = 999 // 이전 순위 (추월 감지용)
  escapeCrisisActive: boolean = false // 위기 탈출 활성화 여부
  escapeCrisisValue: number = 0 // 위기 탈출 수치 (능력치 증가량)
  escapeCrisisUsed: boolean = false // 위기 탈출 사용 여부 (게임당 1번)

  // 현재 상태
  currentSpeed: number = 0
  position: number = 0
  stamina: number = 0
  finished: boolean = false
  finishTime: number | null = null
  raceStartTime: number = 0 // 실제 레이스 시작 시간 (출발 딜레이 반영)

  // 컨디션 롤 기록 (디버그용)
  conditionRoll: number = 0

  // HUD 표시용 (추월 보너스)
  lastStaminaRecovery: number = 0 // 마지막 스태미나 회복량 (HUD 표시용)

  constructor(name: string, baseStats: Stats) {
    this.name = name
    this.baseStats = baseStats
    this.effStats = { ...baseStats }
  }

  /**
   * 특수 능력 설정
   */
  setSpecialAbility(abilityType: string, abilityValue: number): void {
    if (abilityType === 'lastSpurt') {
      // abilityValue는 6~10 범위
      // 수치가 높을수록 더 빨리 발동 (진행률 낮아짐)
      // 수치 10 → 0.8 진행률 (400m)
      // 수치 6 → 0.88 진행률 (440m)
      // 공식: progress = 1.0 - (abilityValue / 10) * 0.2
      this.lastSpurtTriggerProgress = 1.0 - (abilityValue / 10) * 0.2
    } else if (abilityType === 'overtake') {
      // abilityValue는 6~10 범위
      // 수치가 높을수록 추월 시 더 큰 속도 증가
      this.overtakeBonusValue = abilityValue
    } else if (abilityType === 'escapeCrisis') {
      // abilityValue는 6~10 범위
      // 수치가 높을수록 더 큰 능력치 증가
      this.escapeCrisisValue = abilityValue
    }
  }

  /**
   * 현재 순위 업데이트 (추월 감지 및 위기 탈출 발동용)
   * @param rank 현재 순위
   */
  updateRank(rank: number): void {
    const wasFirstUpdate = this.currentRank === 999

    this.previousRank = this.currentRank
    this.currentRank = rank

    // 첫 번째 업데이트는 추월 감지하지 않음 (순위 초기화)
    if (wasFirstUpdate) {
      return
    }

    // 추월 보너스: 순위가 올라가면 보너스 활성화 및 추월 횟수 증가 (중첩 적용)
    // TODO: 플레이어 수가 적을 때는 추월 기회가 줄어들어 밸런스 조정이 필요할 수 있음
    if (this.overtakeBonusValue > 0 && this.currentRank < this.previousRank) {
      this.overtakeBonusActive = true
      this.overtakeCount += 1 // 추월 횟수 증가 (중첩)

      // 체력 회복 (수치와 관계없이 항상 +3)
      this.stamina = Math.min(this.stamina + 3, this.maxStamina)
      this.lastStaminaRecovery = 3 // HUD 표시용
    }

    // 위기 탈출: 순위가 4위 이하일 때 발동 (게임당 1번)
    // TODO: 플레이어 수가 4명 미만일 때는 이 조건을 조정해야 할 수 있음
    if (this.escapeCrisisValue > 0 && !this.escapeCrisisUsed && this.currentRank >= 4) {
      this.escapeCrisisActive = true
      this.escapeCrisisUsed = true // 사용 표시
    } else {
      this.escapeCrisisActive = false
    }
  }

  /**
   * 레이스 준비
   * - 컨디션 롤 (Consistency 기반)
   * - 파생 파라미터 계산
   * - 초기 상태 세팅
   */
  prepareForRace(): void {
    const s = this.baseStats

    // 1) Consistency 기반 컨디션 롤
    const cond = rollCondition(s.Consistency)
    const mult = 1.0 + cond
    this.conditionRoll = cond

    // 컨디션은 Speed/Sta/Power/Guts/Start 에만 반영
    this.effStats = {
      Speed: s.Speed * mult,
      Stamina: s.Stamina * mult,
      Power: s.Power * mult,
      Guts: s.Guts * mult,
      Start: s.Start * mult,
      Consistency: s.Consistency,
    }

    const e = this.effStats

    // 2) 파생 파라미터 계산
    // Speed → 최고 속도
    this.maxSpeed_ms = calcMaxSpeed(e.Speed)
    this.tSpeedNormalized = calcSpeedNormalized(e.Speed)

    // Stamina → 스태미나 소모 효율
    this.maxStamina = 100 // 모든 말 동일한 최대 스태미나
    this.staminaCostFactor = calcStaminaCostFactor(e.Stamina)

    // Power → 가속 계수
    this.accelFactor = calcAccelFactor(e.Power)

    // Power + Start → 목표 가속 시간
    this.targetAccelTime = calcTargetAccelTime(e.Power, e.Start)

    // Guts → 피로 시 최소 속도 바닥
    this.fatigueFloor = calcFatigueFloor(e.Guts)

    // Start → 초반 가속 버프 + 출발 딜레이
    this.startAccelBoost = calcStartAccelBoost(e.Start)
    this.startDelay = calcStartDelay(e.Start)

    // 3) 초기 상태 세팅
    this.currentSpeed = 0
    this.position = 0
    this.stamina = this.maxStamina
    this.finished = false
    this.finishTime = null
    this.raceStartTime = this.startDelay // 실제 레이스 시작 시간 = 출발 딜레이

    // 특수 능력 초기화
    this.escapeCrisisUsed = false
    this.overtakeBonusActive = false
    this.overtakeCount = 0
    this.lastStaminaRecovery = 0

    // 순위 초기화 (추월 감지용)
    this.currentRank = 999
    this.previousRank = 999
  }

  /**
   * 시뮬레이션 스텝 (물리 업데이트)
   * @param dt 시간 간격 (초)
   * @param currentTime 현재 시간 (초)
   */
  step(dt: number, currentTime: number): void {
    if (this.finished) return

    // 출발 딜레이 체크: 실제 레이스 시작 시간이 되기 전에는 움직이지 않음
    if (currentTime < this.raceStartTime) {
      return
    }

    if (this.position >= TRACK_REAL_M) {
      this.finished = true
      if (this.finishTime === null) {
        this.finishTime = currentTime
      }
      return
    }

    const progress = clamp(this.position / TRACK_REAL_M, 0, 1)

    // 목표 속도 계산
    let targetSpeed = this.maxSpeed_ms

    // 가속 계수 (Power 기반 + Start 기반 초반 버프)
    let accel = this.accelFactor
    if (this.position < 100) {
      accel *= this.startAccelBoost
    }

    // 위기 탈출: 순위가 3위 이하일 때 능력치 증가
    if (this.escapeCrisisActive && this.escapeCrisisValue > 0) {
      // 수치에 따라 능력치 증가 (6~10 → 6%~10% 증가)
      const crisisBonus = (this.escapeCrisisValue / 10) * 0.1 // 0.06 ~ 0.10
      const statMultiplier = 1.0 + crisisBonus
      targetSpeed *= statMultiplier
    }

    // 추월 보너스: 수치에 따라 속도 증가율이 다름, 추월 횟수만큼 중첩 적용
    if (this.overtakeBonusActive && this.overtakeBonusValue > 0 && this.overtakeCount > 0) {
      // 수치별 속도 증가율: 6→1%, 7→1.5%, 8→2%, 9→2.5%, 10→3%
      const speedBonusPerOvertake = (this.overtakeBonusValue - 6) * 0.005 + 0.01 // 0.01 ~ 0.03
      targetSpeed *= Math.pow(1.0 + speedBonusPerOvertake, this.overtakeCount)
    }

    // 최대 속도를 넘지 못하도록 제한
    targetSpeed = Math.min(targetSpeed, this.maxSpeed_ms)

    // 스태미나 소모 계산
    const speedForCost = Math.min(this.currentSpeed, STAMINA_COST_SPEED_CAP_MS)
    const distanceThisStep = this.currentSpeed * dt
    const speedNorm = STAMINA_COST_SPEED_CAP_MS > 0 ? speedForCost / STAMINA_COST_SPEED_CAP_MS : 0

    // 기본 소모 + 속도 비례 소모
    let staminaCostPerM = BASE_STAMINA_COST_PER_M + SPEED_STAMINA_COST_PER_M * speedNorm

    // Speed 스탯이 높을수록 추가 스태미나 소모 페널티
    const speedPenalty = calcSpeedPenalty(this.tSpeedNormalized)
    staminaCostPerM *= speedPenalty

    let staminaCost = staminaCostPerM * distanceThisStep

    // Stamina 스탯 기반 효율 반영
    staminaCost *= this.staminaCostFactor

    // 스태미나 감소
    this.stamina -= staminaCost
    if (this.stamina < 0) this.stamina = 0

    // 라스트 스퍼트 발동 체크
    if (!this.lastSpurtActive && progress >= this.lastSpurtTriggerProgress) {
      this.lastSpurtActive = true
    }

    // 피로 보정 (Guts 기반 바닥 + 스태미나 잔량)
    // 라스트 스퍼트 발동 중이면 피로 보정 무시
    let fatigueFactor = 1.0
    if (!this.lastSpurtActive) {
      let staminaRatio = this.maxStamina > 0 ? this.stamina / this.maxStamina : 0
      staminaRatio = clamp(staminaRatio, 0, 1)

      // 피로 보정 시작점: 85% 이하부터
      if (staminaRatio < 0.85) {
        const x = staminaRatio / 0.85
        const fatigueCurve = Math.pow(x, 0.8) // 완만한 감소
        fatigueFactor = this.fatigueFloor + (1 - this.fatigueFloor) * fatigueCurve
        fatigueFactor = clamp(fatigueFactor, this.fatigueFloor, 1.0)
      }
    }

    // 피로 보정을 목표 속도에 적용
    targetSpeed *= fatigueFactor

    // 로그 램프 가속: v(t) = v_target * log(1 + k * t) / log(1 + k * T)
    const elapsedTime = currentTime - this.raceStartTime
    if (elapsedTime > 0) {
      const logRampFactor =
        Math.log(1 + accel * elapsedTime) / Math.log(1 + accel * this.targetAccelTime)
      const clampedFactor = Math.min(logRampFactor, 1.0)
      this.currentSpeed = targetSpeed * clampedFactor
    } else {
      this.currentSpeed = 0
    }
    if (this.currentSpeed < 0) this.currentSpeed = 0

    // 위치 업데이트
    const prevPosition = this.position
    this.position += this.currentSpeed * dt

    // 완주 체크 (정밀한 시간 계산)
    if (this.position >= TRACK_REAL_M && !this.finished) {
      this.finished = true

      // 완주 시점을 정밀하게 보간 계산
      if (prevPosition < TRACK_REAL_M && this.currentSpeed > 0) {
        const remainingDistance = TRACK_REAL_M - prevPosition
        const timeToFinish = remainingDistance / this.currentSpeed
        this.finishTime = currentTime - dt + timeToFinish
      } else {
        this.finishTime = currentTime
      }
    }

    // 회복량 초기화 (HUD 표시 후 초기화)
    if (this.lastStaminaRecovery > 0) {
      this.lastStaminaRecovery = 0
    }
  }
}
