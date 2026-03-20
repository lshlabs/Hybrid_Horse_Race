export type AuthoritativeDriftCorrectionConfig = {
  gain: number
  min: number
  max: number
}

// authoritative 재생 중 시간축 보정 통계(디버그용)
export type AuthoritativeTimingMetrics = {
  timeHardSnapCount: number
}

export type ComputeAuthoritativeRenderElapsedMsParams = {
  deltaMs: number
  clientNowMs: number
  startedAtMs: number
  authoritativeNowMs: number
  authoritativeElapsedMs: number
  lastAuthoritativePollClientTimeMs: number
  smoothedElapsedMs: number | null
  lastRenderedElapsedMs: number
  simPlaybackScale: number
  simSlowmoActive: boolean
  renderDelayMs: number
  timeHardSnapMs: number
  timeSoftCorrectionAlpha: number
  driftCorrectionNormal: AuthoritativeDriftCorrectionConfig
  driftCorrectionSlowmo: AuthoritativeDriftCorrectionConfig
}

export type ComputeAuthoritativeRenderElapsedMsResult = {
  renderElapsedMs: number
  simElapsedSec: number
  smoothedElapsedMs: number
  lastRenderedElapsedMs: number
  timeHardSnapCountDelta: number
}

const MILLISECONDS_PER_SECOND = 1000

function clampNonNegative(value: number): number {
  return Math.max(0, value)
}

function resolveAuthorityNowMs(params: {
  authoritativeNowMs: number
  startedAtMs: number
  authoritativeElapsedMs: number
}): number {
  return params.authoritativeNowMs > 0
    ? params.authoritativeNowMs
    : params.startedAtMs + params.authoritativeElapsedMs
}

function computeTargetElapsedMs(params: {
  authorityNowMs: number
  startedAtMs: number
  renderDelayMs: number
  clientNowMs: number
  lastAuthoritativePollClientTimeMs: number
}): number {
  let targetElapsedMs = clampNonNegative(
    params.authorityNowMs - params.startedAtMs - params.renderDelayMs,
  )
  if (params.lastAuthoritativePollClientTimeMs <= 0) {
    return targetElapsedMs
  }
  const sincePollMs = clampNonNegative(
    params.clientNowMs - params.lastAuthoritativePollClientTimeMs,
  )
  targetElapsedMs += sincePollMs
  return targetElapsedMs
}

function computeSmoothedElapsedMs(params: {
  targetElapsedMs: number
  smoothedElapsedMs: number | null
  timeHardSnapMs: number
  timeSoftCorrectionAlpha: number
}): { smoothedElapsedMs: number; timeHardSnapCountDelta: number } {
  if (params.smoothedElapsedMs === null) {
    return {
      smoothedElapsedMs: params.targetElapsedMs,
      timeHardSnapCountDelta: 0,
    }
  }

  const deltaToTarget = params.targetElapsedMs - params.smoothedElapsedMs
  if (Math.abs(deltaToTarget) >= params.timeHardSnapMs) {
    return {
      smoothedElapsedMs: params.targetElapsedMs,
      timeHardSnapCountDelta: 1,
    }
  }

  return {
    smoothedElapsedMs: params.smoothedElapsedMs + deltaToTarget * params.timeSoftCorrectionAlpha,
    timeHardSnapCountDelta: 0,
  }
}

export function computeAuthoritativeRenderElapsedMs(
  params: ComputeAuthoritativeRenderElapsedMsParams,
): ComputeAuthoritativeRenderElapsedMsResult {
  const authorityNowMs = resolveAuthorityNowMs(params)
  const targetElapsedMs = computeTargetElapsedMs({
    authorityNowMs,
    startedAtMs: params.startedAtMs,
    renderDelayMs: params.renderDelayMs,
    clientNowMs: params.clientNowMs,
    lastAuthoritativePollClientTimeMs: params.lastAuthoritativePollClientTimeMs,
  })

  const smoothingResult = computeSmoothedElapsedMs({
    targetElapsedMs,
    smoothedElapsedMs: params.smoothedElapsedMs,
    timeHardSnapMs: params.timeHardSnapMs,
    timeSoftCorrectionAlpha: params.timeSoftCorrectionAlpha,
  })
  const nextSmoothedElapsedMs = smoothingResult.smoothedElapsedMs
  const timeHardSnapCountDelta = smoothingResult.timeHardSnapCountDelta

  const rawRenderElapsedMs = clampNonNegative(nextSmoothedElapsedMs)
  const renderElapsedMs = Math.max(params.lastRenderedElapsedMs, rawRenderElapsedMs)

  return {
    renderElapsedMs,
    simElapsedSec: renderElapsedMs / MILLISECONDS_PER_SECOND,
    smoothedElapsedMs: nextSmoothedElapsedMs,
    lastRenderedElapsedMs: renderElapsedMs,
    timeHardSnapCountDelta,
  }
}
