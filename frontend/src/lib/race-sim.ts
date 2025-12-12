// =========================
// 전역 상수 설정
// =========================

// 말 최고속도 범위 (km/h) - Speed OP 완화를 위해 범위 더 축소
const MIN_SPEED_KMH = 58
const MAX_SPEED_KMH = 68

// 트랙 길이: 500m 레이스
export const TRACK_REAL_M = 500

// 시뮬레이션 시간 단위 (초)
export const DT = 0.05

// 최대 시뮬레이션 시간 (초)
const MAX_SIM_TIME = 120

// 구간 기준 (초반/중반 스냅샷용, 트랙 진행률 기준)
const EARLY_THRESHOLD = 0.33
const MID_THRESHOLD = 0.66

// 스태미나 기본 소모 계수 (1m당 기본 소모량) - Stamina 영향력 대폭 증가
const BASE_STAMINA_COST_PER_M = 0.1

// 속도에 따른 추가 스태미나 소모 계수 (1m당, 속도 정규화 반영) - Speed 페널티 증가
const SPEED_STAMINA_COST_PER_M = 0.08

// 속도 상한 (스태미나 계산용, 60km/h 근처)
const STAMINA_COST_SPEED_CAP_MS = (60 * 1000) / 3600 // 60km/h

// Power → 가속 계수 범위 - Power 영향력 약간 증가
const ACCEL_MIN = 0.03
const ACCEL_MAX = 0.8

// 컨디션(Consistency) 롤 범위 - Consistency 페널티 해결을 위해 범위 조정
const BASE_COND_RANGE = 0.005 // ±0.5% (기본 변동)
const EXTRA_COND_RANGE = 0.01 // Cons 낮을수록 최대 ±1.5% (총 ±2.0%)

type StatName = 'Speed' | 'Stamina' | 'Power' | 'Guts' | 'Start' | 'Consistency'

export interface Stats {
  Speed: number
  Stamina: number
  Power: number
  Guts: number
  Start: number
  Consistency: number
}

type EffectiveStats = Stats

interface SnapshotOrder {
  name: string
  position: number
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1))
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

function round(v: number, digits: number = 3): number {
  const p = Math.pow(10, digits)
  return Math.round(v * p) / p
}

function kmhToMs(kmh: number): number {
  return (kmh * 1000) / 3600
}

// phase별 기본 속도 비율 (전말 공통)
function getPhaseBaseMultiplier(progress: number): number {
  if (progress < 0.3) return 0.98 // 초반 약간 느리게
  if (progress < 0.7) return 1.0 // 중반 기준
  return 1.02 // 후반 약간 빠르게
}

const STAT_NAMES: StatName[] = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Consistency']

// =========================
// 스탯 생성 (총합 90)
// =========================

export function generateRandomStats(): Stats {
  const stats: Stats = {
    Speed: 8,
    Stamina: 8,
    Power: 8,
    Guts: 8,
    Start: 8,
    Consistency: 8,
  }

  let remaining = 90 - 6 * 8

  while (remaining > 0) {
    const key = STAT_NAMES[randInt(0, STAT_NAMES.length - 1)]
    if (stats[key] < 20) {
      stats[key] += 1
      remaining -= 1
    }
  }

  return stats
}

// Speed를 고정한 상태에서 나머지 스탯만 랜덤 분배 (총합 90 유지용)
export function generateRandomStatsWithFixedSpeed(fixedSpeed: number): Stats {
  const sp = clamp(Math.round(fixedSpeed), 1, 20)

  const stats: Stats = {
    Speed: sp,
    Stamina: 8,
    Power: 8,
    Guts: 8,
    Start: 8,
    Consistency: 8,
  }

  // Speed를 제외한 5개 스탯에 분배
  const otherKeys: StatName[] = ['Stamina', 'Power', 'Guts', 'Start', 'Consistency']
  let remaining = 90 - sp - otherKeys.length * 8

  // 혹시라도 fixedSpeed가 너무 커서 remaining이 음수면 안전하게 0으로
  if (remaining < 0) remaining = 0

  while (remaining > 0) {
    const key = otherKeys[randInt(0, otherKeys.length - 1)]
    if (stats[key] < 20) {
      stats[key] += 1
      remaining -= 1
    }
  }

  return stats
}

// =========================
// Horse 클래스
// =========================

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

  // 현재 상태
  currentSpeed: number = 0
  position: number = 0
  stamina: number = 0
  finished: boolean = false
  finishTime: number | null = null
  raceStartTime: number = 0 // 실제 레이스 시작 시간 (출발 딜레이 반영)

  // 컨디션 롤 기록 (디버그용)
  conditionRoll: number = 0

  constructor(name: string, baseStats: Stats) {
    this.name = name
    this.baseStats = baseStats
    this.effStats = { ...baseStats }
  }

  prepareForRace(): void {
    const s = this.baseStats

    // 1) Consistency 기반 컨디션 롤 (Consistency 페널티 해결)
    const tCons = clamp(s.Consistency / 20, 0, 1)
    // Consistency가 낮을수록 변동이 크고, 높을수록 변동이 작지만 평균적으로 약간의 보너스
    const condRange = BASE_COND_RANGE + EXTRA_COND_RANGE * (1 - tCons)
    const cond = randFloat(-condRange, condRange)
    // Consistency가 높을수록 평균적으로 보너스 (안정성 보상 추가 증가)
    const consistencyBonus = 0.03 * tCons // Consistency 20일 때 +3% 보너스 (2% → 3%로 증가)
    const mult = 1.0 + cond + consistencyBonus
    this.conditionRoll = cond + consistencyBonus

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

    const tSpeed = clamp(e.Speed / 20, 0, 1)
    const tStamina = clamp(e.Stamina / 20, 0, 1)
    const tPower = clamp(e.Power / 20, 0, 1)
    const tGuts = clamp(e.Guts / 20, 0, 1)
    const tStart = clamp(e.Start / 20, 0, 1)

    // tSpeed 저장 (스태미나 페널티 계산용)
    this.tSpeedNormalized = tSpeed

    // 2) Speed → 최고 속도 (비선형 완화 - Speed 영향력 증가)
    const tSpeedEff = Math.pow(tSpeed, 0.65) // 한 스탯에 몰빵 효율 감소 (0.55 → 0.65로 완화)
    const maxSpeedKmh = MIN_SPEED_KMH + (MAX_SPEED_KMH - MIN_SPEED_KMH) * tSpeedEff
    this.maxSpeed_ms = kmhToMs(maxSpeedKmh)

    // 3) Stamina → 스태미나 소모 효율만 관여 (최대 스태미나는 모든 말 동일하게 100)
    this.maxStamina = 100 // 모든 말 동일한 최대 스태미나
    this.staminaCostFactor = 1.0 - 0.55 * tStamina // 0.45 ~ 1.0 (효율 차이 추가 확대: 0.5 → 0.55)
    this.staminaCostFactor = clamp(this.staminaCostFactor, 0.45, 1.0)

    // 4) Power → 가속 계수
    this.accelFactor = ACCEL_MIN + (ACCEL_MAX - ACCEL_MIN) * tPower

    // 5) Guts → 피로 시 최소 속도 바닥 (Guts 과도한 영향 완화)
    this.fatigueFloor = 0.55 + 0.25 * tGuts // 0.55 ~ 0.80 (0.5~0.85 → 0.55~0.80으로 축소)
    this.fatigueFloor = clamp(this.fatigueFloor, 0.55, 0.8)

    // 6) Start → 초반 가속 버프 + 출발 딜레이
    // 초반 가속 버프: 여기서는 계수만 계산, 실사용은 step()에서 position<100일 때 가속에 곱함
    // Start가 높을수록 초반에 목표 속도에 더 빨리 도달 (스태미나 소모는 동일)
    this.startAccelBoost = 1 + 0.5 * tStart // Start 0 → 1.0, Start 20 → 1.5 (0.3 → 0.5로 증가)

    // 출발 딜레이: Start가 높을수록 딜레이 범위가 줄어듦
    // Start = 0 → 0~1초, Start = 10 → 0~0.5초, Start = 20 → 0초
    const maxDelay = 1.0 - tStart // Start 0 → 1.0초, Start 20 → 0초
    this.startDelay = randFloat(0, maxDelay)

    // 7) Consistency → 페이스 페널티는 일단 1.0(중립)로
    this.consPaceFactor = 1.0

    // 8) 초기 상태 세팅
    this.currentSpeed = this.maxSpeed_ms * 0.9
    this.position = 0
    this.stamina = this.maxStamina
    this.finished = false
    this.finishTime = null
    this.raceStartTime = this.startDelay // 실제 레이스 시작 시간 = 출발 딜레이
  }

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

    // 1) 구간별 기본 목표 속도 (전말 공통)
    let phaseMult = getPhaseBaseMultiplier(progress)

    // Consistency: 전구간 페이스(현재는 1.0이라 영향 없음)
    phaseMult *= this.consPaceFactor

    // 2) 목표 속도 계산
    const targetSpeed = this.maxSpeed_ms * phaseMult

    // 3) Power 기반 가속/감속 + Start 기반 초반(100m까지) 가속 버프
    let accel = this.accelFactor

    if (this.position < 100) {
      accel *= this.startAccelBoost
    }

    this.currentSpeed += (targetSpeed - this.currentSpeed) * accel
    if (this.currentSpeed < 0) this.currentSpeed = 0

    // 4) 스태미나 소모 계산 (Speed 페널티 추가)
    const speedForCost = Math.min(this.currentSpeed, STAMINA_COST_SPEED_CAP_MS)
    const distanceThisStep = this.currentSpeed * dt
    const speedNorm = STAMINA_COST_SPEED_CAP_MS > 0 ? speedForCost / STAMINA_COST_SPEED_CAP_MS : 0

    // 기본 소모 + 속도 비례 소모 (둘 다 "1m당" 관점)
    let staminaCostPerM = BASE_STAMINA_COST_PER_M + SPEED_STAMINA_COST_PER_M * speedNorm

    // Speed 스탯이 높을수록 추가 스태미나 소모 페널티 (Speed 영향력 증가를 위해 감소)
    const speedPenalty = 1.0 + 0.1 * this.tSpeedNormalized // Speed 20일 때 10% 추가 소모 (15% → 10%로 감소)
    staminaCostPerM *= speedPenalty

    let staminaCost = staminaCostPerM * distanceThisStep

    // Stamina 스탯 기반 효율 반영
    staminaCost *= this.staminaCostFactor

    // 스태미나 감소
    this.stamina -= staminaCost
    if (this.stamina < 0) this.stamina = 0

    // 5) 피로 보정 (Guts 기반 바닥 + 스태미나 잔량) - Stamina 영향력 증가를 위해 더 일찍/강하게 적용
    let staminaRatio = this.maxStamina > 0 ? this.stamina / this.maxStamina : 0
    staminaRatio = clamp(staminaRatio, 0, 1)

    let fatigueFactor = 1.0
    // 피로 보정 시작점을 0.95 → 0.92로 추가 하향 (Stamina 영향력 추가 증가)
    if (staminaRatio < 0.92) {
      const x = staminaRatio / 0.92
      // Stamina 영향력 증가를 위해 피로 보정 곡선 더 강화
      const fatigueCurve = Math.pow(x, 0.6) // 더 급격한 감소 (0.7 → 0.6)
      fatigueFactor = this.fatigueFloor + (1 - this.fatigueFloor) * fatigueCurve
      fatigueFactor = clamp(fatigueFactor, this.fatigueFloor, 1.0)
    }

    this.currentSpeed *= fatigueFactor

    // 6) 위치 업데이트
    this.position += this.currentSpeed * dt

    if (this.position >= TRACK_REAL_M && !this.finished) {
      this.finished = true
      this.finishTime = currentTime
    }
  }
}

// =========================
// 순위 스냅샷 유틸
// =========================

function snapshotOrder(horses: Horse[]): SnapshotOrder[] {
  return horses
    .map((h) => ({ name: h.name, position: h.position }))
    .sort((a, b) => b.position - a.position)
}

function buildRankMap(snapshot: SnapshotOrder[] | null): Record<string, number | null> {
  const map: Record<string, number | null> = {}
  if (!snapshot) return map
  snapshot.forEach((h, idx) => {
    map[h.name] = idx + 1
  })
  return map
}

// =========================
// 레이스 시뮬레이션
// =========================

export interface RaceResult {
  rank: number
  horse: Horse
  finishTime: number | null
  position: number
  staminaRatio: number
  earlyRank: number | null
  midRank: number | null
  finalRank: number
  conditionRoll: number
}

export interface RaceOptions {
  numHorses?: number
  horses?: Array<{ name: string; stats: Stats }>
  trackDistance?: number
  fixedSpeed?: number // Speed 고정 실험용 (horses가 없을 때만 사용)
}

export function runRace(options: RaceOptions = {}): RaceResult[] {
  const { numHorses = 8, horses: customHorses, trackDistance = TRACK_REAL_M, fixedSpeed } = options

  const horses: Horse[] = []

  if (customHorses && customHorses.length > 0) {
    // 명시적으로 말 리스트를 전달한 경우 fixedSpeed는 무시
    for (const h of customHorses) {
      const horse = new Horse(h.name, h.stats)
      horse.prepareForRace()
      horses.push(horse)
    }
  } else {
    // 자동 생성 모드
    for (let i = 0; i < numHorses; i++) {
      const baseStats =
        fixedSpeed != null ? generateRandomStatsWithFixedSpeed(fixedSpeed) : generateRandomStats()
      const horse = new Horse(`Horse_${i + 1}`, baseStats)
      horse.prepareForRace()
      horses.push(horse)
    }
  }

  let time = 0
  let earlySnapshot: SnapshotOrder[] | null = null
  let midSnapshot: SnapshotOrder[] | null = null

  while (time < MAX_SIM_TIME) {
    let allFinished = true

    for (const h of horses) {
      if (!h.finished) {
        h.step(DT, time)
      }
      if (!h.finished) {
        allFinished = false
      }
    }

    const maxProgress = Math.max(...horses.map((h) => h.position / trackDistance))

    if (!earlySnapshot && maxProgress >= EARLY_THRESHOLD) {
      earlySnapshot = snapshotOrder(horses)
    }
    if (!midSnapshot && maxProgress >= MID_THRESHOLD) {
      midSnapshot = snapshotOrder(horses)
    }

    if (allFinished) break
    time += DT
  }

  const results = horses
    .map((h) => ({
      horse: h,
      finishTime: h.finishTime ?? Infinity,
      position: h.position,
      staminaRatio: h.stamina / h.maxStamina,
    }))
    .sort((a, b) => {
      const aFinished = a.finishTime !== Infinity
      const bFinished = b.finishTime !== Infinity

      if (aFinished && bFinished) {
        return (a.finishTime as number) - (b.finishTime as number)
      }
      if (aFinished && !bFinished) return -1
      if (!aFinished && bFinished) return 1
      return b.position - a.position
    })

  const finalSnapshot: SnapshotOrder[] = results.map((r) => ({
    name: r.horse.name,
    position: r.position,
  }))

  const earlyRankMap = buildRankMap(earlySnapshot)
  const midRankMap = buildRankMap(midSnapshot)
  const finalRankMap = buildRankMap(finalSnapshot)

  return results.map((r, idx) => {
    const h = r.horse
    const finished = r.finishTime !== Infinity

    return {
      rank: idx + 1,
      horse: h,
      finishTime: finished ? (r.finishTime as number) : null,
      position: r.position,
      staminaRatio: r.staminaRatio,
      earlyRank: earlyRankMap[h.name] ?? null,
      midRank: midRankMap[h.name] ?? null,
      finalRank: finalRankMap[h.name] ?? idx + 1,
      conditionRoll: h.conditionRoll,
    }
  })
}

// =========================
// 콘솔 출력용
// =========================

export function printRaceResults(results: RaceResult[]): void {
  console.log('\n=== Race Result Table (500m 레이스 결과) ===\n')

  type Row = {
    'Rank(순위)': number
    'Horse(말 이름)': string
    'Time_s(기록초)': string
    'Dist_m(거리m)': string
    'StaminaLeft_%(남은스태%)': string
    'EarlyRank(초반순위)': string
    'MidRank(중반순위)': string
    'FinalRank(최종순위)': string
    'Condition_%(컨디션%)': string
  }

  const table: Row[] = results.map((r) => {
    const h = r.horse
    const finished = r.finishTime !== null
    const timeStr = finished ? round(r.finishTime as number, 3).toFixed(3) : 'DNF'

    return {
      'Rank(순위)': r.rank,
      'Horse(말 이름)': h.name,
      'Time_s(기록초)': timeStr,
      'Dist_m(거리m)': round(r.position, 2).toFixed(2),
      'StaminaLeft_%(남은스태%)': (r.staminaRatio * 100).toFixed(1),
      'EarlyRank(초반순위)': r.earlyRank ? String(r.earlyRank) : '-',
      'MidRank(중반순위)': r.midRank ? String(r.midRank) : '-',
      'FinalRank(최종순위)': String(r.finalRank),
      'Condition_%(컨디션%)': (r.conditionRoll * 100).toFixed(1),
    }
  })

  console.table(table)
}

export function printHorseStats(horses: Horse[]): void {
  console.log('=== Horse Stats (Base & Effective with Condition / 말 능력치 상세) ===')
  horses.forEach((h) => {
    console.log(`\n[${h.name}]`)
    console.log(`  Condition Roll(컨디션 롤): ${(h.conditionRoll * 100).toFixed(1)}%`)
    console.log('  Base Stats(기본 능력치):      ', h.baseStats)
    console.log(
      '  Effective Stats(컨디션 적용 후): ',
      Object.fromEntries(Object.entries(h.effStats).map(([k, v]) => [k, round(v as number, 2)])),
    )
  })
}

export function printHorseStatsTable(horses: Horse[]): void {
  console.log('\n=== Horse Stats Table (말 능력치 요약) ===\n')

  type StatRow = {
    'Horse(말 이름)': string
    'Speed(속도)': string
    'Stamina(지구력)': string
    'Power(가속)': string
    'Guts(근성)': string
    'Start(출발)': string
    'Consistency(안정성)': string
    'Condition_%(컨디션%)': string
    'Total(합계)': string
  }

  const table: StatRow[] = horses.map((h) => {
    const baseTotal =
      h.baseStats.Speed +
      h.baseStats.Stamina +
      h.baseStats.Power +
      h.baseStats.Guts +
      h.baseStats.Start +
      h.baseStats.Consistency

    return {
      'Horse(말 이름)': h.name,
      'Speed(속도)': String(Math.round(h.baseStats.Speed)),
      'Stamina(지구력)': String(Math.round(h.baseStats.Stamina)),
      'Power(가속)': String(Math.round(h.baseStats.Power)),
      'Guts(근성)': String(Math.round(h.baseStats.Guts)),
      'Start(출발)': String(Math.round(h.baseStats.Start)),
      'Consistency(안정성)': String(Math.round(h.baseStats.Consistency)),
      'Condition_%(컨디션%)': (h.conditionRoll * 100).toFixed(1),
      'Total(합계)': String(baseTotal),
    }
  })

  console.table(table)
}

// =========================
// 단일 레이스 분석
// =========================

export function analyzeRaceResults(results: RaceResult[]): void {
  if (results.length === 0) {
    console.log('\n[Race Analysis] 분석할 레이스 결과가 없습니다.\n')
    return
  }

  console.log('\n=== Race Analysis (이번 레이스 능력치 영향 분석) ===\n')
  console.log('※ 기준: 컨디션이 반영된 실질 능력치(effStats)를 사용\n')

  const statKeys: (keyof Stats)[] = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Consistency']

  const labelMap: Record<keyof Stats, string> = {
    Speed: 'Speed(속도)',
    Stamina: 'Stamina(지구력)',
    Power: 'Power(가속)',
    Guts: 'Guts(근성)',
    Start: 'Start(출발)',
    Consistency: 'Consistency(안정성)',
  }

  function getAvgStats(horses: Horse[]): Record<keyof Stats, number> {
    const sums: Record<keyof Stats, number> = {
      Speed: 0,
      Stamina: 0,
      Power: 0,
      Guts: 0,
      Start: 0,
      Consistency: 0,
    }
    if (horses.length === 0) return sums
    for (const h of horses) {
      sums.Speed += h.effStats.Speed
      sums.Stamina += h.effStats.Stamina
      sums.Power += h.effStats.Power
      sums.Guts += h.effStats.Guts
      sums.Start += h.effStats.Start
      sums.Consistency += h.effStats.Consistency
    }
    const avg: Record<keyof Stats, number> = { ...sums }
    for (const key of statKeys) {
      avg[key] = avg[key] / horses.length
    }
    return avg
  }

  const N = Math.min(3, results.length)
  const topHorses: Horse[] = results.slice(0, N).map((r) => r.horse)
  const bottomHorses: Horse[] = results.slice(-N).map((r) => r.horse)
  const allHorses: Horse[] = results.map((r) => r.horse)

  const avgAll = getAvgStats(allHorses)
  const avgTop = getAvgStats(topHorses)
  const avgBottom = getAvgStats(bottomHorses)

  type Row = {
    'Stat(능력치)': string
    'All_avg(전체평균)': string
    'Top_avg(상위평균)': string
    'Bottom_avg(하위평균)': string
    'Diff(Top-Bottom)': string
    'Comment(코멘트)': string
  }

  type StatDiff = {
    key: keyof Stats
    label: string
    diff: number
    top: number
    bottom: number
    all: number
  }

  const diffs: StatDiff[] = statKeys.map((key) => {
    const aAll = avgAll[key]
    const aTop = avgTop[key]
    const aBottom = avgBottom[key]
    const diff = aTop - aBottom
    return {
      key,
      label: labelMap[key],
      diff,
      top: aTop,
      bottom: aBottom,
      all: aAll,
    }
  })

  const table: Row[] = diffs.map((s) => {
    const absDiff = Math.abs(s.diff)
    let comment: string
    if (absDiff < 0.3) {
      comment = '거의 영향 없음 / 비슷함'
    } else if (absDiff < 0.8) {
      comment = s.diff > 0 ? '상위권이 조금 더 높음' : '하위권이 조금 더 높음'
    } else {
      comment = s.diff > 0 ? '상위권에서 강하게 작용' : '하위권에서 더 높음(오버스펙?)'
    }
    return {
      'Stat(능력치)': s.label,
      'All_avg(전체평균)': round(s.all, 2).toFixed(2),
      'Top_avg(상위평균)': round(s.top, 2).toFixed(2),
      'Bottom_avg(하위평균)': round(s.bottom, 2).toFixed(2),
      'Diff(Top-Bottom)': round(s.diff, 2).toFixed(2),
      'Comment(코멘트)': comment,
    }
  })

  console.table(table)

  const sortedByDiff = [...diffs].sort((a, b) => b.diff - a.diff)
  const strongPos = sortedByDiff.filter((s) => s.diff >= 1.0)
  const weakPos = sortedByDiff.filter((s) => s.diff >= 0.5 && s.diff < 1.0)
  const strongNeg = sortedByDiff.filter((s) => s.diff <= -1.0)
  const weakNeg = sortedByDiff.filter((s) => s.diff <= -0.5 && s.diff > -1.0)

  function labels(list: StatDiff[]): string {
    return list.map((s) => s.label).join(', ')
  }

  console.log('\n--- 자연어 해석 ---')

  if (strongPos.length > 0) {
    console.log(`- 이번 판에서 특히 잘 먹힌 스탯: ${labels(strongPos)}`)
  }
  if (weakPos.length > 0) {
    console.log(`- 상위권에서 살짝 우세했던 스탯: ${labels(weakPos)}`)
  }
  if (strongNeg.length > 0) {
    console.log(`- 오히려 높다고 좋은 건 아니었던 스탯(하위권에서 더 높음): ${labels(strongNeg)}`)
  }
  if (weakNeg.length > 0) {
    console.log(`- 미묘하게 역효과/과투자 느낌이었던 스탯: ${labels(weakNeg)}`)
  }

  if (
    strongPos.length === 0 &&
    weakPos.length === 0 &&
    strongNeg.length === 0 &&
    weakNeg.length === 0
  ) {
    console.log('- 상위/하위 스탯 차이가 전체적으로 크지 않은 판이었습니다.')
  }

  console.log('\n※ 해석 팁:')
  console.log('- "잘 먹힌 스탯"들은 이번 레이스 규칙/코스/운이랑 궁합이 좋았던 값')
  console.log(
    '- "하위권에서 더 높은 스탯"들은 수치가 높아도 이번 판에선 오히려 독이 된 경우일 수 있음',
  )
  console.log('- 여러 판 돌려서 공통으로 반복되는 패턴이 있는지 보는 게 중요함.\n')
}

// =========================
// 다중 레이스: 전역 메타 분석 (기본 버전)
// =========================

export function simulateStatImpact(numRaces: number = 200, numHorses: number = 8): void {
  console.log(
    `\n=== Global Stat Impact Simulation (총 ${numRaces}판, 레이스당 ${numHorses}두) ===\n`,
  )
  console.log('※ Perf = -finishTime (기록이 짧을수록 성능이 높게 계산됨)\n')

  const statKeys: (keyof Stats)[] = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Consistency']

  type Agg = {
    n: number
    sumStat: number
    sumStatSq: number
    sumPerf: number
    sumPerfSq: number
    sumStatPerf: number
    sumWinnerStat: number
    nWinner: number
    sumTop3Stat: number
    nTop3: number
  }

  function initAgg(): Agg {
    return {
      n: 0,
      sumStat: 0,
      sumStatSq: 0,
      sumPerf: 0,
      sumPerfSq: 0,
      sumStatPerf: 0,
      sumWinnerStat: 0,
      nWinner: 0,
      sumTop3Stat: 0,
      nTop3: 0,
    }
  }

  const agg: Record<keyof Stats, Agg> = {
    Speed: initAgg(),
    Stamina: initAgg(),
    Power: initAgg(),
    Guts: initAgg(),
    Start: initAgg(),
    Consistency: initAgg(),
  }

  for (let i = 0; i < numRaces; i++) {
    const results = runRace({ numHorses })
    for (const r of results) {
      const h = r.horse
      const perf = r.finishTime !== null ? -r.finishTime : -MAX_SIM_TIME
      for (const key of statKeys) {
        const a = agg[key]
        const statVal = h.effStats[key]

        a.n++
        a.sumStat += statVal
        a.sumStatSq += statVal * statVal
        a.sumPerf += perf
        a.sumPerfSq += perf * perf
        a.sumStatPerf += statVal * perf

        if (r.rank === 1) {
          a.sumWinnerStat += statVal
          a.nWinner++
        }
        if (r.rank <= 3) {
          a.sumTop3Stat += statVal
          a.nTop3++
        }
      }
    }
  }

  type Row = {
    'Stat(능력치)': string
    'All_avg(전체평균)': string
    'Winner_avg(1위평균)': string
    'Top3_avg(상위3위평균)': string
    'Corr_vs_perf(성능상관)': string
    'Design_target(의도상관)': string
    'Gap(실제-의도)': string
    'Comment(해석)': string
  }

  const labelMap: Record<keyof Stats, string> = {
    Speed: 'Speed(속도)',
    Stamina: 'Stamina(지구력)',
    Power: 'Power(가속)',
    Guts: 'Guts(근성)',
    Start: 'Start(출발)',
    Consistency: 'Consistency(안정성)',
  }

  const designTarget: Record<keyof Stats, number> = {
    Speed: 0.35,
    Stamina: 0.5,
    Power: 0.45,
    Guts: 0.45,
    Start: 0.1,
    Consistency: -0.25,
  }

  function calcCorr(a: Agg): number {
    if (a.n === 0) return 0
    const n = a.n
    const meanStat = a.sumStat / n
    const meanPerf = a.sumPerf / n

    const cov = a.sumStatPerf / n - meanStat * meanPerf
    const varStat = a.sumStatSq / n - meanStat * meanStat
    const varPerf = a.sumPerfSq / n - meanPerf * meanPerf

    if (varStat <= 0 || varPerf <= 0) return 0
    return cov / Math.sqrt(varStat * varPerf)
  }

  const table: Row[] = statKeys.map((key) => {
    const a = agg[key]
    const corr = calcCorr(a)

    const allAvg = a.n > 0 ? a.sumStat / a.n : 0
    const winAvg = a.nWinner > 0 ? a.sumWinnerStat / a.nWinner : 0
    const top3Avg = a.nTop3 > 0 ? a.sumTop3Stat / a.nTop3 : 0

    const absCorr = Math.abs(corr)
    let comment: string
    if (absCorr < 0.1) {
      comment = '거의 영향 없음'
    } else if (absCorr < 0.25) {
      comment = '약한 영향'
    } else if (absCorr < 0.4) {
      comment = '중간 정도 영향'
    } else if (absCorr < 0.6) {
      comment = '꽤 강한 영향'
    } else {
      comment = '매우 강한 핵심 스탯'
    }

    const signText = corr > 0 ? '높을수록 유리' : corr < 0 ? '높을수록 불리 경향' : '중립'
    const target = designTarget[key]
    const gap = corr - target

    return {
      'Stat(능력치)': labelMap[key],
      'All_avg(전체평균)': round(allAvg, 2).toFixed(2),
      'Winner_avg(1위평균)': round(winAvg, 2).toFixed(2),
      'Top3_avg(상위3위평균)': round(top3Avg, 2).toFixed(2),
      'Corr_vs_perf(성능상관)': round(corr, 3).toFixed(3),
      'Design_target(의도상관)': target.toFixed(3),
      'Gap(실제-의도)': round(gap, 3).toFixed(3),
      'Comment(해석)': `${comment} / ${signText}`,
    }
  })

  console.table(table)

  console.log('\n※ 해석 가이드:')
  console.log('- Corr_vs_perf > 0: 스탯이 높을수록 기록이 빨라지는 경향 (좋은 스탯)')
  console.log(
    '- Corr_vs_perf < 0: 스탯이 높을수록 오히려 기록이 느려지는 경향 (과투자/리스크 가능성)',
  )
  console.log('- Winner_avg와 All_avg 차이가 큰 스탯일수록, 1등 말들이 많이 가져가는 능력치')
  console.log('- Design_target 대비 Gap을 보면서 튜닝 방향을 잡으면 됨.')
  console.log('- 표본 수(numRaces)를 500~1000까지 올리면 메타가 더 안정적으로 보임.\n')
}

// =========================
// 다중 레이스: Speed 고정 메타 분석용
// =========================

// 예시: simulateStatImpactFixedSpeed(1000, 8, 15)
// → Speed를 전부 15로 고정해놓고 나머지 스탯 메타를 보는 실험
export function simulateStatImpactFixedSpeed(
  numRaces: number = 200,
  numHorses: number = 8,
  fixedSpeed: number = 15,
): void {
  console.log(
    `\n=== Global Stat Impact Simulation (Speed=${fixedSpeed} 고정, 총 ${numRaces}판, 레이스당 ${numHorses}두) ===\n`,
  )
  console.log('※ Perf = -finishTime (기록이 짧을수록 성능이 높게 계산됨)')
  console.log(
    '※ 모든 말의 Speed를 동일하게 고정하여, 나머지 스탯 메타만 분리해서 보는 실험입니다.\n',
  )

  const statKeys: (keyof Stats)[] = ['Speed', 'Stamina', 'Power', 'Guts', 'Start', 'Consistency']

  type Agg = {
    n: number
    sumStat: number
    sumStatSq: number
    sumPerf: number
    sumPerfSq: number
    sumStatPerf: number
    sumWinnerStat: number
    nWinner: number
    sumTop3Stat: number
    nTop3: number
  }

  function initAgg(): Agg {
    return {
      n: 0,
      sumStat: 0,
      sumStatSq: 0,
      sumPerf: 0,
      sumPerfSq: 0,
      sumStatPerf: 0,
      sumWinnerStat: 0,
      nWinner: 0,
      sumTop3Stat: 0,
      nTop3: 0,
    }
  }

  const agg: Record<keyof Stats, Agg> = {
    Speed: initAgg(),
    Stamina: initAgg(),
    Power: initAgg(),
    Guts: initAgg(),
    Start: initAgg(),
    Consistency: initAgg(),
  }

  for (let i = 0; i < numRaces; i++) {
    const results = runRace({ numHorses, fixedSpeed })
    for (const r of results) {
      const h = r.horse
      const perf = r.finishTime !== null ? -r.finishTime : -MAX_SIM_TIME
      for (const key of statKeys) {
        const a = agg[key]
        const statVal = h.effStats[key]

        a.n++
        a.sumStat += statVal
        a.sumStatSq += statVal * statVal
        a.sumPerf += perf
        a.sumPerfSq += perf * perf
        a.sumStatPerf += statVal * perf

        if (r.rank === 1) {
          a.sumWinnerStat += statVal
          a.nWinner++
        }
        if (r.rank <= 3) {
          a.sumTop3Stat += statVal
          a.nTop3++
        }
      }
    }
  }

  type Row = {
    'Stat(능력치)': string
    'All_avg(전체평균)': string
    'Winner_avg(1위평균)': string
    'Top3_avg(상위3위평균)': string
    'Corr_vs_perf(성능상관)': string
    'Design_target(의도상관)': string
    'Gap(실제-의도)': string
    'Comment(해석)': string
  }

  const labelMap: Record<keyof Stats, string> = {
    Speed: 'Speed(속도)',
    Stamina: 'Stamina(지구력)',
    Power: 'Power(가속)',
    Guts: 'Guts(근성)',
    Start: 'Start(출발)',
    Consistency: 'Consistency(안정성)',
  }

  // Speed는 고정값이라, 이 실험에서의 의도상관은 0.0으로 두는 게 깔끔
  const designTarget: Record<keyof Stats, number> = {
    Speed: 0.0,
    Stamina: 0.5,
    Power: 0.45,
    Guts: 0.45,
    Start: 0.1,
    Consistency: -0.25,
  }

  function calcCorr(a: Agg): number {
    if (a.n === 0) return 0
    const n = a.n
    const meanStat = a.sumStat / n
    const meanPerf = a.sumPerf / n

    const cov = a.sumStatPerf / n - meanStat * meanPerf
    const varStat = a.sumStatSq / n - meanStat * meanStat
    const varPerf = a.sumPerfSq / n - meanPerf * meanPerf

    if (varStat <= 0 || varPerf <= 0) return 0
    return cov / Math.sqrt(varStat * varPerf)
  }

  const table: Row[] = statKeys.map((key) => {
    const a = agg[key]
    const corr = calcCorr(a)

    const allAvg = a.n > 0 ? a.sumStat / a.n : 0
    const winAvg = a.nWinner > 0 ? a.sumWinnerStat / a.nWinner : 0
    const top3Avg = a.nTop3 > 0 ? a.sumTop3Stat / a.nTop3 : 0

    const absCorr = Math.abs(corr)
    let comment: string
    if (absCorr < 0.1) {
      comment = '거의 영향 없음'
    } else if (absCorr < 0.25) {
      comment = '약한 영향'
    } else if (absCorr < 0.4) {
      comment = '중간 정도 영향'
    } else if (absCorr < 0.6) {
      comment = '꽤 강한 영향'
    } else {
      comment = '매우 강한 핵심 스탯'
    }

    const signText = corr > 0 ? '높을수록 유리' : corr < 0 ? '높을수록 불리 경향' : '중립'
    const target = designTarget[key]
    const gap = corr - target

    return {
      'Stat(능력치)': labelMap[key],
      'All_avg(전체평균)': round(allAvg, 2).toFixed(2),
      'Winner_avg(1위평균)': round(winAvg, 2).toFixed(2),
      'Top3_avg(상위3위평균)': round(top3Avg, 2).toFixed(2),
      'Corr_vs_perf(성능상관)': round(corr, 3).toFixed(3),
      'Design_target(의도상관)': target.toFixed(3),
      'Gap(실제-의도)': round(gap, 3).toFixed(3),
      'Comment(해석)': `${comment} / ${signText}`,
    }
  })

  console.table(table)

  console.log('\n※ Speed 고정 실험 해석 가이드:')
  console.log(
    '- Speed는 모든 말이 동일하므로, Speed 행의 Corr_vs_perf는 거의 0이 나오는 것이 정상입니다.',
  )
  console.log('- 나머지 스탯(Stamina/Power/Guts/Start/Consistency)의 상관을 보면서,')
  console.log('  "Speed를 빼고 나면 어떤 스탯이 실제로 기록에 기여하는지"를 확인하는 용도입니다.')
  console.log(
    '- 이 결과와 기본 simulateStatImpact 결과를 비교하면, Speed OP 문제를 어디서 어떻게 줄여야 할지 감이 더 잘 올 거예요.\n',
  )
}
