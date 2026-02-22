// =========================
// 트랙 길이/좌표/오프셋 관련 상수
// (맵 표시, 진행률 계산, 연출에서 사용)
// 밸런스 수치는 다른 constants 파일 참고
// =========================

/**
 * 트랙 길이 계산 기준
 * - raceTiles: S~E 사이에 들어가는 T 타일 개수
 * - 실제 달리는 거리: (raceTiles+1) 타일
 * - 트랙 길이(m): (raceTiles+1) * METERS_PER_TILE_M
 *
 * m / px 변환 개념은 docs/meters-vs-pixels.md 참고
 */
/** 기본 raceTiles 값 (별도 값 안 넣었을 때 사용) */
export const DEFAULT_RACE_TILES_COUNT = 100
/** 타일 1칸을 몇 m로 볼지 정하는 값 */
export const METERS_PER_TILE_M = 5
/**
 * 위치/연출에서 쓰는 오프셋 값 정리
 * | 이름                         | 단위 | 값(또는 공식)        | 용도                     | 정의 위치        |
 * |------------------------------|------|----------------------|--------------------------|------------------|
 * | getFinishLineOffsetM()       | m    | 0 (오프셋 없음)      | 레거시/호환용, 시뮬은 position≥trackLengthM | TileMapManager   |
 * | finishTriggerM               | m    | trackLengthM - 10    | 결승 연출 트리거(10m 전) | RaceScene.ts     |
 * | runPastM (계수)               | m/s  | 15                   | 완주 후 가상 진행 연출   | CameraScrollManager.ts |
 * | simSlowmoRestoreMs           | ms   | 300                  | 슬로우모 복구 트윈 길이  | RaceScene.ts     |
 */
