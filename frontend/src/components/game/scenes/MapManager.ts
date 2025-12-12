import Phaser from 'phaser'

export interface MapManagerConfig {
  scene: Phaser.Scene
  segmentCount: number
  gameWidth: number
  gameHeight: number
  mapTextureKey: string
  fenceTextureKey: string
  margin?: number // 맵 양 끝에서의 간격 (기본값: gameWidth * 0.1)
}

/**
 * 맵 관련 모든 로직을 관리하는 클래스
 * - 에셋을 반복하여 맵 구성
 * - 출발점, 도착점 배치
 * - 맵 길이 계산
 * - 출발점~도착점 500m로 맞춤
 */
export default class MapManager {
  private scene: Phaser.Scene
  private track!: Phaser.GameObjects.TileSprite
  private fenceBottom!: Phaser.GameObjects.TileSprite
  private startStripe!: Phaser.GameObjects.Image
  private finishStripe!: Phaser.GameObjects.Image

  private segmentCount: number
  private scaleFactor: number
  private totalMapWidth: number // 총 맵의 화면상 너비
  private startWorldX!: number // 출발점 월드 X 좌표
  private finishWorldX!: number // 도착점 월드 X 좌표
  private finishXOnScreen!: number // 출발점 ~ 도착점 사이의 화면상 거리 (시뮬레이션 500m에 해당)

  constructor(config: MapManagerConfig) {
    this.scene = config.scene
    this.segmentCount = config.segmentCount

    // 맵 텍스처 설정
    const texMap = this.scene.textures.get(config.mapTextureKey)
    texMap.setFilter(Phaser.Textures.FilterMode.NEAREST)

    const imgMap = texMap.getSourceImage() as HTMLImageElement
    const srcW = imgMap.width
    const srcH = imgMap.height

    this.scaleFactor = config.gameHeight / srcH
    const scale = this.scaleFactor

    // 총 맵 길이 계산
    // 5개 세그먼트를 연결한 총 맵 너비
    // 각 세그먼트의 너비 = srcW * scale
    // 총 맵 너비 = (srcW * scale) * segmentCount
    const logicalWidth = srcW * this.segmentCount
    this.totalMapWidth = logicalWidth * scale

    // 트랙 생성 (에셋 반복하여 맵 구성)
    this.track = this.scene.add
      .tileSprite(0, 0, logicalWidth, srcH, config.mapTextureKey)
      .setOrigin(0, 0)
      .setScale(scale, scale)

    this.scene.cameras.main.roundPixels = true

    // 펜스 생성
    const fenceTex = this.scene.textures.get(config.fenceTextureKey)
    fenceTex.setFilter(Phaser.Textures.FilterMode.NEAREST)

    const fenceImg = fenceTex.getSourceImage() as HTMLImageElement
    const fenceH = fenceImg.height

    const fenceLocalY = srcH - fenceH
    const fenceYBase = fenceLocalY * scale
    const fenceYOffset = -124
    const fenceY = fenceYBase + fenceYOffset

    this.fenceBottom = this.scene.add
      .tileSprite(0, fenceY, logicalWidth, fenceH, config.fenceTextureKey)
      .setOrigin(0, 0)
      .setScale(scale, scale)
      .setDepth(18)

    // 출발점, 도착점 배치
    this.createStartFinishStripes(config.gameHeight, config.margin)
  }

  private createStartFinishStripes(gameHeight: number, margin?: number) {
    // 체크 기둥 텍스처 생성
    const stripeWidth = 32
    const stripeHeight = gameHeight * 0.333

    const g = this.scene.make.graphics({ x: 0, y: 0 })
    const tileSize = 4
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

    const stripeY = gameHeight * 0.779

    // margin 계산
    const marginValue = margin ?? this.totalMapWidth * 0.1

    // 출발점: 맵 왼쪽 끝(0) + margin
    this.startWorldX = marginValue

    // 도착점: 맵 오른쪽 끝(totalMapWidth) - margin
    this.finishWorldX = this.totalMapWidth - marginValue

    // 출발점 ~ 도착점 사이의 화면상 거리 = 시뮬레이션 500m에 해당
    this.finishXOnScreen = this.finishWorldX - this.startWorldX

    // 스트라이프 배치
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

  getTotalMapWidth(): number {
    return this.totalMapWidth
  }

  getStartWorldX(): number {
    return this.startWorldX
  }

  getFinishWorldX(): number {
    return this.finishWorldX
  }

  getFinishXOnScreen(): number {
    return this.finishXOnScreen
  }

  updateScroll(raceDistance: number) {
    const logicalOffset = raceDistance / this.scaleFactor
    const offsetX = Math.round(logicalOffset)

    this.track.tilePositionX = offsetX
    if (this.fenceBottom) {
      this.fenceBottom.tilePositionX = offsetX
    }
  }

  updateStripePositions(raceDistance: number) {
    if (this.startStripe) {
      this.startStripe.x = this.startWorldX - raceDistance
    }
    if (this.finishStripe) {
      this.finishStripe.x = this.finishWorldX - raceDistance
    }
  }
}
