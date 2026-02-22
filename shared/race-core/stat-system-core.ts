import type { StatName } from './types-core'
import {
  DEFAULT_MAX_STAT,
  DEFAULT_SATURATION_RATE,
  LUCK_ROLL_AT_0_MIN,
  LUCK_ROLL_AT_0_MAX,
  LUCK_ROLL_AT_20_MIN,
  LUCK_ROLL_AT_20_MAX,
  LUCK_ROLL_AT_40_MIN,
  LUCK_ROLL_AT_40_MAX,
  MIN_SPEED_KMH,
  SPEED_BONUS_RANGE,
  POWER_ACCEL_MIN,
  POWER_ACCEL_MAX,
  TARGET_ACCEL_TIME_MAX_SEC,
  TARGET_ACCEL_TIME_MIN_SEC,
  STAMINA_COST_FACTOR_MAX,
  STAMINA_COST_FACTOR_MIN,
  STAMINA_COST_REDUCTION,
  GUTS_FATIGUE_FLOOR_MIN,
  GUTS_FATIGUE_FLOOR_RANGE,
  START_ACCEL_BOOST_BASE,
  START_ACCEL_BOOST_RANGE,
  START_DELAY_MAX_SEC,
} from './constants-core'
import { randomFloatSeeded } from './rng-core'

// 스탯 -> 실제 레이스 파라미터(속도/가속/피로/출발 지연 등) 변환 helper
export const STAT_NAMES: StatName[] = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Luck']

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function kmhToMs(kmh: number): number {
  return (kmh * 1000) / 3600
}

export function normalizeStatNonLinear(
  stat: number,
  maxStat: number = DEFAULT_MAX_STAT,
  saturationRate: number = DEFAULT_SATURATION_RATE,
): number {
  // 스탯이 높을수록 효율이 조금씩 줄어들게(완만하게) 만드는 정규화 함수
  const clampedStat = Math.min(stat, maxStat)
  const x = clampedStat / maxStat
  const raw = 1 - Math.exp(-saturationRate * x)
  const max = 1 - Math.exp(-saturationRate * 1)
  return raw / max
}

export function normalizeLuck(luck: number): number {
  if (luck <= 20) return luck / 20
  return 1.0 + (luck - 20) / 40
}

export function rollConditionFromSeed(luck: number, rng: () => number): number {
  // Luck이 높을수록 컨디션 보너스 범위가 더 좋아지도록 구간별로 계산한다.
  const normalized = normalizeLuck(luck)

  let minBonus: number
  let maxBonus: number
  if (normalized <= 1.0) {
    minBonus = LUCK_ROLL_AT_0_MIN + normalized * (LUCK_ROLL_AT_20_MIN - LUCK_ROLL_AT_0_MIN)
    maxBonus = LUCK_ROLL_AT_0_MAX + normalized * (LUCK_ROLL_AT_20_MAX - LUCK_ROLL_AT_0_MAX)
  } else if (normalized <= 1.5) {
    const t = (normalized - 1.0) / 0.5
    minBonus = LUCK_ROLL_AT_20_MIN + t * (LUCK_ROLL_AT_40_MIN - LUCK_ROLL_AT_20_MIN)
    maxBonus = LUCK_ROLL_AT_20_MAX + t * (LUCK_ROLL_AT_40_MAX - LUCK_ROLL_AT_20_MAX)
  } else {
    minBonus = LUCK_ROLL_AT_40_MIN
    maxBonus = LUCK_ROLL_AT_40_MAX
  }

  return randomFloatSeeded(minBonus, maxBonus, rng)
}

export function calcMaxSpeed(speedStat: number): number {
  // Speed 스탯을 최고속도(km/h -> m/s)로 변환
  const tSpeed = normalizeStatNonLinear(speedStat)
  const maxSpeedKmh = MIN_SPEED_KMH + SPEED_BONUS_RANGE * tSpeed
  return kmhToMs(maxSpeedKmh)
}

export function calcStaminaCostFactor(staminaStat: number): number {
  const tStamina = normalizeStatNonLinear(staminaStat)
  const factor = STAMINA_COST_FACTOR_MAX - STAMINA_COST_REDUCTION * Math.min(tStamina, 1.0)
  return Math.max(STAMINA_COST_FACTOR_MIN, factor)
}

export function calcAccelFactor(powerStat: number): number {
  const tPower = normalizeStatNonLinear(powerStat)
  return POWER_ACCEL_MIN + (POWER_ACCEL_MAX - POWER_ACCEL_MIN) * tPower
}

export function calcTargetAccelTime(powerStat: number, startStat: number): number {
  // Power/Start가 높을수록 목표 가속 시간은 더 짧아진다.
  const tPower = normalizeStatNonLinear(powerStat)
  const tStart = normalizeStatNonLinear(startStat)
  return (
    TARGET_ACCEL_TIME_MAX_SEC -
    ((tPower + tStart) * (TARGET_ACCEL_TIME_MAX_SEC - TARGET_ACCEL_TIME_MIN_SEC)) / 2
  )
}

export function calcFatigueFloor(gutsStat: number): number {
  const tGuts = normalizeStatNonLinear(gutsStat)
  return GUTS_FATIGUE_FLOOR_MIN + GUTS_FATIGUE_FLOOR_RANGE * tGuts
}

export function calcStartAccelBoost(startStat: number): number {
  const tStart = normalizeStatNonLinear(startStat)
  return START_ACCEL_BOOST_BASE + START_ACCEL_BOOST_RANGE * tStart
}

export function calcStartDelay(startStat: number): number {
  const tStart = normalizeStatNonLinear(startStat)
  return START_DELAY_MAX_SEC * (1 - tStart)
}

export function calcSpeedNormalized(speedStat: number): number {
  return normalizeStatNonLinear(speedStat)
}

export function calcSpeedPenalty(tSpeedNormalized: number): number {
  const s = clamp(tSpeedNormalized, 0, 1)
  return 1.0 + 0.35 * (s * s)
}
