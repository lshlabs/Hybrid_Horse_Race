// =========================
// 레이스 엔진 통합 Export
// =========================

// 타입
export type {
  Stats,
  StatName,
  EffectiveStats,
  RaceResult,
  RaceOptions,
  SnapshotOrder,
  // 증강 타입
  AugmentRarity,
  AugmentStatType,
  SpecialAbilityType,
  Augment,
  AugmentChoice,
  AugmentSet,
} from './types'

// 증강 상수
export {
  AUGMENT_RARITY_NAMES,
  AUGMENT_STAT_NAMES,
  AUGMENT_STAT_DESCRIPTIONS,
  SPECIAL_ABILITY_NAMES,
  SPECIAL_ABILITY_DESCRIPTIONS,
} from './types'

// 상수 (트랙/좌표: trackConstants, 밸런스: constants)
export { DEFAULT_RACE_TILES_COUNT, METERS_PER_TILE_M } from './trackConstants'
export {
  SIM_STEP_SEC,
  MAX_SIM_TIME_SEC,
  MIN_SPEED_KMH,
  SPEED_BONUS_RANGE,
  BASE_STAMINA_COST_PER_M,
  SPEED_STAMINA_COST_PER_M,
  STAMINA_COST_SPEED_CAP_MPS,
  POWER_ACCEL_MIN,
  POWER_ACCEL_MAX,
  TARGET_ACCEL_TIME_MAX_SEC,
  TARGET_ACCEL_TIME_MIN_SEC,
  STAMINA_COST_FACTOR_MAX,
  STAMINA_COST_FACTOR_MIN,
  STAMINA_COST_REDUCTION,
  GUTS_FATIGUE_FLOOR_MIN,
  GUTS_FATIGUE_FLOOR_MAX,
  GUTS_FATIGUE_FLOOR_RANGE,
  START_ACCEL_BOOST_BASE,
  START_ACCEL_BOOST_RANGE,
  START_DELAY_MAX_SEC,
  LUCK_ROLL_AT_0_MIN,
  LUCK_ROLL_AT_0_MAX,
  LUCK_ROLL_AT_20_MIN,
  LUCK_ROLL_AT_20_MAX,
  LUCK_ROLL_AT_40_MIN,
  LUCK_ROLL_AT_40_MAX,
  DEFAULT_MAX_STAT,
  DEFAULT_SATURATION_RATE,
} from './constants'

// position → progress 변환 (단일 공식)
export { positionToProgress } from './positionUtils'
export type { PositionToProgressOptions } from './positionUtils'

// 능력치 시스템
export {
  STAT_NAMES,
  generateRandomStats,
  normalizeStatNonLinear,
  normalizeLuck,
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
  randFloat,
  randInt,
  clamp,
  kmhToMs,
} from './stat-system'

// Horse 클래스
export { Horse } from './horse'

// 시뮬레이션
export { runRace } from './simulator'

// 증강 시스템
export {
  generateRandomRarity,
  createAugment,
  createLastSpurtAugment,
  createOvertakeAugment,
  createEscapeCrisisAugment,
  generateAugmentChoices,
  generateRandomAugmentChoices,
  applyAugmentsToStats,
} from './augments'
