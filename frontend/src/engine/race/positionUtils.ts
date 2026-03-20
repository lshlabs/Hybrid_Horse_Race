/**
 * position(m) → progress(0~1 또는 초과) 변환 단일 모듈
 * - 말 코 = position 기준, 오프셋 없음
 */

export interface PositionToProgressOptions {
  /** true면 progress를 [0, 1]로 clamp (미완주 시각 표시 등) */
  capAtOne?: boolean
}

const DEFAULT_OPTIONS: Required<PositionToProgressOptions> = {
  capAtOne: true,
}
const MIN_PROGRESS = 0
const MAX_PROGRESS = 1

function clampProgress(progress: number): number {
  return Math.max(MIN_PROGRESS, Math.min(MAX_PROGRESS, progress))
}

/**
 * 시뮬레이션 position(미터)을 진행률 progress로 변환
 * @param position 말의 현재 위치 (m)
 * @param trackLengthM 트랙 길이 (m). TileMapManager.getTrackLengthM() 등
 * @param options capAtOne
 * @returns progress (0~1 또는 capAtOne: false 시 1 초과 가능)
 */
export function positionToProgress(
  position: number,
  trackLengthM: number,
  options?: PositionToProgressOptions,
): number {
  const capAtOne = options?.capAtOne ?? DEFAULT_OPTIONS.capAtOne
  let progress = trackLengthM > 0 ? position / trackLengthM : 0
  if (capAtOne) {
    progress = clampProgress(progress)
  }
  return progress
}
