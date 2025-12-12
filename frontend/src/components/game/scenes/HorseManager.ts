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

    // 텍스처 필터 설정
    for (let i = 1; i <= 8; i++) {
      const tex = this.scene.textures.get(`horse${i}`)
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST)
    }

    // 달리기 애니메이션 생성
    for (let i = 1; i <= 8; i++) {
      this.scene.anims.create({
        key: `horse${i}_run_right`,
        frames: RUN_FRAMES.map((frameIndex) => ({
          key: `horse${i}`,
          frame: frameIndex,
        })),
        frameRate: 12,
        repeat: -1,
      })
    }

    // 대기 애니메이션 생성
    for (let i = 1; i <= 8; i++) {
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

  private createHorses(gameHeight: number, startXOnScreen: number) {
    const horseScale = 2

    const horseY1 = gameHeight * 0.52
    const horseY2 = gameHeight * 0.565
    const horseY3 = gameHeight * 0.61
    const horseY4 = gameHeight * 0.655
    const horseY5 = gameHeight * 0.7
    const horseY6 = gameHeight * 0.745
    const horseY7 = gameHeight * 0.79
    const horseY8 = gameHeight * 0.835

    const horseConfigs = [
      {
        textureKey: 'horse1',
        idleAnimKey: 'horse1_waiting',
        runAnimKey: 'horse1_run_right',
        startX: startXOnScreen - 40,
        endX: startXOnScreen - 40 + 100,
        y: horseY1,
        scale: horseScale,
        depth: 10,
        tweenDuration: 3000,
      },
      {
        textureKey: 'horse2',
        idleAnimKey: 'horse2_waiting',
        runAnimKey: 'horse2_run_right',
        startX: startXOnScreen - 40,
        endX: startXOnScreen - 40 + 170,
        y: horseY2,
        scale: horseScale,
        depth: 11,
        tweenDuration: 3200,
      },
      {
        textureKey: 'horse3',
        idleAnimKey: 'horse3_waiting',
        runAnimKey: 'horse3_run_right',
        startX: startXOnScreen - 40,
        endX: startXOnScreen - 40 + 140,
        y: horseY3,
        scale: horseScale,
        depth: 12,
        tweenDuration: 3800,
      },
      {
        textureKey: 'horse4',
        idleAnimKey: 'horse4_waiting',
        runAnimKey: 'horse4_run_right',
        startX: startXOnScreen - 40,
        endX: startXOnScreen - 40 + 30,
        y: horseY4,
        scale: horseScale,
        depth: 13,
        tweenDuration: 3400,
      },
      {
        textureKey: 'horse5',
        idleAnimKey: 'horse5_waiting',
        runAnimKey: 'horse5_run_right',
        startX: startXOnScreen - 40,
        endX: startXOnScreen - 40 + 110,
        y: horseY5,
        scale: horseScale,
        depth: 14,
        tweenDuration: 3600,
      },
      {
        textureKey: 'horse6',
        idleAnimKey: 'horse6_waiting',
        runAnimKey: 'horse6_run_right',
        startX: startXOnScreen - 40,
        endX: startXOnScreen - 40 + 150,
        y: horseY6,
        scale: horseScale,
        depth: 15,
        tweenDuration: 3800,
      },
      {
        textureKey: 'horse7',
        idleAnimKey: 'horse7_waiting',
        runAnimKey: 'horse7_run_right',
        startX: startXOnScreen - 40,
        endX: startXOnScreen - 40 + 130,
        y: horseY7,
        scale: horseScale,
        depth: 16,
        tweenDuration: 3500,
      },
      {
        textureKey: 'horse8',
        idleAnimKey: 'horse8_waiting',
        runAnimKey: 'horse8_run_right',
        startX: startXOnScreen - 40,
        endX: startXOnScreen - 40 + 180,
        y: horseY8,
        scale: horseScale,
        depth: 17,
        tweenDuration: 3200,
      },
    ]

    // 말 8마리 생성
    for (const config of horseConfigs) {
      this.horses.push(new HorseRunner(this.scene, config, this.REAR_START))
    }
  }

  private initializeSimHorses() {
    this.simHorses = []
    for (let i = 0; i < 8; i++) {
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
    const horseYPositions = [
      this.scene.scale.height * 0.52,
      this.scene.scale.height * 0.565,
      this.scene.scale.height * 0.61,
      this.scene.scale.height * 0.655,
      this.scene.scale.height * 0.7,
      this.scene.scale.height * 0.745,
      this.scene.scale.height * 0.79,
      this.scene.scale.height * 0.835,
    ]

    const indicatorX = startXOnScreen - 40
    const indicatorY = horseYPositions[playerHorseIndex] - 110

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
