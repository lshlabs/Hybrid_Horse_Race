// 레이스 시작 전 "게임을 시작하는 중..." 부트스트랩 단계에서 쓰는 helper
export type RaceStateBootstrapResponseData = {
  hasRaceState?: boolean
  elapsedMs?: number
  keyframe?: unknown
  nextKeyframe?: unknown
}

export function shouldMarkInitialAuthoritativeFrameReceived(
  data: RaceStateBootstrapResponseData,
): boolean {
  // prepared 상태라도 keyframe/elapsed 정보가 내려오기 시작하면
  // "첫 프레임 수신"으로 보고 bootstrap 진행에 사용한다.
  if (!data.hasRaceState) return false
  return !!(data.keyframe || data.nextKeyframe || typeof data.elapsedMs === 'number')
}

export function shouldReleaseRaceStartOverlay(params: {
  hasReceivedInitialAuthoritativeFrame: boolean
  nowMs: number
  minReadyAtMs: number
}): boolean {
  // 첫 프레임 수신 + 최소 연출시간 충족 둘 다 만족해야 overlay를 내린다.
  return params.hasReceivedInitialAuthoritativeFrame && params.nowMs >= params.minReadyAtMs
}

export function buildRaceStartBootstrapDebugPayload(params: {
  roomId?: string
  setIndex: number
  elapsedMs?: number
  hasKeyframe: boolean
  hasNextKeyframe: boolean
  reason: 'first-frame' | 'timeout' | 'already-ready'
  hasAnyPollResponse?: boolean
}): Record<string, unknown> {
  // DEV 로그에서 bootstrap 진행 이유를 빠르게 보려고 만드는 payload
  return {
    roomId: params.roomId,
    setIndex: params.setIndex,
    elapsedMs: params.elapsedMs,
    hasKeyframe: params.hasKeyframe,
    hasNextKeyframe: params.hasNextKeyframe,
    hasAnyPollResponse: params.hasAnyPollResponse,
    clientTime: Date.now(),
    reason: params.reason,
  }
}
