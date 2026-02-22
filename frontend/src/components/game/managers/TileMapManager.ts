import Phaser from 'phaser'
import { METERS_PER_TILE_M } from '../../../engine/race/trackConstants'

// 타일 기반 트랙 맵을 그리는 매니저
// 맵 길이(px) 계산과 "레이스 거리(m) <-> 타일 수" 기준도 같이 관리한다.
/**
 * TileMapManager 설정 정보
 * 타일 기반 맵 로직 (grass/track/deco 타일로 구성)
 */
export interface TileMapManagerConfig {
  scene: Phaser.Scene
  gameWidth: number
  gameHeight: number
  /** 출발 전 타일 수 (기본: 3) */
  preTiles?: number
  /**
   * 경주 구간 T 타일 개수 (기본: 30). S~E 사이의 T 개수.
   * 실제 달리는 거리 = [S]1 + [T]×raceTiles = (raceTiles+1) 타일.
   * 트랙 길이(m) = getTrackLengthM() = (raceTiles+1) × METERS_PER_TILE_M.
   */
  raceTiles?: number
  /** 도착 후 타일 수 (기본: 3) */
  postTiles?: number
  /** 배경 테마 1~4 랜덤, 고정하려면 지정 */
  bgTheme?: number
}

// 타일 한 칸의 픽셀 크기(px)
const TILE = 64
/** 줌인 시 타일 경계선(seam) 제거: 바닥 타일을 1px 키워 인접 타일과 겹치게 함 */
const TILE_SEAM_OVERLAP = 1
const CHUNK_COLS = 10
/** 잔디 행 수: 위 1줄 + 아래 2줄 (붙어있지 않아도 한 청크로 묶음) */
const GRASS_ROWS = 3
const GRASS_KEYS = [1, 2, 3, 4, 5, 6]
const DECO_KEYS = [1, 2, 3, 4, 5, 6]
/** 청크당 데코 등장 최소 개수 (전체 잔디 영역 기준) */
const DECO_MIN = 3
/** 청크당 데코 등장 최대 개수 (전체 잔디 영역 기준) */
const DECO_MAX = 6
const DEPTH = {
  BG1: 0.4,
  BG2: 0.5,
  BG3: 0.6,
  BG4: 0.7,
  BACK: 1,
  GRASS_DECO: 1.5,
  FENCE_BOTTOM: 20,
  HORSE: 2,
  FRONT: 3,
  FENCE_TOP: 1.8,
} as const

const ROWS = [
  'SKY',
  'SKY',
  'SKY',
  'GRASS',
  'TRACK',
  'TRACK',
  'TRACK',
  'TRACK',
  'GRASS',
  'GRASS',
] as const

const TRACK_CHUNK = ['track_top', 'track1', 'track2', 'track_bottom'] as const
const START_END_CHUNK = ['start_top', 'start1', 'start1', 'start_bottom'] as const

/**
 * 타일 기반 맵 매니저
 * - grass/track/deco 타일로 맵 구성
 * - 패럴랙스 sky 배경
 * - MapManager와 동일 인터페이스로 교체 가능
 *
 * 필수 텍스처 키:
 * - bg1_t1~bg4_t4 (background 1~4 테마)
 * - grass1~grass6, deco1~deco6
 * - track_top, track1, track2, track_bottom
 * - start_top, start1, start_bottom
 * - fence
 */
export default class TileMapManager {
  private scene: Phaser.Scene
  private mapWidth: number // px
  private mapHeight: number // px
  private rowHeight: number // px (맵 세로를 ROWS 수로 나눈 값)
  private startTileIndex: number // 타일 인덱스 (S 위치)
  private finishTileIndex: number // 타일 인덱스 (E 위치)
  private trackStartWorldXPx: number // px (S 타일 왼쪽 경계 X)
  private trackFinishWorldXPx: number // px (E 타일 왼쪽 경계 X)
  private trackLengthPx: number // px (S 왼쪽 ~ E 왼쪽 경계까지 길이)
  private scaleFactor = 1
  /** 경주 구간 T 타일 개수 (S~E 사이). 실제 달리는 거리 = (raceTiles+1)타일 = S 1 + T×raceTiles */
  private raceTiles: number

  constructor(config: TileMapManagerConfig) {
    this.scene = config.scene
    const preTiles = config.preTiles ?? 3
    this.raceTiles = config.raceTiles ?? 30
    const postTiles = config.postTiles ?? 3

    // 맵 높이 = 게임 영역 높이 (타일맵 + HUD = 캔버스 높이 720)
    this.mapHeight = config.gameHeight
    this.rowHeight = this.mapHeight / ROWS.length

    // 타일 시퀀스: T(일반 트랙), S(출발), E(결승)
    const seq = [
      ...Array(preTiles).fill('T'),
      'S',
      ...Array(this.raceTiles).fill('T'),
      'E',
      ...Array(postTiles).fill('T'),
    ]
    // 타일 인덱스: S = preTiles, E = preTiles+1+raceTiles (seq에서 E 위치)
    this.startTileIndex = preTiles
    this.finishTileIndex = preTiles + 1 + this.raceTiles

    this.mapWidth = seq.length * TILE

    // 월드 X는 타일 왼쪽 경계 기준으로 잡는다.
    // 실제 달리는 거리도 S 왼쪽 ~ E 왼쪽 기준이라서 (raceTiles+1)타일 길이가 된다.
    this.trackStartWorldXPx = this.startTileIndex * TILE
    this.trackFinishWorldXPx = this.finishTileIndex * TILE
    this.trackLengthPx = (this.finishTileIndex - this.startTileIndex) * TILE

    const grassChunk = this.createUnifiedGrassDecoChunk() // 위 1줄 + 아래 2줄 한 청크
    const bgTheme = config.bgTheme ?? 1 + Math.floor(Math.random() * 4)

    this.buildBackgroundLayers(bgTheme)
    this.buildRows(grassChunk, seq)
    this.buildFences()
    this.setupCameraBounds()
  }

  /**
   * 위쪽 1줄 + 아래 2줄 잔디를 한 청크로 묶어, 청크당 데코 DECO_MIN~DECO_MAX개만
   * 전체 잔디 타일(3×CHUNK_COLS) 중 랜덤 위치에 DECO_KEYS 중 하나 부여.
   */
  private createUnifiedGrassDecoChunk(): {
    grassChunk: number[][]
    decoChunk: number[]
  } {
    // 위/아래 잔디 줄을 한 청크로 묶어서 데코 개수를 같이 관리하면 패턴이 덜 반복적으로 보인다.
    const totalTiles = GRASS_ROWS * CHUNK_COLS
    const grassChunk: number[][] = []
    for (let row = 0; row < GRASS_ROWS; row++) {
      grassChunk.push([])
      for (let c = 0; c < CHUNK_COLS; c++) {
        grassChunk[row]!.push(GRASS_KEYS[Math.floor(Math.random() * GRASS_KEYS.length)]!)
      }
    }
    const count = Math.min(
      totalTiles,
      DECO_MIN + Math.floor(Math.random() * (DECO_MAX - DECO_MIN + 1)),
    )
    const indices = Array.from({ length: totalTiles }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
    }
    const decoChunk = new Array<number>(totalTiles).fill(0)
    for (let k = 0; k < count; k++) {
      decoChunk[indices[k]!] = DECO_KEYS[Math.floor(Math.random() * DECO_KEYS.length)]!
    }
    return { grassChunk, decoChunk }
  }

  /** 패럴랙스: 뒤 레이어일수록 scrollFactor 작게 → 카메라보다 느리게 움직임 */
  private static readonly SKY_SCROLL_FACTORS = [0.15, 0.3, 0.45, 0.6] as const

  private buildBackgroundLayers(bgTheme: number): void {
    // sky 배경은 tileSprite + scrollFactor로 패럴랙스만 주고, 실제 레이스 좌표에는 영향이 없다.
    const SKY_HEIGHT = 4 * this.rowHeight
    const layerKeys = [
      `bg${bgTheme}_t1`,
      `bg${bgTheme}_t2`,
      `bg${bgTheme}_t3`,
      `bg${bgTheme}_t4`,
    ] as const
    const depths = [DEPTH.BG1, DEPTH.BG2, DEPTH.BG3, DEPTH.BG4]
    layerKeys.forEach((key, i) => {
      this.scene.add
        .tileSprite(0, 0, this.mapWidth, SKY_HEIGHT, key)
        .setOrigin(0, 0)
        .setDepth(depths[i]!)
        .setScrollFactor(TileMapManager.SKY_SCROLL_FACTORS[i])
    })
  }

  // 행 단위로 배경/잔디/트랙 타일을 채운다. 위쪽 잔디 1줄, 아래쪽 잔디 2줄(한 청크로 묶음).
  private buildRows(
    grassChunk: { grassChunk: number[][]; decoChunk: number[] },
    seq: string[],
  ): void {
    // SKY/GRASS/TRACK 행 타입에 따라 그리는 타일이 달라진다.
    let grassRowIdx = 0
    let trackRowIdx = 0
    const decoBase = (row: number) => row * CHUNK_COLS

    ROWS.forEach((rowType, rowIndex) => {
      const y = rowIndex * this.rowHeight
      const rowH = this.rowHeight + TILE_SEAM_OVERLAP

      if (rowType === 'SKY') return

      if (rowType === 'GRASS') {
        const row = grassRowIdx
        const grassRow = grassChunk.grassChunk[row]
        const decoOffset = decoBase(row)
        if (grassRow) {
          for (let col = 0; col < this.mapWidth / TILE; col++) {
            const c = col % CHUNK_COLS
            const key = 'grass' + grassRow[c]
            this.scene.add
              .image(col * TILE, y, key)
              .setOrigin(0, 0)
              .setDisplaySize(TILE + TILE_SEAM_OVERLAP, rowH)
              .setDepth(DEPTH.BACK)
            const decoVal = grassChunk.decoChunk[decoOffset + c]
            if (decoVal > 0) {
              this.scene.add
                .image(col * TILE + TILE / 2, y + this.rowHeight / 2, 'deco' + decoVal)
                .setOrigin(0.5, 0.5)
                .setDepth(DEPTH.GRASS_DECO)
            }
          }
        }
        grassRowIdx++
        return
      }

      if (rowType === 'TRACK') {
        const trackKey = TRACK_CHUNK[trackRowIdx % 4]
        const startEndKey = START_END_CHUNK[trackRowIdx % 4]
        seq.forEach((code, i) => {
          const x = i * TILE
          const imgKey = code === 'S' || code === 'E' ? startEndKey : trackKey
          this.scene.add
            .image(x, y, imgKey)
            .setOrigin(0, 0)
            .setDisplaySize(TILE + TILE_SEAM_OVERLAP, rowH)
            .setDepth(DEPTH.BACK)
        })
        trackRowIdx++
      }
    })
  }

  private buildFences(): void {
    const FENCE_TOP_OFFSET_Y = 20
    const FENCE_BOTTOM_OFFSET_Y = 5
    const TOP_GRASS_Y = 3 * this.rowHeight
    const BOTTOM_TRACK_Y = 7 * this.rowHeight

    this.scene.add
      .tileSprite(0, TOP_GRASS_Y + FENCE_TOP_OFFSET_Y, this.mapWidth, this.rowHeight, 'fence')
      .setOrigin(0, 0)
      .setDepth(DEPTH.FENCE_TOP)

    this.scene.add
      .tileSprite(0, BOTTOM_TRACK_Y + FENCE_BOTTOM_OFFSET_Y, this.mapWidth, this.rowHeight, 'fence')
      .setOrigin(0, 0)
      .setDepth(DEPTH.FENCE_BOTTOM)
  }

  private setupCameraBounds(): void {
    this.scene.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight)
  }

  // ===== MapManager 호환 인터페이스 =====

  getScaleFactor(): number {
    return this.scaleFactor
  }

  getTrackStartWorldXPx(): number {
    return this.trackStartWorldXPx
  }

  /** 실제 경주 거리(px). S 왼쪽 ~ E 왼쪽 = [S]1 + [T]×raceTiles = (raceTiles+1)타일. getTrackLengthM()과 동일. */
  getTrackLengthPx(): number {
    return this.trackLengthPx
  }

  /**
   * 경주 구간 T 타일 개수 (S~E 사이). 실제 달리는 거리 = (raceTiles+1)타일.
   */
  getRaceTiles(): number {
    return this.raceTiles
  }

  /**
   * 경주 거리(미터). 단일 정의.
   * 실제 달리는 거리 = S 1타일 + T×raceTiles = (raceTiles+1) 타일 → (raceTiles+1) × METERS_PER_TILE_M.
   * Horse.prepareForRace(trackLengthM)에는 이 반환값을 그대로 전달할 것.
   */
  getTrackLengthM(): number {
    return (this.raceTiles + 1) * METERS_PER_TILE_M
  }

  /** 결승(E) 타일 왼쪽 경계 X. E 타일이 곧 결승. */
  getTrackFinishWorldXPx(): number {
    return this.trackFinishWorldXPx
  }

  /** 레거시/호환용. 오프셋 없음(0). 시뮬 완주는 position≥trackLengthM 사용 */
  getFinishLineOffsetM(): number {
    return 0
  }

  getStartTileIndex(): number {
    return this.startTileIndex
  }

  getFinishTileIndex(): number {
    return this.finishTileIndex
  }

  getTileSize(): number {
    return TILE
  }

  /** 트랙 중앙 Y (드라마틱 피니시 카메라 팬용) */
  getFinishStripeCenterY(): number {
    return 6 * this.rowHeight - this.rowHeight / 2
  }

  /** 카메라 스크롤 적용 (scrollLogical → camera scrollX) */
  setTilePositionX(scrollLogical: number): void {
    this.scene.cameras.main.scrollX = scrollLogical * this.scaleFactor
  }

  /** 타일 기반 맵에는 깃발 없음 (no-op) */
  updateStripePositions(cameraScrollPx: number): void {
    void cameraScrollPx
  }

  getMapWidth(): number {
    return this.mapWidth
  }

  getMapHeight(): number {
    return this.mapHeight
  }
}
