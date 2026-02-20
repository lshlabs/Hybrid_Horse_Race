// =========================
// 트랙·좌표·오프셋 상수 (맵/진행률/연출용)
// 밸런스 상수는 constants.ts 참고.
// =========================

/**
 * 트랙 설정
 * - raceTiles: S~E 사이 T 타일 개수. TileMapManager.getRaceTiles().
 * - 실제 달리는 거리 = [S]1 + [T]×raceTiles = (raceTiles+1) 타일.
 * - 트랙 길이(m): (raceTiles+1)×METERS_PER_TILE_M. TileMapManager.getTrackLengthM().
 *
 * m(미터) vs px(픽셀) 역할·변환: docs/meters-vs-pixels.md 참고.
 */
/** 기본 raceTiles (시뮬레이터 등 raceTiles 미지정 시 사용) */
export const DEFAULT_RACE_TILES_COUNT = 100
/** 타일당 미터. 트랙 길이(m) = (raceTiles+1) × METERS_PER_TILE_M (getTrackLengthM, S왼쪽~E왼쪽) */
export const METERS_PER_TILE_M = 5
/**
 * 오프셋/매직넘버 일람 (위치·연출 관련)
 * | 이름                         | 단위 | 값(또는 공식)        | 용도                     | 정의 위치        |
 * |------------------------------|------|----------------------|--------------------------|------------------|
 * | getFinishLineOffsetM()       | m    | 0 (오프셋 없음)      | 레거시/호환용, 시뮬은 position≥trackLengthM | TileMapManager   |
 * | finishTriggerM               | m    | trackLengthM - 10    | 결승 연출 트리거(10m 전) | RaceScene.ts     |
 * | runPastM (계수)               | m/s  | 15                   | 완주 후 가상 진행 연출   | CameraScrollManager.ts |
 * | simSlowmoRestoreMs           | ms   | 300                  | 슬로우모 복구 트윈 길이  | RaceScene.ts     |
 */
