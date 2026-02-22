// =========================
// 능력치 시스템
// - 능력치 생성
// - 정규화
// - 레이스 계산용 파라미터 변환
// =========================

import type { Stats, StatName } from './types'
import {
  calcAccelFactor as calcAccelFactorCore,
  calcMaxSpeed as calcMaxSpeedCore,
  calcSpeedNormalized as calcSpeedNormalizedCore,
  calcStaminaCostFactor as calcStaminaCostFactorCore,
  calcStartAccelBoost as calcStartAccelBoostCore,
  clamp as clampCore,
  kmhToMs as kmhToMsCore,
  normalizeLuck as normalizeLuckCore,
  normalizeStatNonLinear as normalizeStatNonLinearCore,
} from '../../../../shared/race-core/stat-system-core'
import {
  DEFAULT_MAX_STAT,
  DEFAULT_SATURATION_RATE,
  LUCK_ROLL_AT_0_MIN,
  LUCK_ROLL_AT_0_MAX,
  LUCK_ROLL_AT_20_MIN,
  LUCK_ROLL_AT_20_MAX,
  LUCK_ROLL_AT_40_MIN,
  LUCK_ROLL_AT_40_MAX,
  TARGET_ACCEL_TIME_MAX_SEC,
  TARGET_ACCEL_TIME_MIN_SEC,
  GUTS_FATIGUE_FLOOR_MIN,
  GUTS_FATIGUE_FLOOR_MAX,
  GUTS_FATIGUE_FLOOR_RANGE,
  START_DELAY_MAX_SEC,
} from './constants'

/**
 * 유틸리티 함수
 */
export function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1))
}

export function clamp(v: number, min: number, max: number): number {
  // 공통 core 함수를 그대로 쓰되, 프론트에서 import 경로를 단순하게 유지하려고 래퍼를 둔다.
  return clampCore(v, min, max)
}

export function kmhToMs(kmh: number): number {
  // 단위 변환도 shared core와 같은 계산을 쓰도록 맞춘다.
  return kmhToMsCore(kmh)
}

/**
 * 능력치 이름 배열
 */
export const STAT_NAMES: StatName[] = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Luck']

// =========================
// 능력치 생성 (총합 80)
// =========================

/**
 * 랜덤 능력치 생성 (총합 80)
 * - 기본값: 각 능력치 8 (총 48)
 * - 나머지 32를 랜덤 분배
 * - 능력치 상한: 20 (각 능력치 최대 20)
 */
export function generateRandomStats(): Stats {
  const stats: Stats = {
    Speed: 8,
    Stamina: 8,
    Power: 8,
    Guts: 8,
    Start: 8,
    Luck: 8,
  }

  let remaining = 80 - 6 * 8
  const MAX_STAT = 20
  const incrementableStatNames = [...STAT_NAMES]

  while (remaining > 0 && incrementableStatNames.length > 0) {
    // 20 미만인 능력치 중 랜덤 선택 (상한 도달 시 후보 목록에서 제거)
    const candidateIndex = randInt(0, incrementableStatNames.length - 1)
    const key = incrementableStatNames[candidateIndex]
    stats[key] += 1
    remaining -= 1

    if (stats[key] >= MAX_STAT) {
      incrementableStatNames.splice(candidateIndex, 1)
    }
  }

  return stats
}

// =========================
// 정규화 함수
// =========================

/**
 * 비선형 정규화 (지수 포화식)
 * - 초반 급격한 증가, 후반 완만한 증가 (지수 포화 곡선)
 * - 최대 능력치에서 1.0이 되도록 정규화
 * - 그 이상 값은 상한으로 본다.
 *
 * @param stat 능력치 값
 * @param maxStat 최대 능력치 (기본 40, 상한)
 * @param saturationRate 포화율 (기본 2.0, 높을수록 빠른 포화)
 */
export function normalizeStatNonLinear(
  stat: number,
  maxStat: number = DEFAULT_MAX_STAT,
  saturationRate: number = DEFAULT_SATURATION_RATE,
): number {
  return normalizeStatNonLinearCore(stat, maxStat, saturationRate)
}

/**
 * Luck 전용 비선형 정규화
 * - 20 이하: 선형 (luck / 20)
 * - 20 초과: 효율 감소 (1.0 + (luck - 20) / 40)
 */
export function normalizeLuck(luck: number): number {
  return normalizeLuckCore(luck)
}

// =========================
// 행운 롤 (Luck 기반)
// =========================

/**
 * 행운 롤
 * - Luck이 높을수록 음수 범위가 줄어들고 최소값이 상승
 * - Luck 0: -10% ~ +10%
 * - Luck 20: +0% ~ +20%
 * - Luck 40: +10% ~ +50%
 *
 * @returns 행운 보너스 (-0.10 ~ 0.50)
 */
export function rollCondition(luck: number): number {
  const normalized = normalizeLuck(luck)

  let minBonus: number
  let maxBonus: number
  if (normalized <= 1.0) {
    // 낮은 Luck 구간: 음수~양수 범위를 선형으로 이동시킨다.
    minBonus = LUCK_ROLL_AT_0_MIN + normalized * (LUCK_ROLL_AT_20_MIN - LUCK_ROLL_AT_0_MIN)
    maxBonus = LUCK_ROLL_AT_0_MAX + normalized * (LUCK_ROLL_AT_20_MAX - LUCK_ROLL_AT_0_MAX)
  } else if (normalized <= 1.5) {
    // 높은 Luck 구간: 상한을 더 크게 열어서 좋은 컨디션이 나오기 쉽게 한다.
    const t = (normalized - 1.0) / 0.5
    minBonus = LUCK_ROLL_AT_20_MIN + t * (LUCK_ROLL_AT_40_MIN - LUCK_ROLL_AT_20_MIN)
    maxBonus = LUCK_ROLL_AT_20_MAX + t * (LUCK_ROLL_AT_40_MAX - LUCK_ROLL_AT_20_MAX)
  } else {
    // 너무 높아도 여기서는 상한값으로 고정
    minBonus = LUCK_ROLL_AT_40_MIN
    maxBonus = LUCK_ROLL_AT_40_MAX
  }

  return randFloat(minBonus, maxBonus)
}

// =========================
// 파생 파라미터 계산
// =========================

/**
 * Speed → 최고 속도 (m/s)
 * - Speed 0: 58 km/h (MIN_SPEED_KMH)
 * - Speed 40: 68 km/h (MIN_SPEED_KMH + SPEED_BONUS_RANGE)
 * - 지수 포화식으로 비선형 증가
 */
export function calcMaxSpeed(speedStat: number): number {
  return calcMaxSpeedCore(speedStat)
}

/**
 * Stamina → 스태미나 소모 효율 계수
 * - 모든 말의 최대 스태미나는 100으로 동일
 * - Stamina 스탯은 소모 효율만 관여
 * - Stamina 0: 1.0 (기본 소모)
 * - Stamina 40: 0.45 (55% 감소)
 * - 지수 포화식으로 비선형 증가
 */
export function calcStaminaCostFactor(staminaStat: number): number {
  return calcStaminaCostFactorCore(staminaStat)
}

/**
 * Power → 가속 계수
 * - 로그 램프 가속에 사용
 * - Power 0: 0.3 (POWER_ACCEL_MIN)
 * - Power 40: 1.5 (POWER_ACCEL_MAX)
 * - 지수 포화식으로 비선형 증가
 */
export function calcAccelFactor(powerStat: number): number {
  return calcAccelFactorCore(powerStat)
}

/**
 * Power + Start → 목표 가속 시간 (3~7초)
 * - Power와 Start가 높을수록 빠르게 목표 속도 도달
 * - Power 0 + Start 0: 7초 (느린 가속)
 * - Power 40 + Start 40: 3초 (빠른 가속)
 * - 지수 포화식으로 비선형 증가
 */
export function calcTargetAccelTime(powerStat: number, startStat: number): number {
  const tPower = normalizeStatNonLinear(powerStat)
  const tStart = normalizeStatNonLinear(startStat)
  // Power/Start 정규화 값 합으로 가속 시간 범위를 줄인다.
  const timeRange = (TARGET_ACCEL_TIME_MAX_SEC - TARGET_ACCEL_TIME_MIN_SEC) / 2.0
  const targetAccelTime = TARGET_ACCEL_TIME_MAX_SEC - (tPower + tStart) * timeRange
  // 너무 작은 값만 막고 나머지는 차이가 나게 둔다.
  return Math.max(0.1, targetAccelTime)
}

/**
 * Guts → 피로 시 최소 속도 바닥 (0.55 ~ 0.80)
 * - Guts 0: 0.55 (최대 45% 감소 가능)
 * - Guts 40: 0.8 (최대 20% 감소만 가능)
 * - 지수 포화식으로 비선형 증가
 */
export function calcFatigueFloor(gutsStat: number): number {
  const tGuts = normalizeStatNonLinear(gutsStat)
  const floor = GUTS_FATIGUE_FLOOR_MIN + GUTS_FATIGUE_FLOOR_RANGE * tGuts
  return clamp(floor, GUTS_FATIGUE_FLOOR_MIN, GUTS_FATIGUE_FLOOR_MAX)
}

/**
 * Start → 초반 가속 버프 (1.0 ~ 1.3)
 * - 초반 100m까지 가속에 곱해짐
 * - Start 0: 1.0 (버프 없음)
 * - Start 40: 1.3 (30% 가속 버프)
 * - 지수 포화식으로 비선형 증가
 */
export function calcStartAccelBoost(startStat: number): number {
  return calcStartAccelBoostCore(startStat)
}

/**
 * Start → 출발 딜레이 (0 ~ 1초)
 * - Start가 높을수록 딜레이 범위가 줄어듦
 * - Start 0: 0~1초 (랜덤 딜레이)
 * - Start 40: 0초 (딜레이 없음)
 * - 지수 포화식으로 비선형 증가
 */
export function calcStartDelay(startStat: number): number {
  const tStart = normalizeStatNonLinear(startStat)
  const maxDelay = START_DELAY_MAX_SEC - tStart // Start가 높을수록 출발 딜레이가 줄어든다.
  return randFloat(0, Math.max(0, maxDelay))
}

/**
 * Speed 정규화 값 저장용 함수
 * 말 업데이트에서 스태미나 추가 소모 계산할 때 같이 사용한다.
 */
export function calcSpeedNormalized(speedStat: number): number {
  return calcSpeedNormalizedCore(speedStat)
}

/**
 * Speed 기반 스태미나 페널티 계수
 * - Speed가 높을수록 추가 스태미나 소모
 */
export function calcSpeedPenalty(tSpeedNormalized: number): number {
  return 1.0 + 0.1 * tSpeedNormalized // Speed 20일 때 10% 추가 소모
}
