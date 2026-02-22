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

export function computeAuthoritativeRenderElapsedMs(
  params: ComputeAuthoritativeRenderElapsedMsParams,
): ComputeAuthoritativeRenderElapsedMsResult {
  // 서버가 내려준 시각(authoritativeNowMs)이 있으면 우선 사용하고,
  // 없으면 startedAt + elapsed 조합으로 대체한다.
  const authorityNowMs =
    params.authoritativeNowMs > 0
      ? params.authoritativeNowMs
      : params.startedAtMs + params.authoritativeElapsedMs

  let targetElapsedMs = Math.max(0, authorityNowMs - params.startedAtMs - params.renderDelayMs)
  if (params.lastAuthoritativePollClientTimeMs > 0) {
    const sincePollMs = Math.max(0, params.clientNowMs - params.lastAuthoritativePollClientTimeMs)
    targetElapsedMs += sincePollMs
  }

  let nextSmoothedElapsedMs: number
  let timeHardSnapCountDelta = 0
  if (params.smoothedElapsedMs === null) {
    nextSmoothedElapsedMs = targetElapsedMs
  } else {
    const deltaToTarget = targetElapsedMs - params.smoothedElapsedMs
    if (Math.abs(deltaToTarget) >= params.timeHardSnapMs) {
      nextSmoothedElapsedMs = targetElapsedMs
      timeHardSnapCountDelta = 1
    } else {
      nextSmoothedElapsedMs =
        params.smoothedElapsedMs + deltaToTarget * params.timeSoftCorrectionAlpha
    }
  }

  // targetElapsedMs에 이미 "서버 기준 시간 + 폴링 이후 경과시간"이 반영되어 있어서
  // 여기서 frame delta를 또 더하면 시간이 빨라지는 문제가 생긴다.
  // 그래서 보정된 target 값을 그대로 따라가도록 유지한다.
  const rawRenderElapsedMs = Math.max(0, nextSmoothedElapsedMs)
  const renderElapsedMs = Math.max(params.lastRenderedElapsedMs, rawRenderElapsedMs)

  return {
    renderElapsedMs,
    simElapsedSec: renderElapsedMs / 1000,
    smoothedElapsedMs: nextSmoothedElapsedMs,
    lastRenderedElapsedMs: renderElapsedMs,
    timeHardSnapCountDelta,
  }
}
