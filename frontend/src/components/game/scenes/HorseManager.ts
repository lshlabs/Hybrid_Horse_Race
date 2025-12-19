import Phaser from 'phaser'
import { Horse, generateRandomStats } from '../../../lib/race-sim'

/**
 * 말 한 마리를 관리하는 클래스
 */
class HorseRunner {
  private scene: Phaser.Scene
  private sprite: Phaser.GameObjects.Sprite
  private tween?: Phaser.Tweens.Tween
  private config: {
    textureKey: string
    idleAnimKey: string
    runAnimKey: string
    startX: number
    endX: number
    y: number
    scale: number
    depth: number
    tweenDuration: number
  }

  constructor(
    scene: Phaser.Scene,
    config: {
      textureKey: string
      idleAnimKey: string
      runAnimKey: string
      startX: number
      endX: number
      y: number
      scale: number
      depth: number
      tweenDuration: number
    },
    idleFrameIndex: number,
  ) {
    this.scene = scene
    this.config = config

    // 스프라이트 생성
    this.sprite = this.scene.add
      .sprite(this.config.startX, this.config.y, this.config.textureKey, idleFrameIndex)
      .setOrigin(0.5, 1)
      .setScale(this.config.scale)
      .setFlipX(true)
      .setDepth(this.config.depth)

    // idle 애니메이션 재생
    this.sprite.play(this.config.idleAnimKey)

    // 좌우 트윈 (처음엔 멈춘 상태)
    this.tween = this.scene.tweens.add({
      targets: this.sprite,
      x: this.config.endX,
      duration: this.config.tweenDuration,
      yoyo: true,
      repeat: -1,
      ease: 'Linear',
      paused: true,
    })
  }

  startRun() {
    this.sprite.play(this.config.runAnimKey)
    this.tween?.play()
  }

  updatePosition(x: number) {
    this.tween?.stop()
    this.sprite.x = x
    if (
      !this.sprite.anims.isPlaying ||
      this.sprite.anims.currentAnim?.key === this.config.idleAnimKey
    ) {
      this.sprite.play(this.config.runAnimKey)
    }
  }
}

export interface HorseManagerConfig {
  scene: Phaser.Scene
  gameHeight: number
  startXOnScreen: number
  playerHorseIndex?: number
  arrowTextureKey: string
}

/**
 * 말 관련 모든 로직을 관리하는 클래스
 * - 에셋 사용한 말 8마리 구현
 * - 내 말 표시 화살표 구현
 * - 말의 능력치 구현
 * - 말의 움직임 구현
 */
export default class HorseManager {
  private scene: Phaser.Scene
  private horses: HorseRunner[] = []
  private simHorses: Horse[] = []
  private playerIndicator?: Phaser.GameObjects.Image
  private playerIndicatorTween?: Phaser.Tweens.Tween
  private readonly REAR_START = 0
  private readonly REAR_END = 2

  constructor(config: HorseManagerConfig) {
    this.scene = config.scene

    // 말 애니메이션 생성
    this.createHorseAnimations()

    // 말 8마리 생성
    this.createHorses(config.gameHeight, config.startXOnScreen)

    // 시뮬레이션 말들 초기화
    this.initializeSimHorses()

    // 플레이어 표시 화살표 생성
    if (config.playerHorseIndex !== undefined) {
      this.createPlayerIndicator(
        config.playerHorseIndex,
        config.startXOnScreen,
        config.arrowTextureKey,
      )
    }
  }

  private createHorseAnimations() {
    const RUN_FRAMES = [72, 73, 74, 75, 76, 77]
    const HORSE_COUNT = 8

    // 텍스처 필터 설정 및 애니메이션 생성
    for (let i = 1; i <= HORSE_COUNT; i++) {
      const tex = this.scene.textures.get(`horse${i}`)
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST)

      // 달리기 애니메이션 생성
      this.scene.anims.create({
        key: `horse${i}_run_right`,
        frames: RUN_FRAMES.map((frameIndex) => ({
          key: `horse${i}`,
          frame: frameIndex,
        })),
        frameRate: 12,
        repeat: -1,
      })

      // 대기 애니메이션 생성
      this.scene.anims.create({
        key: `horse${i}_waiting`,
        frames: this.scene.anims.generateFrameNumbers(`horse${i}`, {
          start: this.REAR_START,
          end: this.REAR_END,
        }),
        frameRate: 3,
        repeat: -1,
        yoyo: true,
      })
    }
  }

  // 말의 Y 위치 비율 (게임 높이 기준)
  private static readonly HORSE_Y_RATIOS = [0.52, 0.565, 0.61, 0.655, 0.7, 0.745, 0.79, 0.835]

  private createHorses(gameHeight: number, startXOnScreen: number) {
    const horseScale = 2

    const START_X_OFFSET = -40
    const IDLE_TWEEN_DISTANCES = [100, 170, 140, 30, 110, 150, 130, 180]
    const TWEEN_DURATIONS = [3000, 3200, 3800, 3400, 3600, 3800, 3500, 3200]
    const BASE_DEPTH = 10

    const horseConfigs = HorseManager.HORSE_Y_RATIOS.map((ratio, index) => ({
      textureKey: `horse${index + 1}`,
      idleAnimKey: `horse${index + 1}_waiting`,
      runAnimKey: `horse${index + 1}_run_right`,
      startX: startXOnScreen + START_X_OFFSET,
      endX: startXOnScreen + START_X_OFFSET + IDLE_TWEEN_DISTANCES[index],
      y: gameHeight * ratio,
      scale: horseScale,
      depth: BASE_DEPTH + index,
      tweenDuration: TWEEN_DURATIONS[index],
    }))

    // 말 8마리 생성
    for (const config of horseConfigs) {
      this.horses.push(new HorseRunner(this.scene, config, this.REAR_START))
    }
  }

  private static readonly HORSE_COUNT = 8

  private initializeSimHorses() {
    this.simHorses = []
    for (let i = 0; i < HorseManager.HORSE_COUNT; i++) {
      const stats = generateRandomStats()
      const horseName = `Horse_${i + 1}`
      const simHorse = new Horse(horseName, stats)
      simHorse.prepareForRace()
      this.simHorses.push(simHorse)
    }
  }

  private createPlayerIndicator(
    playerHorseIndex: number,
    startXOnScreen: number,
    arrowTextureKey: string,
  ) {
    const START_X_OFFSET = -40
    const INDICATOR_Y_OFFSET = -185

    const indicatorX = startXOnScreen + START_X_OFFSET
    const indicatorY =
      this.scene.scale.height * HorseManager.HORSE_Y_RATIOS[playerHorseIndex] + INDICATOR_Y_OFFSET

    this.playerIndicator = this.scene.add.image(indicatorX, indicatorY, arrowTextureKey)
    this.playerIndicator.setOrigin(0.5)
    this.playerIndicator.setScale(0.8)
    this.scene.textures.get(arrowTextureKey).setFilter(Phaser.Textures.FilterMode.NEAREST)
    this.playerIndicator.setDepth(25)

    const MOVE_DISTANCE = 8
    const MOVE_DURATION = 600

    this.playerIndicatorTween = this.scene.tweens.add({
      targets: this.playerIndicator,
      y: indicatorY + MOVE_DISTANCE,
      duration: MOVE_DURATION,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  getSimHorses(): Horse[] {
    return this.simHorses
  }

  getHorses(): HorseRunner[] {
    return this.horses
  }

  startAllHorses() {
    this.horses.forEach((horse) => horse.startRun())
  }

  updateHorsePositions(screenX: number[]) {
    for (let i = 0; i < this.horses.length && i < screenX.length; i++) {
      this.horses[i].updatePosition(screenX[i])
    }
  }

  hidePlayerIndicator() {
    if (this.playerIndicator) {
      this.playerIndicator.setVisible(false)
    }
    if (this.playerIndicatorTween) {
      this.playerIndicatorTween.stop()
    }
  }
}
