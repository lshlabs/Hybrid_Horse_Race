// =========================
// Horse 클래스
// - 말의 상태 관리
// - 물리 시뮬레이션 (가속, 스태미나, 피로)
// - 특수 능력 (라스트 스퍼트, 추월, 위기 탈출)
// =========================

import type { Stats, EffectiveStats } from './types'
import {
  BASE_STAMINA_COST_PER_M,
  SPEED_STAMINA_COST_PER_M,
  STAMINA_COST_SPEED_CAP_MPS,
} from './constants'
import { DEFAULT_RACE_TILES_COUNT, METERS_PER_TILE_M } from './trackConstants'
import { positionToProgress } from './positionUtils'
import {
  applyHorseRankUpdate,
  applySpecialAbilityToState,
} from '../../../../shared/race-core/horse-logic-core'
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

  // 파생 파라미터 (prepareForRace 전에는 기본값으로 유지)
  maxSpeed_ms: number = 0
  maxStamina: number = 100
  accelFactor: number = 0
  tSpeedNormalized: number = 0 // Speed 정규화 값 (스태미나 추가 소모 계산에 사용)

  // 스태미나 관련 값
  staminaCostFactor: number = 1

  // 피로 관련 값
  fatigueFloor: number = 0.55

  // Start / Cons 관련 값
  startAccelBoost: number = 1 // Start 기반 초반 가속 보너스
  startStaminaShield: number = 1 // 지금은 안 쓰지만 나중에 확장할 때 쓰려고 남겨둠
  consPaceFactor: number = 1 // 현재는 중립값으로 고정
  startDelay: number = 0 // Start 기반 출발 딜레이(초)
  targetAccelTime: number = 5.0 // Power/Start 기준 목표 가속 시간

  // 특수 능력 상태값
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

  // 현재 레이스 상태 (m/s, m, s 기준)
  // stamina는 prepareForRace 전에 HUD 표시용으로 100을 넣어둔다.
  currentSpeed: number = 0 // m/s
  position: number = 0 // m
  stamina: number = 100
  finished: boolean = false
  finishTime: number | null = null // 완주 시점(시뮬레이션 시간 기준)
  /**
   * 시뮬레이션 트랙 길이 (미터).
   * prepareForRace(trackLengthM)로만 설정. 반드시 TileMapManager.getTrackLengthM() 반환값과 동일해야 함.
   */
  private trackLengthM: number = DEFAULT_RACE_TILES_COUNT * METERS_PER_TILE_M
  raceStartTime: number = 0 // 출발 딜레이를 반영한 실제 출발 시점

  // 컨디션 롤 기록 (디버그/HUD 확인용)
  conditionRoll: number = 0

  // HUD 표시용 값
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
    // shared core helper에서 계산한 값을 이 클래스 필드에 다시 반영한다.
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

  /**
   * 현재 순위 업데이트 (추월 감지 및 위기 탈출 발동용)
   * @param rank 현재 순위
   */
  updateRank(rank: number): void {
    // 순위 변화 처리도 shared core helper를 쓰고, 클래스 상태 반영만 여기서 한다.
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
    this.overtakeBonusActive = next.overtakeBonusActive
    this.lastStaminaRecovery = next.staminaRecovered
    this.escapeCrisisActive = next.escapeCrisisActive
    this.escapeCrisisUsed = next.escapeCrisisUsed
  }

  /**
   * 레이스 준비
   * - 행운 롤 (Luck 기반)
   * - 파생 파라미터 계산
   * - 초기 상태 세팅
   *
   * @param trackLengthM 트랙 길이(미터). TileMapManager.getTrackLengthM() 반환값과 동일.
   * @param _legacyFinishLineOffsetM 사용 안 함 (position=말 코 통일). API 호환용.
   */
  prepareForRace(
    trackLengthM?: number,
    _legacyFinishLineOffsetM?: number,
    fixedConditionRoll?: number,
  ): void {
    void _legacyFinishLineOffsetM
    if (trackLengthM !== undefined) {
      this.trackLengthM = trackLengthM
    }
    const s = this.baseStats

    // 1) Luck 기반 컨디션 롤
    const cond = typeof fixedConditionRoll === 'number' ? fixedConditionRoll : rollCondition(s.Luck)
    const mult = 1.0 + cond
    this.conditionRoll = cond

    // Luck은 직접 올리지 않고 다른 주요 능력치 보정에만 사용한다.
    this.effStats = {
      Speed: s.Speed * mult,
      Stamina: s.Stamina * mult,
      Power: s.Power * mult,
      Guts: s.Guts * mult,
      Start: s.Start * mult,
      Luck: s.Luck,
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

    // 3) 레이스 시작 전 상태 초기화
    this.currentSpeed = 0
    this.position = 0
    this.stamina = this.maxStamina
    this.finished = false
    this.finishTime = null
    this.raceStartTime = this.startDelay // 말마다 출발 시간이 조금씩 다를 수 있다.

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
    // dt/currentTime은 시뮬레이션 시간(초) 기준
    if (this.finished) return

    // 출발 딜레이가 남아 있으면 아직 움직이지 않는다.
    if (currentTime < this.raceStartTime) {
      return
    }

    // position은 말의 "코" 위치(m)로 계산한다.
    if (this.position >= this.trackLengthM) {
      this.finished = true
      if (this.finishTime === null) {
        this.finishTime = currentTime
      }
      return
    }

    const progress = positionToProgress(this.position, this.trackLengthM, {
      capAtOne: true,
    })

    // 목표 속도 계산
    let targetSpeed = this.maxSpeed_ms

    // 가속 계수 (Power 기반 + Start 기반 초반 버프)
    let accel = this.accelFactor
    const startBoostDistance = this.trackLengthM * 0.2 // 초반 구간에서만 Start 보너스 강화
    if (this.position < startBoostDistance) {
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

    // 최종 속도는 최대 속도를 넘지 않게 제한
    targetSpeed = Math.min(targetSpeed, this.maxSpeed_ms)

    // 스태미나 소모 계산
    const speedForCost = Math.min(this.currentSpeed, STAMINA_COST_SPEED_CAP_MPS)
    const distanceThisStep = this.currentSpeed * dt
    const speedNorm = STAMINA_COST_SPEED_CAP_MPS > 0 ? speedForCost / STAMINA_COST_SPEED_CAP_MPS : 0

    // 기본 소모 + 현재 속도 비례 소모
    let staminaCostPerM = BASE_STAMINA_COST_PER_M + SPEED_STAMINA_COST_PER_M * speedNorm

    // Speed가 높으면 추가 스태미나 소모가 붙는다.
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

      // 스태미나 85% 아래부터 피로 보정 시작
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

    // 완주 체크 (position=말 코 → 코가 trackLengthM 도달 시, 정밀한 시간 보간)
    if (this.position >= this.trackLengthM && !this.finished) {
      this.finished = true
      if (prevPosition < this.trackLengthM && this.currentSpeed > 0) {
        const remainingDistance = this.trackLengthM - prevPosition
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
