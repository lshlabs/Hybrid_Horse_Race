import Phaser from 'phaser'

/**
 * MapManager 설정 정보
 */
export interface MapManagerConfig {
  scene: Phaser.Scene
  segmentCount: number
  gameWidth: number
  gameHeight: number
  mapTextureKey: string
  fenceTextureKey: string
  /** 출발점의 여백 (기본값: totalMapWidth * 0.1) */
  startMargin?: number
  /** 도착점의 여백 (기본값: totalMapWidth * 0.1) */
  finishMargin?: number
  /** 출발점에서 도착점까지의 거리 (픽셀 단위, 설정하면 finishMargin 무시) */
  raceDistance?: number
  /** @deprecated margin 대신 startMargin과 finishMargin을 사용하세요 */
  margin?: number
}

/**
 * 맵 관련 로직을 관리하는 클래스
 * - 맵 이미지를 반복하여 트랙 생성
 * - 출발점과 도착점에 깃발 배치
 * - 맵 크기 및 위치 계산
 */
export default class MapManager {
  // 상수 정의
  private static readonly STRIPE_HEIGHT_RATIO = 0.333 // 깃발 높이 비율 (화면 높이의 33.3%)
  private static readonly STRIPE_Y_RATIO = 0.779 // 깃발 Y 위치 비율 (화면 높이의 77.9%)
  private static readonly DEFAULT_MARGIN_RATIO = 0.1 // 기본 margin 비율 (맵 너비의 10%)
  private static readonly FENCE_Y_OFFSET = -124 // 펜스 Y 오프셋 (픽셀)
  private static readonly CHECKER_TILE_SIZE = 4 // 체크무늬 타일 크기 (픽셀)

  private scene: Phaser.Scene
  private track!: Phaser.GameObjects.TileSprite
  private fenceBottom!: Phaser.GameObjects.TileSprite
  private startStripe!: Phaser.GameObjects.Image
  private finishStripe!: Phaser.GameObjects.Image
  private segmentCount: number
  private scaleFactor: number
  private totalMapWidth: number
  private startWorldX!: number
  private finishWorldX!: number
  private finishXOnScreen!: number
  private finishStripeOffset: number = 0

  constructor(config: MapManagerConfig) {
    this.scene = config.scene
    this.segmentCount = config.segmentCount

    // 맵 이미지 준비
    const texMap = this.scene.textures.get(config.mapTextureKey)
    texMap.setFilter(Phaser.Textures.FilterMode.NEAREST)

    const imgMap = texMap.getSourceImage() as HTMLImageElement
    const srcW = imgMap.width
    const srcH = imgMap.height

    // 이미지 크기 조절 비율 계산
    this.scaleFactor = config.gameHeight / srcH

    // 트랙 생성
    const logicalWidth = srcW * this.segmentCount
    this.track = this.scene.add
      .tileSprite(0, 0, logicalWidth, srcH, config.mapTextureKey)
      .setOrigin(0, 0)
      .setScale(this.scaleFactor, this.scaleFactor)

    this.totalMapWidth = this.track.displayWidth
    this.scene.cameras.main.roundPixels = true

    // 펜스 생성
    const fenceTex = this.scene.textures.get(config.fenceTextureKey)
    fenceTex.setFilter(Phaser.Textures.FilterMode.NEAREST)

    const fenceImg = fenceTex.getSourceImage() as HTMLImageElement
    const fenceH = fenceImg.height
    const fenceLocalY = srcH - fenceH
    const fenceY = fenceLocalY * this.scaleFactor + MapManager.FENCE_Y_OFFSET

    this.fenceBottom = this.scene.add
      .tileSprite(0, fenceY, logicalWidth, fenceH, config.fenceTextureKey)
      .setOrigin(0, 0)
      .setScale(this.scaleFactor, this.scaleFactor)
      .setDepth(18)

    // 출발점과 도착점 깃발 배치
    const startMargin = config.startMargin !== undefined ? config.startMargin : config.margin
    const finishMargin = config.finishMargin !== undefined ? config.finishMargin : config.margin
    this.createStartFinishStripes(config.gameHeight, startMargin, finishMargin, config.raceDistance)
  }

  /**
   * 출발선과 도착선에 줄무늬 깃발 생성 및 배치
   */
  private createStartFinishStripes(
    gameHeight: number,
    startMargin?: number,
    finishMargin?: number,
    raceDistance?: number,
  ) {
    // 체크무늬 깃발 이미지 생성
    const stripeWidth = 32
    const stripeHeight = gameHeight * MapManager.STRIPE_HEIGHT_RATIO
    const g = this.scene.make.graphics({ x: 0, y: 0 })
    const tileSize = MapManager.CHECKER_TILE_SIZE
    const white = 0xffffff
    const black = 0x000000

    for (let y = 0; y < stripeHeight; y += tileSize) {
      for (let x = 0; x < stripeWidth; x += tileSize) {
        const isWhite = (x / tileSize + y / tileSize) % 2 === 0
        g.fillStyle(isWhite ? white : black, 1)
        g.fillRect(x, y, tileSize, tileSize)
      }
    }

    g.generateTexture('finishStripe', stripeWidth, stripeHeight)
    g.destroy()

    // 깃발 위치 계산 및 배치
    const stripeY = gameHeight * MapManager.STRIPE_Y_RATIO
    const defaultMargin = this.totalMapWidth * MapManager.DEFAULT_MARGIN_RATIO
    const startMarginValue = startMargin !== undefined ? startMargin : defaultMargin

    this.startWorldX = startMarginValue

    if (raceDistance !== undefined) {
      this.finishXOnScreen = raceDistance
    } else {
      const finishMarginValue = finishMargin !== undefined ? finishMargin : defaultMargin
      this.finishXOnScreen = this.totalMapWidth - startMarginValue - finishMarginValue
    }

    this.finishWorldX = this.startWorldX + this.finishXOnScreen

    // 깃발 배치
    this.startStripe = this.scene.add
      .image(this.startWorldX, stripeY, 'finishStripe')
      .setOrigin(0.5, 1)
      .setDepth(5)

    this.finishStripe = this.scene.add
      .image(this.finishWorldX, stripeY, 'finishStripe')
      .setOrigin(0.5, 1)
      .setDepth(5)
  }

  getScaleFactor(): number {
    return this.scaleFactor
  }

  getStartWorldX(): number {
    return this.startWorldX
  }

  getFinishXOnScreen(): number {
    return this.finishXOnScreen
  }

  // 사용되지 않는 메서드들 (향후 사용 가능성을 위해 유지)
  // getTotalMapWidth(): number { return this.totalMapWidth }
  // getFinishWorldX(): number { return this.finishWorldX }
  // setFinishStripeOffset(offset: number) { this.finishStripeOffset = offset }

  setTilePositionX(tilePositionX: number) {
    this.track.tilePositionX = tilePositionX
    if (this.fenceBottom) {
      this.fenceBottom.tilePositionX = tilePositionX
    }
  }

  /**
   * 깃발 위치 업데이트 (스크롤에 따라 이동)
   */
  updateStripePositions(raceDistance: number) {
    if (this.startStripe) {
      this.startStripe.x = this.startWorldX - raceDistance
    }

    if (this.finishStripe) {
      this.finishStripe.x = this.finishWorldX - raceDistance + this.finishStripeOffset
    }
  }
}
