// F8/F9 디버그 오버레이용 helper
// RaceScene에서 문자열 조합/렌더 간격 계산을 분리해서 쓰기 쉽게 만든다.
export const AUTHORITATIVE_DEBUG_HOTKEYS = {
  TOGGLE_OVERLAY: 'F8',
  COPY_SNAPSHOT: 'F9',
} as const

const DEFAULT_DEBUG_RENDER_INTERVAL_MS = 250

function formatFixed(value: number, digits: number): string {
  return value.toFixed(digits)
}

export type AuthoritativeDebugMetrics = {
  frameCount: number
  hardSnapCount: number
  softCorrectionCount: number
  timeHardSnapCount: number
  positionErrorSum: number
  positionErrorMax: number
}

export function getAuthoritativeDebugMetricSummary(metrics: AuthoritativeDebugMetrics): {
  sampleCount: number
  meanError: number
} {
  // 샘플 수가 0이면 평균 계산이 깨지지 않게 최소 1로 처리한다.
  const sampleCount = Math.max(1, metrics.softCorrectionCount + metrics.hardSnapCount)
  const meanError = metrics.positionErrorSum / sampleCount
  return { sampleCount, meanError }
}

export function buildAuthoritativeDebugSnapshotLine(params: {
  currentSet: number
  simElapsedSec: number
  metrics: AuthoritativeDebugMetrics
}): string {
  const { sampleCount, meanError } = getAuthoritativeDebugMetricSummary(params.metrics)
  return [
    `set=${params.currentSet}`,
    `elapsedSec=${formatFixed(params.simElapsedSec, 3)}`,
    `frames=${params.metrics.frameCount}`,
    `samples=${sampleCount}`,
    `hardSnap=${params.metrics.hardSnapCount}`,
    `soft=${params.metrics.softCorrectionCount}`,
    `timeSnap=${params.metrics.timeHardSnapCount}`,
    `posErrMean=${formatFixed(meanError, 4)}`,
    `posErrMax=${formatFixed(params.metrics.positionErrorMax, 4)}`,
  ].join(' ')
}

function buildAuthoritativeDebugOverlayLines(params: {
  currentSet: number
  simElapsedSec: number
  metrics: AuthoritativeDebugMetrics
}): string[] {
  const { sampleCount, meanError } = getAuthoritativeDebugMetricSummary(params.metrics)
  return [
    `[AuthReplay] set=${params.currentSet} elapsed=${formatFixed(params.simElapsedSec, 2)}s`,
    `frames=${params.metrics.frameCount} samples=${sampleCount}`,
    `hardSnap=${params.metrics.hardSnapCount} soft=${params.metrics.softCorrectionCount} timeSnap=${params.metrics.timeHardSnapCount}`,
    `posErrMean=${formatFixed(meanError, 3)}m posErrMax=${formatFixed(params.metrics.positionErrorMax, 3)}m`,
  ]
}

export function buildAuthoritativeDebugOverlayText(params: {
  currentSet: number
  simElapsedSec: number
  metrics: AuthoritativeDebugMetrics
}): string {
  return buildAuthoritativeDebugOverlayLines(params).join('\n')
}

export function shouldRenderAuthoritativeDebugOverlay(params: {
  nowMs: number
  lastRenderMs: number
  minIntervalMs?: number
}): { shouldRender: boolean; nextLastRenderMs: number } {
  const minIntervalMs = params.minIntervalMs ?? DEFAULT_DEBUG_RENDER_INTERVAL_MS
  if (params.nowMs - params.lastRenderMs < minIntervalMs) {
    return { shouldRender: false, nextLastRenderMs: params.lastRenderMs }
  }
  return { shouldRender: true, nextLastRenderMs: params.nowMs }
}
