// F8/F9 디버그 오버레이용 helper
// RaceScene에서 문자열 조합/렌더 간격 계산을 분리해서 쓰기 쉽게 만든다.
export const AUTHORITATIVE_DEBUG_HOTKEYS = {
  TOGGLE_OVERLAY: 'F8',
  COPY_SNAPSHOT: 'F9',
} as const

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
  // 클립보드 복사용 1줄 요약 문자열
  const { sampleCount, meanError } = getAuthoritativeDebugMetricSummary(params.metrics)
  return [
    `set=${params.currentSet}`,
    `elapsedSec=${params.simElapsedSec.toFixed(3)}`,
    `frames=${params.metrics.frameCount}`,
    `samples=${sampleCount}`,
    `hardSnap=${params.metrics.hardSnapCount}`,
    `soft=${params.metrics.softCorrectionCount}`,
    `timeSnap=${params.metrics.timeHardSnapCount}`,
    `posErrMean=${meanError.toFixed(4)}`,
    `posErrMax=${params.metrics.positionErrorMax.toFixed(4)}`,
  ].join(' ')
}

export function buildAuthoritativeDebugOverlayText(params: {
  currentSet: number
  simElapsedSec: number
  metrics: AuthoritativeDebugMetrics
}): string {
  // 화면 오버레이로 보여주는 여러 줄 텍스트
  const { sampleCount, meanError } = getAuthoritativeDebugMetricSummary(params.metrics)
  return [
    `[AuthReplay] set=${params.currentSet} elapsed=${params.simElapsedSec.toFixed(2)}s`,
    `frames=${params.metrics.frameCount} samples=${sampleCount}`,
    `hardSnap=${params.metrics.hardSnapCount} soft=${params.metrics.softCorrectionCount} timeSnap=${params.metrics.timeHardSnapCount}`,
    `posErrMean=${meanError.toFixed(3)}m posErrMax=${params.metrics.positionErrorMax.toFixed(3)}m`,
  ].join('\n')
}

export function shouldRenderAuthoritativeDebugOverlay(params: {
  nowMs: number
  lastRenderMs: number
  minIntervalMs?: number
}): { shouldRender: boolean; nextLastRenderMs: number } {
  // 디버그 오버레이는 너무 자주 갱신하면 오히려 화면/성능 확인이 어렵다.
  const minIntervalMs = params.minIntervalMs ?? 250
  if (params.nowMs - params.lastRenderMs < minIntervalMs) {
    return { shouldRender: false, nextLastRenderMs: params.lastRenderMs }
  }
  return { shouldRender: true, nextLastRenderMs: params.nowMs }
}
