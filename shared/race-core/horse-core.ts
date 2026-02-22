import type { Augment, Stats } from './types-core'
import {
  BASE_STAMINA_COST_PER_M,
  SPEED_STAMINA_COST_PER_M,
  STAMINA_COST_SPEED_CAP_MPS,
  DEFAULT_TRACK_LENGTH_M,
} from './constants-core'
import {
  clamp,
  calcAccelFactor,
  calcFatigueFloor,
  calcMaxSpeed,
  calcSpeedNormalized,
  calcSpeedPenalty,
  calcStaminaCostFactor,
  calcStartAccelBoost,
  calcStartDelay,
  calcTargetAccelTime,
} from './stat-system-core'
import {
  applyHorseRankUpdate,
  applySpecialAbilityToState,
  applyStatAugments,
} from './horse-logic-core'

// 서버/클라 공용으로 쓰는 "말 1마리" 시뮬레이션 코어
// 입력 스탯/증강/컨디션을 받아서 레이스 중 상태를 업데이트한다.
export class HorseCore {
  readonly playerId: string
  readonly baseStats: Stats
  readonly effectiveStats: Stats
  readonly conditionRoll: number

  maxSpeed_ms: number = 0
  maxStamina: number = 100
  accelFactor: number = 0
  tSpeedNormalized: number = 0
  staminaCostFactor: number = 1
  fatigueFloor: number = 0.55
  startAccelBoost: number = 1
  startDelay: number = 0
  targetAccelTime: number = 5

  lastSpurtTriggerProgress: number = 1.0
  lastSpurtActive: boolean = false
  overtakeBonusValue: number = 0
  overtakeCount: number = 0
  currentRank: number = 999
  previousRank: number = 999
  escapeCrisisValue: number = 0
  escapeCrisisActive: boolean = false
  escapeCrisisUsed: boolean = false

  currentSpeed: number = 0
  position: number = 0
  stamina: number = 100
  finished: boolean = false
  finishTime: number | null = null
  raceStartTime: number = 0
  private trackLengthM: number = DEFAULT_TRACK_LENGTH_M

  constructor(
    playerId: string,
    rawBaseStats: Stats,
    augments: Augment[],
    conditionRoll: number,
    trackLengthM: number,
  ) {
    // 기본 스탯에 증강을 먼저 적용하고,
    // 컨디션 보정은 실제 레이스용 effectiveStats에만 반영한다.
    this.playerId = playerId
    this.baseStats = applyStatAugments(rawBaseStats, augments)
    this.conditionRoll = conditionRoll
    this.trackLengthM = trackLengthM
    this.effectiveStats = {
      Speed: this.baseStats.Speed * (1 + conditionRoll),
      Stamina: this.baseStats.Stamina * (1 + conditionRoll),
      Power: this.baseStats.Power * (1 + conditionRoll),
      Guts: this.baseStats.Guts * (1 + conditionRoll),
      Start: this.baseStats.Start * (1 + conditionRoll),
      Luck: this.baseStats.Luck,
    }

    augments.forEach((augment) => {
      if (augment.specialAbility && augment.specialAbilityValue != null) {
        this.setSpecialAbility(augment.specialAbility, augment.specialAbilityValue)
      }
    })

    this.prepare()
  }

  private setSpecialAbility(abilityType: string, abilityValue: number) {
    // 특수 능력 종류별 효과값을 내부 상태에 반영한다.
    const next = applySpecialAbilityToState(
      {
        lastSpurtTriggerProgress: this.lastSpurtTriggerProgress,
        overtakeBonusValue: this.overtakeBonusValue,
        escapeCrisisValue: this.escapeCrisisValue,
      },
      abilityType,
      abilityValue,
    )
    this.lastSpurtTriggerProgress = next.lastSpurtTriggerProgress
    this.overtakeBonusValue = next.overtakeBonusValue
    this.escapeCrisisValue = next.escapeCrisisValue
  }

  private prepare() {
    // 레이스 시작 전에 파생 스탯/초기 상태를 다시 계산한다.
    const e = this.effectiveStats
    this.maxSpeed_ms = calcMaxSpeed(e.Speed)
    this.tSpeedNormalized = calcSpeedNormalized(e.Speed)
    this.maxStamina = 100
    this.staminaCostFactor = calcStaminaCostFactor(e.Stamina)
    this.accelFactor = calcAccelFactor(e.Power)
    this.targetAccelTime = calcTargetAccelTime(e.Power, e.Start)
    this.fatigueFloor = calcFatigueFloor(e.Guts)
    this.startAccelBoost = calcStartAccelBoost(e.Start)
    this.startDelay = calcStartDelay(e.Start)

    this.currentSpeed = 0
    this.position = 0
    this.stamina = this.maxStamina
    this.finished = false
    this.finishTime = null
    this.raceStartTime = this.startDelay
    this.escapeCrisisUsed = false
    this.escapeCrisisActive = false
    this.overtakeCount = 0
    this.currentRank = 999
    this.previousRank = 999
    this.lastSpurtActive = false
  }

  updateRank(rank: number) {
    // 추월/역전 같은 랭크 변화에 따른 보너스/위기탈출 상태를 같이 업데이트한다.
    const next = applyHorseRankUpdate(
      {
        currentRank: this.currentRank,
        previousRank: this.previousRank,
        maxStamina: this.maxStamina,
        stamina: this.stamina,
        overtakeBonusValue: this.overtakeBonusValue,
        overtakeCount: this.overtakeCount,
        escapeCrisisValue: this.escapeCrisisValue,
        escapeCrisisUsed: this.escapeCrisisUsed,
      },
      rank,
    )
    this.previousRank = next.previousRank
    this.currentRank = next.currentRank
    this.stamina = next.stamina
    this.overtakeCount = next.overtakeCount
    this.escapeCrisisActive = next.escapeCrisisActive
    this.escapeCrisisUsed = next.escapeCrisisUsed
  }

  step(dtSec: number, currentTimeSec: number) {
    // dt 기반 업데이트라서 프레임이 흔들려도 시간 기준으로 비슷하게 진행되도록 한다.
    if (this.finished) return
    if (currentTimeSec < this.raceStartTime) return

    if (this.position >= this.trackLengthM) {
      this.finished = true
      if (this.finishTime === null) this.finishTime = currentTimeSec
      return
    }

    const progress = clamp(this.position / Math.max(1, this.trackLengthM), 0, 1)
    let targetSpeed = this.maxSpeed_ms
    let accel = this.accelFactor
    if (this.position < this.trackLengthM * 0.2) {
      accel *= this.startAccelBoost
    }

    if (this.escapeCrisisActive && this.escapeCrisisValue > 0) {
      const crisisBonus = (this.escapeCrisisValue / 10) * 0.1
      targetSpeed *= 1 + crisisBonus
    }

    if (this.overtakeBonusValue > 0 && this.overtakeCount > 0) {
      const speedBonusPerOvertake = (this.overtakeBonusValue - 6) * 0.005 + 0.01
      targetSpeed *= Math.pow(1 + speedBonusPerOvertake, this.overtakeCount)
    }

    targetSpeed = Math.min(targetSpeed, this.maxSpeed_ms)

    const speedForCost = Math.min(this.currentSpeed, STAMINA_COST_SPEED_CAP_MPS)
    const distanceThisStep = this.currentSpeed * dtSec
    const speedNorm = STAMINA_COST_SPEED_CAP_MPS > 0 ? speedForCost / STAMINA_COST_SPEED_CAP_MPS : 0
    let staminaCostPerM = BASE_STAMINA_COST_PER_M + SPEED_STAMINA_COST_PER_M * speedNorm
    staminaCostPerM *= calcSpeedPenalty(this.tSpeedNormalized)
    const staminaCost = staminaCostPerM * distanceThisStep * this.staminaCostFactor
    this.stamina = Math.max(0, this.stamina - staminaCost)

    // 막판 스퍼트는 진행률 기준으로 한 번만 켠다.
    if (!this.lastSpurtActive && progress >= this.lastSpurtTriggerProgress) {
      this.lastSpurtActive = true
    }

    let fatigueFactor = 1
    if (!this.lastSpurtActive) {
      const staminaRatio = clamp(this.stamina / this.maxStamina, 0, 1)
      if (staminaRatio < 0.85) {
        const x = staminaRatio / 0.85
        const fatigueCurve = Math.pow(x, 0.8)
        fatigueFactor = clamp(
          this.fatigueFloor + (1 - this.fatigueFloor) * fatigueCurve,
          this.fatigueFloor,
          1,
        )
      }
    }

    targetSpeed *= fatigueFactor

    const elapsed = currentTimeSec - this.raceStartTime
    if (elapsed > 0) {
      const logRamp =
        Math.log(1 + accel * elapsed) / Math.log(1 + accel * Math.max(0.0001, this.targetAccelTime))
      this.currentSpeed = Math.max(0, targetSpeed * Math.min(1, logRamp))
    } else {
      this.currentSpeed = 0
    }

    const prevPos = this.position
    this.position += this.currentSpeed * dtSec

    if (this.position >= this.trackLengthM && !this.finished) {
      // 이번 step 안에서 결승선을 넘은 경우 남은 거리 비율로 finishTime을 더 정확히 계산한다.
      this.finished = true
      if (prevPos < this.trackLengthM && this.currentSpeed > 0) {
        const remain = this.trackLengthM - prevPos
        this.finishTime = currentTimeSec - dtSec + remain / this.currentSpeed
      } else {
        this.finishTime = currentTimeSec
      }
    }
  }
}
