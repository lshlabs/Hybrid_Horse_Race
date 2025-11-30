// RaceScene.ts
import Phaser from 'phaser'

// 배경 이미지
import mapImageUrl from '../../../assets/images/map/map2.png'

// 말 스프라이트 시트 (색만 다른 1, 2번)
import horse1Url from '../../../assets/images/horses/1.png'
import horse2Url from '../../../assets/images/horses/2.png'

// 아래 펜스만 따로 잘라낸 288x8 이미지
import fenceUrl from '../../../assets/images/map/fence.png'

export default class RaceScene extends Phaser.Scene {
  private track!: Phaser.GameObjects.TileSprite
  private horse1!: Phaser.GameObjects.Sprite
  private horse2!: Phaser.GameObjects.Sprite
  private fenceBottom!: Phaser.GameObjects.TileSprite

  // 종점/시점 체크 기둥 (월드 좌표에 붙어서 같이 스크롤)
  private finishStripe!: Phaser.GameObjects.Image
  private finishWorldX = 0 // 월드 좌표 기준 피니시 위치(x)

  private startStripe!: Phaser.GameObjects.Image
  private startWorldX = 0 // 월드 좌표 기준 스타트 위치(x)

  // 트랙 관련
  private readonly segmentCount = 5 // "5 조각 길이"만큼 진행
  private readonly trackSpeed = 240 // 화면상 스크롤 속도 (px/s)
  private tileOffsetX = 0 // TileSprite 오프셋 (논리 좌표 기준)
  private raceDistance = 0 // 실제 화면 픽셀 기준 누적 이동 거리
  private maxDistance = 0 // raceDistance 가 여기 도달하면 레이스 종료
  private scaleFactor = 1 // 배경 스케일 (X,Y 동일)
  private finished = false

  // 레이스 상태
  private raceStarted = false
  private endSequenceStarted = false

  // UI / 트윈
  private startButton?: Phaser.GameObjects.Text
  private horse1Tween?: Phaser.Tweens.Tween
  private horse2Tween?: Phaser.Tweens.Tween

  // 게임 영역 / HUD 높이
  private readonly HUD_HEIGHT = 160
  private gameAreaHeight = 0

  constructor() {
    super('RaceScene')
  }

  preload() {
    // 배경
    this.load.image('map2', mapImageUrl)

    // 말 스프라이트 시트: 64x64 그리드
    this.load.spritesheet('horse1', horse1Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

    this.load.spritesheet('horse2', horse2Url, {
      frameWidth: 64,
      frameHeight: 64,
    })

    // 아래 펜스 이미지(288x8)
    this.load.image('fenceBottom', fenceUrl)
  }

  create() {
    const gameWidth = this.scale.width
    const fullHeight = this.scale.height

    // 아래 HUD 영역만큼 게임 영역 높이 줄이기
    this.gameAreaHeight = fullHeight - this.HUD_HEIGHT
    const gameHeight = this.gameAreaHeight

    // ===== 배경 세팅 =====
    const texMap = this.textures.get('map2')
    texMap.setFilter(Phaser.Textures.FilterMode.NEAREST)

    const imgMap = texMap.getSourceImage() as HTMLImageElement
    const srcW = imgMap.width // 예: 288
    const srcH = imgMap.height // 예: 144

    // 세로 높이에 딱 맞게, 비율 유지하면서 확대 (게임 영역 기준)
    this.scaleFactor = gameHeight / srcH
    const scale = this.scaleFactor

    // TileSprite 의 "논리 크기" (원본 좌표 기준)
    const logicalWidth = srcW * this.segmentCount
    const logicalHeight = srcH

    this.track = this.add
      .tileSprite(0, 0, logicalWidth, logicalHeight, 'map2')
      .setOrigin(0, 0)
      .setScale(scale, scale)

    this.cameras.main.roundPixels = true

    // "5 조각 길이"만큼 달리면 끝 (스크린 픽 기준)
    this.maxDistance = srcW * this.segmentCount * scale

    // ===== 아래 펜스 세팅 (map2의 원래 위치에 거의 맞게 겹치기) =====
    const fenceTex = this.textures.get('fenceBottom')
    fenceTex.setFilter(Phaser.Textures.FilterMode.NEAREST)

    const fenceImg = fenceTex.getSourceImage() as HTMLImageElement
    const fenceH = fenceImg.height // 8px

    const fenceLocalY = srcH - fenceH
    const fenceYBase = fenceLocalY * scale

    const fenceYOffset = -124 // 필요하면 조정
    const fenceY = fenceYBase + fenceYOffset

    this.fenceBottom = this.add
      .tileSprite(0, fenceY, logicalWidth, fenceH, 'fenceBottom')
      .setOrigin(0, 0)
      .setScale(scale, scale)
      .setDepth(15) // 제일 위 레이어

    // ===== 체크 기둥 텍스처 (시작/종점 공용) =====
    const stripeWidth = 32
    const stripeHeight = gameHeight * 0.335

    const g = this.make.graphics({ x: 0, y: 0 })
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

    // 한 타일의 "월드 폭" (스케일까지 포함)
    const segmentWorldWidth = srcW * scale

    // ===== 시작선 (startStripe) =====
    const startOffsetFromLeft = gameWidth * 0.3
    const startXOnScreen = startOffsetFromLeft
    const startShowDistance = 0

    this.startWorldX = startShowDistance + startXOnScreen

    const stripeY = gameHeight * 0.78 // 말 위치 비슷하게

    this.startStripe = this.add
      .image(this.startWorldX, stripeY, 'finishStripe')
      .setOrigin(0.5, 1)
      .setDepth(5) // map(0)보다 앞, 말(10/11)·펜스(15)보다 뒤

    // ===== 종점선 (finishStripe, 월드 뒤쪽) =====
    const lastSegmentIndex = this.segmentCount
    const startVisibleDistance = lastSegmentIndex * segmentWorldWidth

    const appearOffsetFromRight = gameWidth * 0.3
    const appearXOnScreen = gameWidth - appearOffsetFromRight

    this.finishWorldX = startVisibleDistance + appearXOnScreen

    this.finishStripe = this.add
      .image(this.finishWorldX, stripeY, 'finishStripe')
      .setOrigin(0.5, 1)
      .setDepth(5)

    // ===== 말 애니메이션 세팅 =====
    const texHorse1 = this.textures.get('horse1')
    texHorse1.setFilter(Phaser.Textures.FilterMode.NEAREST)
    const texHorse2 = this.textures.get('horse2')
    texHorse2.setFilter(Phaser.Textures.FilterMode.NEAREST)

    // 달리기 애니메이션 프레임
    const RUN_FRAMES = [72, 73, 74, 75, 76, 77]

    // 꼬리 흔들기(대기 모션) 프레임 – 실제 시트에 맞게 조정해둔 값
    const REAR_START = 0
    const REAR_END = 2

    // run 애니메이션
    this.anims.create({
      key: 'horse1_run_right',
      frames: RUN_FRAMES.map((frameIndex) => ({
        key: 'horse1',
        frame: frameIndex,
      })),
      frameRate: 12,
      repeat: -1,
    })

    this.anims.create({
      key: 'horse2_run_right',
      frames: RUN_FRAMES.map((frameIndex) => ({
        key: 'horse2',
        frame: frameIndex,
      })),
      frameRate: 12,
      repeat: -1,
    })

    // 대기 모션 애니메이션
    this.anims.create({
      key: 'horse1_rear',
      frames: this.anims.generateFrameNumbers('horse1', {
        start: REAR_START,
        end: REAR_END,
      }),
      frameRate: 3,
      repeat: -1,
      yoyo: true,
    })

    this.anims.create({
      key: 'horse2_rear',
      frames: this.anims.generateFrameNumbers('horse2', {
        start: REAR_START,
        end: REAR_END,
      }),
      frameRate: 3,
      repeat: -1,
      yoyo: true,
    })

    // ===== 말 스프라이트 배치 (시작선 근처에 "대기") =====
    const horseScale = 2

    const horseY1 = gameHeight * 0.7
    const horseY2 = gameHeight * 0.75

    const horse1X = startXOnScreen - 40
    const horse2X = startXOnScreen - 40

    this.horse1 = this.add
      .sprite(horse1X, horseY1, 'horse1', REAR_START)
      .setOrigin(0.5, 1)
      .setScale(horseScale)
      .setFlipX(true)
      .setDepth(10)

    this.horse2 = this.add
      .sprite(horse2X, horseY2, 'horse2', REAR_START)
      .setOrigin(0.5, 1)
      .setScale(horseScale)
      .setFlipX(true)
      .setDepth(11)

    // 처음에는 대기 모션
    this.horse1.play('horse1_rear')
    this.horse2.play('horse2_rear')

    // ===== 말 좌우 트윈 (처음엔 멈춰있고, START 누르면 시작) =====
    this.horse1Tween = this.tweens.add({
      targets: this.horse1,
      x: horse1X + 100,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Linear',
      paused: true,
    })

    this.horse2Tween = this.tweens.add({
      targets: this.horse2,
      x: horse2X + 70,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Linear',
      paused: true,
    })

    // ===== START 버튼 =====
    this.startButton = this.add
      .text(gameWidth / 2, gameHeight * 0.15, 'START', {
        fontFamily: 'sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: '#000000',
      })
      .setOrigin(0.5)
      .setPadding(16, 8, 16, 8)
      .setDepth(20)
      .setInteractive({ useHandCursor: true })

    this.startButton.on('pointerdown', () => this.handleStart())

    // ===== HUD & 순위표 UI =====
    this.createHUD()
    this.createRankingPanel()
  }

  // --- HUD(하단) 생성 ---
  private createHUD() {
    const width = this.scale.width
    const HUD_H = this.HUD_HEIGHT
    const topY = this.gameAreaHeight
    const baseY = topY + HUD_H / 2
    const MARGIN = 24

    // 전체 HUD 배경
    this.add
      .rectangle(width / 2, baseY, width, HUD_H, 0x05051a)
      .setOrigin(0.5)
      .setDepth(30)

    // 증강 카드 3개
    const CARD_W = 220
    const CARD_H = HUD_H - 40

    const cardStyleCommon = {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#000000',
      align: 'center' as const,
    }

    // 카드 1 – 선택된 증강
    const card1X = MARGIN + CARD_W / 2
    const card1Bg = this.add
      .rectangle(card1X, baseY, CARD_W, CARD_H, 0xfff27a)
      .setOrigin(0.5)
      .setDepth(31)

    this.add
      .text(card1Bg.x, card1Bg.y, '최고속도 증가\n+18%', {
        ...cardStyleCommon,
      })
      .setOrigin(0.5)
      .setDepth(32)

    // 카드 2, 3 – 선택 전
    const card2X = card1X + CARD_W + MARGIN
    const card3X = card2X + CARD_W + MARGIN

    ;[card2X, card3X].forEach((x, idx) => {
      const bg = this.add.rectangle(x, baseY, CARD_W, CARD_H, 0x0055cc).setOrigin(0.5).setDepth(31)

      this.add
        .text(bg.x, bg.y, `증강 ${idx + 2}\n(선택 전)`, {
          fontFamily: 'sans-serif',
          fontSize: '18px',
          color: '#ffffff',
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(32)
    })

    // 능력치 박스 (오른쪽 넓은 영역)
    const statsW = width - (CARD_W * 3 + MARGIN * 4)
    const statsX = CARD_W * 3 + MARGIN * 3 + statsW / 2

    const statsBg = this.add
      .rectangle(statsX, baseY, statsW, CARD_H, 0x004488)
      .setOrigin(0.5)
      .setDepth(31)

    const statsText = [
      '속도 : 39 / 55 km/h',
      '컨디션 : 62 / 100',
      '체력 : 77 / 100',
      '습성 : 도주마',
    ].join('\n')

    this.add
      .text(statsBg.x - statsW / 2 + 24, statsBg.y - CARD_H / 2 + 20, statsText, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        align: 'left',
      })
      .setDepth(32)
  }

  // --- 우측 순위표 패널 (반투명) ---
  private createRankingPanel() {
    const width = this.scale.width
    const gameHeight = this.gameAreaHeight

    const PANEL_W = 220
    const MARGIN = 16
    const panelX = width - PANEL_W / 2 - MARGIN
    const panelH = gameHeight - MARGIN * 2
    const panelY = gameHeight / 2

    // 반투명 배경
    const bg = this.add
      .rectangle(panelX, panelY, PANEL_W, panelH, 0xffffff)
      .setOrigin(0.5)
      .setDepth(40)

    // fillAlpha 로 반투명 효과
    bg.setFillStyle(0xffffff, 0.85)
    bg.setStrokeStyle(2, 0x000000, 1)

    // 제목
    const titleY = panelY - panelH / 2 + 24
    this.add
      .text(panelX, titleY, '순위표', {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#000000',
      })
      .setOrigin(0.5)
      .setDepth(41)

    // 순위 리스트 (더미)
    const startY = titleY + 32
    const lineGap = 26

    for (let i = 0; i < 8; i++) {
      this.add
        .text(panelX - PANEL_W / 2 + 20, startY + i * lineGap, `${i + 1} 닉네임`, {
          fontFamily: 'sans-serif',
          fontSize: '18px',
          color: '#000000',
        })
        .setDepth(41)
    }
  }

  private handleStart() {
    if (this.raceStarted) return

    this.raceStarted = true
    this.startButton?.setVisible(false)

    // 대기 모션 → run 애니메이션으로 전환
    this.horse1.play('horse1_run_right')
    this.horse2.play('horse2_run_right')

    // 좌우 진동 시작 (속도 표현)
    this.horse1Tween?.play()
    this.horse2Tween?.play()
  }

  update(_time: number, delta: number) {
    if (!this.track) return

    const gameWidth = this.scale.width
    let offsetX = Math.round(this.tileOffsetX)

    if (this.raceStarted && !this.finished) {
      const dt = delta / 1000

      // 실제 화면에서 달린 거리 증가
      this.raceDistance += this.trackSpeed * dt

      if (this.raceDistance >= this.maxDistance) {
        this.raceDistance = this.maxDistance
        this.finished = true
      }

      const logicalOffset = this.raceDistance / this.scaleFactor
      this.tileOffsetX = logicalOffset
      offsetX = Math.round(this.tileOffsetX)

      // 트랙 / 펜스 스크롤
      this.track.tilePositionX = offsetX

      if (this.fenceBottom) {
        this.fenceBottom.tilePositionX = offsetX
      }
    }

    // 시작/종점 체크 기둥도 월드 좌표 - 달린 거리만큼 이동
    if (this.startStripe) {
      this.startStripe.x = this.startWorldX - this.raceDistance
    }

    if (this.finishStripe) {
      this.finishStripe.x = this.finishWorldX - this.raceDistance
    }

    // 레이스 끝난 뒤: 좌우 움직임 멈추고, 오른쪽 화면 밖으로 빠져나가게
    if (this.finished && !this.endSequenceStarted) {
      this.endSequenceStarted = true

      this.horse1Tween?.stop()
      this.horse2Tween?.stop()

      const offscreenX = gameWidth + 200

      this.tweens.add({
        targets: this.horse1,
        x: offscreenX,
        duration: 1500,
        ease: 'Linear',
      })

      this.tweens.add({
        targets: this.horse2,
        x: offscreenX + 50,
        duration: 1600,
        ease: 'Linear',
      })
    }
  }
}
