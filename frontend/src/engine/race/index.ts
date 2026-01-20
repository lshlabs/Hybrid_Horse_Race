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

// 상수
export {
  TRACK_REAL_M,
  DT,
  MAX_SIM_TIME,
  MIN_SPEED_KMH,
  SPEED_BONUS_RANGE,
  BASE_STAMINA_COST_PER_M,
  SPEED_STAMINA_COST_PER_M,
  STAMINA_COST_SPEED_CAP_MS,
  POWER_ACCEL_MIN,
  POWER_ACCEL_MAX,
  TARGET_ACCEL_TIME_MAX,
  TARGET_ACCEL_TIME_MIN,
  STAMINA_COST_FACTOR_MAX,
  STAMINA_COST_FACTOR_MIN,
  STAMINA_COST_REDUCTION,
  GUTS_FATIGUE_FLOOR_MIN,
  GUTS_FATIGUE_FLOOR_MAX,
  GUTS_FATIGUE_FLOOR_RANGE,
  START_ACCEL_BOOST_BASE,
  START_ACCEL_BOOST_RANGE,
  START_DELAY_MAX,
  COND_MIN_BONUS,
  COND_MAX_BONUS,
  DEFAULT_MAX_STAT,
  DEFAULT_SATURATION_RATE,
} from './constants'

// 능력치 시스템
export {
  STAT_NAMES,
  generateRandomStats,
  normalizeStatNonLinear,
  normalizeConsistency,
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
