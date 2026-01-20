// =========================
// 물리 상수 & 게임 밸런스 파라미터
// =========================

/**
 * 트랙 설정
 */
export const TRACK_REAL_M = 500 // 트랙 길이 (미터)

/**
 * 시뮬레이션 설정
 */
export const DT = 0.05 // 시뮬레이션 시간 단위 (초)
export const MAX_SIM_TIME = 120 // 최대 시뮬레이션 시간 (초)

/**
 * Speed → 최고 속도 범위 (km/h)
 * - Speed 0: 58 km/h
 * - Speed 30: 68 km/h (기준점)
 * - Speed 30 초과: 페널티 적용 (비선형 증가)
 */
export const MIN_SPEED_KMH = 58 // Speed 0일 때의 최소 속도
export const SPEED_BONUS_RANGE = 10 // Speed 0 → 30까지의 속도 증가량 (58 → 68 km/h)

/**
 * 스태미나 소모 계수
 */
export const BASE_STAMINA_COST_PER_M = 0.1 // 기본 소모 계수 (1m당)
export const SPEED_STAMINA_COST_PER_M = 0.08 // 속도에 따른 추가 소모 (1m당)
export const STAMINA_COST_SPEED_CAP_MS = (60 * 1000) / 3600 // 스태미나 계산 속도 상한 (60km/h)

/**
 * Power → 가속 계수 범위
 * 로그 램프 가속 공식에 사용: v(t) = v_target * log(1 + k * t) / log(1 + k * T)
 * - Power 0: 0.3
 * - Power 30: 1.5 (기준점)
 * - k: Power 기반 가속 계수, T: 목표 가속 시간
 */
export const POWER_ACCEL_MIN = 0.3 // Power 0일 때의 가속 계수
export const POWER_ACCEL_MAX = 1.5 // Power 30일 때의 가속 계수

/**
 * Power + Start → 목표 가속 시간 범위 (초)
 * - Power 0 + Start 0: 7초 (느린 가속)
 * - Power 30 + Start 30: 3초 (빠른 가속, 기준점)
 * - Power 30 이상: 계속 감소 (능력치 차이 반영)
 * - 계산식: MAX - (tPower + tStart) * (MAX - MIN) / 2.0
 */
export const TARGET_ACCEL_TIME_MAX = 7.0 // 최대 가속 시간 (Power 0 + Start 0)
export const TARGET_ACCEL_TIME_MIN = 3.0 // 기준점 가속 시간 (Power 30 + Start 30, 최소값 아님)

/**
 * Stamina → 스태미나 소모 효율 계수 범위
 * - Stamina 0: 1.0 (기본 소모, 100%)
 * - Stamina 30: 0.45 (55% 감소, 기준점)
 * - 높을수록 스태미나 소모가 적음
 */
export const STAMINA_COST_FACTOR_MAX = 1.0 // Stamina 0일 때의 소모 계수 (기본)
export const STAMINA_COST_FACTOR_MIN = 0.45 // Stamina 30일 때의 소모 계수 (55% 감소)
export const STAMINA_COST_REDUCTION = 0.55 // 소모 감소 계수 (1.0 - 0.45 = 0.55)

/**
 * Guts → 피로 시 최소 속도 바닥 범위
 * 스태미나가 낮아질 때 속도가 떨어지는 최소 한계값
 * - Guts 0: 0.55 (최대 45% 감소 가능)
 * - Guts 30: 0.8 (최대 20% 감소만 가능, 기준점)
 */
export const GUTS_FATIGUE_FLOOR_MIN = 0.55 // Guts 0일 때의 최소 속도 비율
export const GUTS_FATIGUE_FLOOR_MAX = 0.8 // Guts 30일 때의 최소 속도 비율
export const GUTS_FATIGUE_FLOOR_RANGE = 0.25 // 바닥 증가 범위 (0.8 - 0.55 = 0.25)

/**
 * Start → 초반 가속 버프 범위 (초반 100m까지 적용)
 * - Start 0: 1.0 (버프 없음)
 * - Start 30: 1.3 (30% 가속 버프, 기준점)
 */
export const START_ACCEL_BOOST_BASE = 1.0 // Start 0일 때의 가속 버프 (버프 없음)
export const START_ACCEL_BOOST_RANGE = 0.3 // Start 0 → 30까지의 버프 증가량 (1.3 - 1.0 = 0.3)

/**
 * Start → 출발 딜레이 범위 (초)
 * - Start 0: 0~1초 (랜덤 딜레이)
 * - Start 30: 0초 (딜레이 없음, 기준점)
 */
export const START_DELAY_MAX = 1.0 // Start 0일 때의 최대 딜레이 시간

/**
 * Consistency → 컨디션 롤 범위 (로또형 운빨)
 * - Consistency 0: -3% ~ +3% (완전 랜덤)
 * - Consistency 10: -1.5% ~ +3% (음수 범위 축소)
 * - Consistency 20: 0% ~ +3% (음수 없음, 보너스만)
 */
export const COND_MIN_BONUS = -0.03 // 최소 -3%
export const COND_MAX_BONUS = 0.03 // 최대 +3%

/**
 * 능력치 정규화 기본 파라미터
 * 모든 능력치(Speed, Stamina, Power, Guts, Start)에 동일하게 적용
 * - 밸런스 테스트 시 모든 능력치를 동일한 조건에서 비교 가능
 * - 능력치별 차이는 정규화 이후의 적용 로직에서 처리
 */
export const DEFAULT_MAX_STAT = 40 // 최대 능력치: 능력치 40에서 정규화 값 1.0
export const DEFAULT_SATURATION_RATE = 2.0 // 지수 포화율: 높을수록 빠른 포화 (초반 급격, 후반 완만)
