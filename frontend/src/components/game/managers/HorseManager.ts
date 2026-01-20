import Phaser from 'phaser'
import { Horse, generateRandomStats } from '../../../engine/race'

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

  destroy() {
    this.tween?.stop()
    this.sprite.destroy()
  }
}

export interface HorseManagerConfig {
  scene: Phaser.Scene
  gameHeight: number
  startXOnScreen: number
  playerHorseIndex?: number
  arrowTextureKey: string
  playerCount?: number // 선택된 플레이어 수 (기본값: 8)
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
  private playerCount: number

  constructor(config: HorseManagerConfig) {
    this.scene = config.scene
    this.playerCount = config.playerCount ?? 8 // 기본값 8

    // 말 애니메이션 생성
    this.createHorseAnimations()

    // 선택된 플레이어 수만큼 말 생성
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

    // 선택된 플레이어 수만큼 애니메이션 생성
    for (let i = 1; i <= this.playerCount; i++) {
      // 달리기 애니메이션 생성 (이미 존재하지 않을 때만)
      const runKey = `horse${i}_run_right`
      if (!this.scene.anims.exists(runKey)) {
        this.scene.anims.create({
          key: runKey,
          frames: RUN_FRAMES.map((frameIndex) => ({
            key: `horse${i}`,
            frame: frameIndex,
          })),
          frameRate: 12,
          repeat: -1,
        })
      }

      // 대기 애니메이션 생성 (이미 존재하지 않을 때만)
      const waitKey = `horse${i}_waiting`
      if (!this.scene.anims.exists(waitKey)) {
        this.scene.anims.create({
          key: waitKey,
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
  }

  // 말의 Y 위치 비율 (게임 높이 기준) - 8마리 기준
  private static readonly HORSE_Y_RATIOS_FULL = [0.52, 0.565, 0.61, 0.655, 0.7, 0.745, 0.79, 0.835]

  private createHorses(gameHeight: number, startXOnScreen: number) {
    const horseScale = 2

    const START_X_OFFSET = -40
    const IDLE_TWEEN_DISTANCES = [100, 170, 140, 30, 110, 150, 130, 180]
    const TWEEN_DURATIONS = [3000, 3200, 3800, 3400, 3600, 3800, 3500, 3200]
    const BASE_DEPTH = 10

    // 1번말과 8번말의 Y 비율을 기준으로 선택된 플레이어 수만큼 균등 분배
    const minYRatio = HorseManager.HORSE_Y_RATIOS_FULL[0] // 1번말 위치 (0.52)
    const maxYRatio = HorseManager.HORSE_Y_RATIOS_FULL[7] // 8번말 위치 (0.835)
    const yRatios = this.calculateHorseYRatios(minYRatio, maxYRatio)

    const horseConfigs = yRatios.map((ratio, index) => ({
      textureKey: `horse${index + 1}`,
      idleAnimKey: `horse${index + 1}_waiting`,
      runAnimKey: `horse${index + 1}_run_right`,
      startX: startXOnScreen + START_X_OFFSET,
      endX:
        startXOnScreen + START_X_OFFSET + IDLE_TWEEN_DISTANCES[index % IDLE_TWEEN_DISTANCES.length],
      y: gameHeight * ratio,
      scale: horseScale,
      depth: BASE_DEPTH + index,
      tweenDuration: TWEEN_DURATIONS[index % TWEEN_DURATIONS.length],
    }))

    // 선택된 플레이어 수만큼 말 생성
    for (const config of horseConfigs) {
      this.horses.push(new HorseRunner(this.scene, config, this.REAR_START))
    }
  }

  /**
   * 플레이어 수에 따른 사용 범위 비율 반환
   * 플레이어 수가 적을수록 더 가까이 배치
   */
  private getRangeRatioForPlayerCount(playerCount: number): number {
    const rangeRatios: Record<number, number> = {
      2: 0.25, // 2명: 25% (매우 가까이)
      3: 0.4, // 3명: 40% (가까이)
      4: 0.55, // 4명: 55%
      5: 0.65, // 5명: 65%
      6: 0.72, // 6명: 72%
      7: 0.76, // 7명: 76%
      8: 0.8, // 8명: 80% (기존)
    }
    return rangeRatios[playerCount] || 0.8
  }

  /**
   * 말의 Y 위치 비율 계산 (중앙 기준으로 균등 분배)
   */
  private calculateHorseYRatios(minYRatio: number, maxYRatio: number): number[] {
    const ratios: number[] = []

    if (this.playerCount <= 1) {
      // 최소 1마리는 가운데에 배치
      ratios.push((minYRatio + maxYRatio) / 2)
    } else {
      // 중앙 기준으로 균등 분배
      const centerY = (minYRatio + maxYRatio) / 2
      const totalRange = maxYRatio - minYRatio

      // 말들 사이의 간격 계산 (중앙을 기준으로 양쪽으로 균등 분배)
      // 플레이어 수가 적을수록 더 가까이 배치 (2명: 25%, 3명: 40%, 4명 이상: 점진적으로 증가)
      const rangeRatio = this.getRangeRatioForPlayerCount(this.playerCount)
      const usableRange = totalRange * rangeRatio
      const step = usableRange / (this.playerCount - 1)

      // 중앙에서 시작하여 양쪽으로 분배
      // 예: 2명이면 [-step/2, +step/2], 3명이면 [-step, 0, +step]
      const startOffset = (-(this.playerCount - 1) * step) / 2

      for (let i = 0; i < this.playerCount; i++) {
        const yRatio = centerY + startOffset + step * i
        ratios.push(yRatio)
      }
    }

    return ratios
  }

  private initializeSimHorses() {
    this.simHorses = []
    for (let i = 0; i < this.playerCount; i++) {
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
    const INDICATOR_Y_OFFSET = -220 // 말의 머리 위에 표시되도록 오프셋 조정

    const indicatorX = startXOnScreen + START_X_OFFSET

    // 플레이어 말의 Y 위치 비율 계산 (동적 배치와 동일한 로직 사용)
    const minYRatio = HorseManager.HORSE_Y_RATIOS_FULL[0] // 1번말 위치 (0.52)
    const maxYRatio = HorseManager.HORSE_Y_RATIOS_FULL[7] // 8번말 위치 (0.835)

    // calculateHorseYRatios와 동일한 로직 사용
    const allRatios = this.calculateHorseYRatios(minYRatio, maxYRatio)
    const playerHorseYRatio = allRatios[playerHorseIndex] || (minYRatio + maxYRatio) / 2

    const indicatorY = this.scene.scale.height * playerHorseYRatio + INDICATOR_Y_OFFSET

    this.playerIndicator = this.scene.add.image(indicatorX, indicatorY, arrowTextureKey)
    this.playerIndicator.setOrigin(0.5)
    this.playerIndicator.setScale(0.8)
    // 필터는 RaceScene에서 일괄 적용
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

  /**
   * HorseManager 정리 (인디케이터 제거)
   */
  destroy() {
    // 플레이어 인디케이터 제거
    if (this.playerIndicator) {
      this.playerIndicator.destroy()
      this.playerIndicator = undefined
    }
    if (this.playerIndicatorTween) {
      this.playerIndicatorTween.stop()
      this.playerIndicatorTween = undefined
    }
  }
}
