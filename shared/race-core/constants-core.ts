// shared race-core에서 서버/클라가 같이 쓰는 기본 상수들
// (거리, 시뮬레이션 간격, 스탯 계산 범위 등)
export const DEFAULT_TRACK_LENGTH_M = 155
export const DEFAULT_SIM_STEP_MS = 50
export const DEFAULT_OUTPUT_FRAME_MS = 100
export const DEFAULT_MAX_SIM_TIME_SEC = 120

export const MIN_SPEED_KMH = 58
export const SPEED_BONUS_RANGE = 10

export const BASE_STAMINA_COST_PER_M = 0.1
export const SPEED_STAMINA_COST_PER_M = 0.08
export const STAMINA_COST_SPEED_CAP_MPS = (60 * 1000) / 3600

export const POWER_ACCEL_MIN = 0.3
export const POWER_ACCEL_MAX = 1.5

export const TARGET_ACCEL_TIME_MAX_SEC = 7.0
export const TARGET_ACCEL_TIME_MIN_SEC = 3.0

export const STAMINA_COST_FACTOR_MAX = 1.0
export const STAMINA_COST_FACTOR_MIN = 0.45
export const STAMINA_COST_REDUCTION = 0.55

export const GUTS_FATIGUE_FLOOR_MIN = 0.55
export const GUTS_FATIGUE_FLOOR_MAX = 0.8
export const GUTS_FATIGUE_FLOOR_RANGE = 0.25

export const START_ACCEL_BOOST_BASE = 1.0
export const START_ACCEL_BOOST_RANGE = 0.3
export const START_DELAY_MAX_SEC = 1.0

export const LUCK_ROLL_AT_0_MIN = -0.1
export const LUCK_ROLL_AT_0_MAX = 0.1
export const LUCK_ROLL_AT_20_MIN = 0
export const LUCK_ROLL_AT_20_MAX = 0.2
export const LUCK_ROLL_AT_40_MIN = 0.1
export const LUCK_ROLL_AT_40_MAX = 0.5

export const DEFAULT_MAX_STAT = 40
export const DEFAULT_SATURATION_RATE = 2.0
