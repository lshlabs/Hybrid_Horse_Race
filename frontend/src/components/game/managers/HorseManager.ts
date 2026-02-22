import Phaser from 'phaser'
import type { Augment, AugmentRarity } from '../../../engine/race'
import {
  Horse,
  generateRandomStats,
  applyAugmentsToStats,
  generateAugmentChoices,
  createLastSpurtAugment,
  createOvertakeAugment,
  createEscapeCrisisAugment,
} from '../../../engine/race'

// HorseManager는 "화면용 말 스프라이트"와 "시뮬레이션용 Horse"를 같이 관리한다.
// 실제 물리 계산은 엔진 Horse가 하고, 이 파일은 배치/표시/동기화 쪽을 맡는다.
/**
 * 화면에 그려지는 말(스프라이트) 전용 클래스
 * - 시뮬레이션 로직은 Horse(엔진)에서 처리
 * - 이 클래스는 위치/애니메이션만 담당
 */
class HorseRunner {
  private scene: Phaser.Scene
  private sprite: Phaser.GameObjects.Sprite
  private config: {
    textureKey: string
    idleAnimKeys: [string, string, string]
    runAnimKey: string
    startX: number
    y: number
    scale: number
    depth: number
    /** 말마다 다른 준비 동작 패턴. [0,1,2,...] = ready1→ready2→ready3... 반복. 없으면 0,1 교대 */
    idleSequence?: number[]
  }
  /** idleSequence 사용 시 현재 재생 중인 시퀀스 인덱스 */
  private idleSequenceIndex = 0

  constructor(
    scene: Phaser.Scene,
    config: {
      textureKey: string
      idleAnimKeys: [string, string, string]
      runAnimKey: string
      startX: number
      y: number
      scale: number
      depth: number
      idleSequence?: number[]
    },
    idleFrameIndex: number,
  ) {
    this.scene = scene
    this.config = config

    this.sprite = this.scene.add
      .sprite(this.config.startX, this.config.y, this.config.textureKey, idleFrameIndex)
      .setOrigin(1, 1)
      .setScale(this.config.scale)
      .setDepth(this.config.depth)

    const [idle1, idle2, idle3] = this.config.idleAnimKeys
    const seq = this.config.idleSequence
    this.sprite.on('animationcomplete', (completedAnim: Phaser.Animations.Animation) => {
      if (seq && seq.length > 0) {
        this.idleSequenceIndex = (this.idleSequenceIndex + 1) % seq.length
        const nextIndex = seq[this.idleSequenceIndex]
        this.sprite.play(this.config.idleAnimKeys[nextIndex])
      } else {
        if (completedAnim.key === idle1) this.sprite.play(idle2)
        else if (completedAnim.key === idle2) this.sprite.play(idle3)
        else if (completedAnim.key === idle3) this.sprite.play(idle1)
      }
    })
    if (seq && seq.length > 0) {
      this.idleSequenceIndex = 0
      this.sprite.play(this.config.idleAnimKeys[seq[0]])
    } else {
      this.sprite.play(idle1)
    }
  }

  startRun() {
    this.sprite.play(this.config.runAnimKey)
  }

  resetToIdle() {
    const seq = this.config.idleSequence
    if (seq && seq.length > 0) {
      this.idleSequenceIndex = 0
      this.sprite.play(this.config.idleAnimKeys[seq[0]])
    } else {
      this.sprite.play(this.config.idleAnimKeys[0])
    }
    this.sprite.x = this.config.startX
  }

  updatePosition(x: number) {
    this.sprite.x = x
    const [idle1, idle2, idle3] = this.config.idleAnimKeys
    const isIdle =
      this.sprite.anims.currentAnim?.key === idle1 ||
      this.sprite.anims.currentAnim?.key === idle2 ||
      this.sprite.anims.currentAnim?.key === idle3
    if (!this.sprite.anims.isPlaying || isIdle) {
      this.sprite.play(this.config.runAnimKey)
    }
  }

  destroy() {
    // idle tween 미사용
    // if (this.tween && this.tween.state < 5) {
    //   try { this.tween.stop() } catch (err) { console.warn('[HorseRunner] Cannot stop destroyed tween:', err) }
    // }
    this.sprite.destroy()
  }

  getDisplayWidth(): number {
    return this.sprite.displayWidth
  }

  getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite
  }
}

export interface HorseManagerConfig {
  scene: Phaser.Scene
  gameHeight: number
  /** 출발선 월드 X (px). TileMapManager.getTrackStartWorldXPx() 등 단일 소스에서 전달 */
  getTrackStartWorldXPx: () => number
  /** 트랙 길이(m). TileMapManager.getTrackLengthM() 등 단일 소스에서 전달 */
  getTrackLengthM: () => number
  /** 말 코 오프셋(m). TileMapManager.getFinishLineOffsetM()과 동일할 것. 미지정 시 Horse 기본값 사용 */
  getFinishLineOffsetM?: () => number
  playerHorseIndex?: number
  arrowTextureKey: string
  playerCount?: number
  playerNames?: string[]
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
  // 렌더링용 스프라이트 배열 (화면 표시)
  private horses: HorseRunner[] = []
  // 시뮬레이션용 Horse 배열 (물리/스탯 계산)
  private simHorses: Horse[] = []
  private playerIndicator?: Phaser.GameObjects.Image
  private playerIndicatorChain?: Phaser.Tweens.TweenChain
  private playerIndicatorBaseX = 0
  private playerIndicatorBaseY = 0
  private playerCount: number
  /** 각 말의 증강 (인덱스 = 말 번호 - 1), 현재 라운드만 */
  private horseAugments: Augment[][] = []
  /** 라운드별 누적 증강 (결과 화면 표시용) */
  private accumulatedAugments: Augment[][] = []

  constructor(config: HorseManagerConfig) {
    this.scene = config.scene
    this.playerCount = config.playerCount ?? 8 // 기본값 8

    // 말 애니메이션은 씬당 한 번만 만들면 되지만, exists 체크가 있어서 여러 번 호출돼도 안전하다.
    this.createHorseAnimations()

    // 화면 배치용 말 생성
    const trackStartWorldXPx = config.getTrackStartWorldXPx()
    this.createHorses(config.gameHeight, trackStartWorldXPx)

    // 시뮬레이션용 말 생성 (실제 레이스 준비는 증강 선택 후 prepareAllHorsesForRace에서 다시 맞춘다)
    this.initializeSimHorses(config.playerNames)

    if (config.playerHorseIndex !== undefined) {
      this.createPlayerIndicator(
        config.playerHorseIndex,
        trackStartWorldXPx,
        config.arrowTextureKey,
      )
    }
  }

  private createHorseAnimations() {
    // 대기/달리기 애니메이션을 말 번호별로 만든다.
    // ready1/ready2/ready3는 대기 모션 종류이고, run은 레이스 중 반복 재생된다.
    const IDLE_FRAME_ORDER = [0, 1, 2, 1, 0] // ready1/ready2: 1row,2row,3row,2row,1row
    const READY3_FRAME_ORDER = [0, 1, 2, 3, 4, 5, 6, 7] // ready3: 앞발 드는 동작 8프레임

    for (let i = 1; i <= this.playerCount; i++) {
      const ready1Key = `horse${i}_ready1`
      const ready2Key = `horse${i}_ready2`
      const ready3Key = `horse${i}_ready3`
      const runKey = `horse${i}_run`
      if (!this.scene.anims.exists(`horse${i}_idle_ready1`)) {
        this.scene.anims.create({
          key: `horse${i}_idle_ready1`,
          frames: IDLE_FRAME_ORDER.map((frame) => ({ key: ready1Key, frame })),
          frameRate: 4,
          repeat: 0,
        })
      }
      if (!this.scene.anims.exists(`horse${i}_idle_ready2`)) {
        this.scene.anims.create({
          key: `horse${i}_idle_ready2`,
          frames: IDLE_FRAME_ORDER.map((frame) => ({ key: ready2Key, frame })),
          frameRate: 4,
          repeat: 0,
        })
      }
      if (!this.scene.anims.exists(`horse${i}_idle_ready3`)) {
        this.scene.anims.create({
          key: `horse${i}_idle_ready3`,
          frames: READY3_FRAME_ORDER.map((frame) => ({ key: ready3Key, frame })),
          frameRate: 6,
          repeat: 0,
        })
      }
      if (!this.scene.anims.exists(`horse${i}_run`)) {
        this.scene.anims.create({
          key: `horse${i}_run`,
          frames: this.scene.anims.generateFrameNumbers(runKey, { start: 0, end: 5 }),
          frameRate: 12,
          repeat: -1,
        })
      }
    }
  }

  // 말의 Y 위치 비율 (게임 높이 기준) - 8마리 기준
  /** 8마리 말 Y 비율 - 0.52 ~ 0.96 균등 분배 */
  private static readonly HORSE_Y_RATIOS_FULL = Array.from(
    { length: 8 },
    (_, i) => 0.45 + ((0.82 - 0.45) * i) / 7,
  )

  /**
   * 대기 모션 시퀀스: 기본(0) 80%, 특수2(1) 10%, 특수3(2) 10%.
   * 시퀀스 길이 10으로 비율 맞춘 뒤 셔플하여 반복 재생.
   */
  private static randomIdleSequence(): number[] {
    const seq = [...Array(8).fill(0), ...Array(1).fill(1), ...Array(1).fill(2)] as number[]
    for (let i = seq.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[seq[i], seq[j]] = [seq[j], seq[i]]
    }
    return seq
  }

  private createHorses(gameHeight: number, trackStartWorldXPx: number) {
    const horseScale = 2

    const BASE_DEPTH = 10

    const minYRatio = HorseManager.HORSE_Y_RATIOS_FULL[0]
    const maxYRatio = HorseManager.HORSE_Y_RATIOS_FULL[7]
    const yRatios = this.calculateHorseYRatios(minYRatio, maxYRatio)

    // 레인 순서대로 말 번호를 고정 배치한다 (1~playerCount)
    const horseOrder = Array.from({ length: this.playerCount }, (_, i) => i + 1)

    const startX = trackStartWorldXPx
    // 화면 배치용 설정을 먼저 만들고, 아래에서 HorseRunner를 생성한다.
    const horseConfigs = yRatios.map((ratio, index) => {
      const n = horseOrder[index]
      return {
        textureKey: `horse${n}_ready1`,
        idleAnimKeys: [
          `horse${n}_idle_ready1`,
          `horse${n}_idle_ready2`,
          `horse${n}_idle_ready3`,
        ] as [string, string, string],
        runAnimKey: `horse${n}_run`,
        startX,
        y: gameHeight * ratio,
        scale: horseScale,
        depth: BASE_DEPTH + index,
        idleSequence: HorseManager.randomIdleSequence(),
      }
    })

    for (const config of horseConfigs) {
      this.horses.push(new HorseRunner(this.scene, config, 0))
    }
  }

  /**
   * 플레이어 수에 따른 사용 범위 비율 반환
   * 플레이어 수가 적을수록 더 가까이 배치
   */
  private getRangeRatioForPlayerCount(playerCount: number): number {
    const rangeRatios: Record<number, number> = {
      2: 0.25, // 2명: 25%
      3: 0.4, // 3명: 40%
      4: 0.55, // 4명: 55%
      5: 0.65, // 5명: 65%
      6: 0.72, // 6명: 72%
      7: 0.76, // 7명: 76%
      8: 0.8, // 8명: 80%
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

  /**
   * 시뮬레이션용 말 생성만 수행. 컨디션 롤·파생 파라미터는 증강 선택 직후
   * applyAugmentsToAllHorses 또는 prepareAllHorsesForRace에서 한 번만 수행.
   */
  private initializeSimHorses(playerNames?: string[]) {
    this.simHorses = []
    for (let i = 0; i < this.playerCount; i++) {
      // 로컬 생성 시점에는 랜덤 스탯으로 만들고, authoritative 흐름에서는 이후 서버값으로 덮일 수 있다.
      const stats = generateRandomStats()
      const displayName = playerNames && playerNames[i] ? playerNames[i] : `Horse_${i + 1}`
      const simHorse = new Horse(displayName, stats)
      this.simHorses.push(simHorse)
    }
  }

  /** 화살표 가이드: fade-in → 오른쪽 이동 + fade-out 루프 (가이드 Timeline 방식) */
  private static readonly ARROW_FADE_IN_MS = 180
  private static readonly ARROW_FLY_MS = 520
  private static readonly ARROW_FLY_DISTANCE = 220
  private static readonly ARROW_LOOP_DELAY_MS = 350
  /** 화살표 연출 반복 횟수 (등장 ~ 레이스 스타트 구간에서만) */
  private static readonly ARROW_LOOP_COUNT = 10
  /** right-arrow 에셋 512px → 말(44*scale2≈88px)에 맞춤: 88/512 ≈ 0.17 */
  private static readonly ARROW_DISPLAY_SIZE_PX = 44
  private static readonly ARROW_SOURCE_SIZE_PX = 512
  private static readonly ARROW_SCALE =
    HorseManager.ARROW_DISPLAY_SIZE_PX / HorseManager.ARROW_SOURCE_SIZE_PX
  /** 말 코(오른쪽 끝)에서 화살표까지 간격(px) */
  private static readonly ARROW_GAP_RIGHT = 16
  /** 말 스프라이트 높이(44*2). 세로 중앙 맞출 때 사용 */
  private static readonly HORSE_DISPLAY_HEIGHT_PX = 88

  private createPlayerIndicator(
    playerHorseIndex: number,
    trackStartWorldXPx: number,
    arrowTextureKey: string,
  ) {
    // 플레이어 말 위에 붙는 화살표는 trackStart 기준으로 초기 위치를 계산한다.
    const startX = trackStartWorldXPx

    const minYRatio = HorseManager.HORSE_Y_RATIOS_FULL[0]
    const maxYRatio = HorseManager.HORSE_Y_RATIOS_FULL[7]
    const allRatios = this.calculateHorseYRatios(minYRatio, maxYRatio)
    const playerHorseYRatio = allRatios[playerHorseIndex] ?? (minYRatio + maxYRatio) / 2

    const indicatorX =
      startX + HorseManager.ARROW_GAP_RIGHT + HorseManager.ARROW_DISPLAY_SIZE_PX / 2
    const indicatorY =
      this.scene.scale.height * playerHorseYRatio - HorseManager.HORSE_DISPLAY_HEIGHT_PX / 2
    this.playerIndicatorBaseX = indicatorX
    this.playerIndicatorBaseY = indicatorY

    this.playerIndicator = this.scene.add
      .image(indicatorX, indicatorY, arrowTextureKey)
      .setOrigin(0.5, 0.5)
      .setAlpha(0)
      .setScale(HorseManager.ARROW_SCALE)
      .setDepth(25)
      .setScrollFactor(0)
      .setVisible(false)

    // 화살표 가이드는 "등장 -> 오른쪽으로 날아가며 사라짐"을 반복한다.
    this.playerIndicatorChain = this.scene.add.tweenchain({
      paused: true,
      persist: true,
      loop: HorseManager.ARROW_LOOP_COUNT - 1,
      loopDelay: HorseManager.ARROW_LOOP_DELAY_MS,
      tweens: [
        {
          targets: this.playerIndicator,
          x: indicatorX,
          alpha: 0,
          duration: 0,
        },
        {
          targets: this.playerIndicator,
          alpha: 1,
          duration: HorseManager.ARROW_FADE_IN_MS,
          ease: 'Sine.easeOut',
        },
        {
          targets: this.playerIndicator,
          x: indicatorX + HorseManager.ARROW_FLY_DISTANCE,
          alpha: 0,
          duration: HorseManager.ARROW_FLY_MS,
          ease: 'Cubic.easeIn',
        },
      ],
    })
  }

  getSimHorses(): Horse[] {
    return this.simHorses
  }

  getHorses(): HorseRunner[] {
    return this.horses
  }

  getHorseSprite(index: number): Phaser.GameObjects.Sprite | undefined {
    return this.horses[index]?.getSprite()
  }

  startAllHorses() {
    this.horses.forEach((horse) => horse.startRun())
  }

  updateHorsePositions(screenX: number[]) {
    // screenX 배열은 레인 순서와 같은 인덱스 순서라고 가정한다.
    for (let i = 0; i < this.horses.length && i < screenX.length; i++) {
      this.horses[i].updatePosition(screenX[i])
    }
  }

  hidePlayerIndicator() {
    if (this.playerIndicator) {
      this.playerIndicator
        .setVisible(false)
        .setAlpha(0)
        .setX(this.playerIndicatorBaseX)
        .setY(this.playerIndicatorBaseY)
    }
    if (this.playerIndicatorChain && this.playerIndicatorChain.isPlaying()) {
      this.playerIndicatorChain.stop()
    }
  }

  showPlayerIndicator() {
    if (!this.playerIndicator) return
    this.playerIndicator
      .setVisible(true)
      .setAlpha(0)
      .setX(this.playerIndicatorBaseX)
      .setY(this.playerIndicatorBaseY)
    if (this.playerIndicatorChain) {
      try {
        this.playerIndicatorChain.restart()
        this.playerIndicatorChain.play()
      } catch (err) {
        console.warn('[HorseManager] Cannot restart player indicator chain:', err)
      }
    }
  }

  resetHorsesToIdle() {
    this.horses.forEach((horse) => horse.resetToIdle())
  }

  /** 모든 말에 동일 등급의 랜덤 증강 부여 (플레이어 말은 선택한 증강 사용) */
  assignAugmentsToAllHorses(
    rarity: AugmentRarity,
    playerAugment: Augment,
    playerHorseIndex: number,
  ) {
    this.horseAugments = []
    for (let i = 0; i < this.simHorses.length; i++) {
      let randomAugment: Augment
      if (i === playerHorseIndex) {
        // 플레이어 말은 실제 선택한 증강 사용
        randomAugment = playerAugment
      } else {
        // 나머지 말은 같은 rarity 안에서 랜덤 증강 생성
        if (rarity === 'hidden') {
          const roll = Math.random()
          if (roll < 0.09) {
            const specialAbilities = [
              createLastSpurtAugment(),
              createOvertakeAugment(),
              createEscapeCrisisAugment(),
            ]
            randomAugment = specialAbilities[Math.floor(Math.random() * specialAbilities.length)]
          } else {
            const choices = generateAugmentChoices('legendary')
            randomAugment = choices[Math.floor(Math.random() * choices.length)]
          }
        } else {
          const choices = generateAugmentChoices(rarity)
          randomAugment = choices[Math.floor(Math.random() * choices.length)]
        }
      }
      this.horseAugments.push([randomAugment])
    }

    // 누적 증강에 이번 라운드 선택 추가 (결과 창에서 라운드별 누적 표시용)
    // 결과 화면에서 누적 표시를 위해 라운드 증강을 따로 쌓아둔다.
    while (this.accumulatedAugments.length < this.simHorses.length) {
      this.accumulatedAugments.push([])
    }
    for (let i = 0; i < this.simHorses.length; i++) {
      if (this.horseAugments[i]?.[0]) {
        this.accumulatedAugments[i].push(this.horseAugments[i][0])
      }
    }
  }

  /**
   * 모든 말에 증강 적용 (baseStats 업데이트) 후 prepareForRace 호출.
   * 행운 보너스는 이 시점(증강 선택 직후)에만 적용됨.
   */
  applyAugmentsToAllHorses(getTrackLengthM: () => number, getFinishLineOffsetM?: () => number) {
    const trackLengthM = getTrackLengthM()
    const finishLineOffsetM = getFinishLineOffsetM?.()
    for (let i = 0; i < this.simHorses.length; i++) {
      const horse = this.simHorses[i]
      const augments = this.horseAugments[i] || []
      if (horse) {
        if (augments.length > 0) {
          // 스탯 증가형 + 특수능력형을 같이 반영
          const augmentedStats = applyAugmentsToStats(horse.baseStats, augments)
          horse.baseStats = augmentedStats
          for (const augment of augments) {
            if (augment.specialAbility && augment.specialAbilityValue != null) {
              horse.setSpecialAbility(augment.specialAbility, augment.specialAbilityValue)
            }
          }
        }
        // 최종적으로 트랙 길이 기준 준비 상태(컨디션 포함)를 만든다.
        horse.prepareForRace(trackLengthM, finishLineOffsetM)
      }
    }
  }

  /**
   * 증강 없이 모든 말에 prepareForRace만 호출 (컨디션 롤 포함).
   * 증강 선택을 취소했을 때, 레이스 시작 전에 한 번 호출.
   */
  prepareAllHorsesForRace(
    getTrackLengthM: () => number,
    getFinishLineOffsetM?: () => number,
    resolveConditionRoll?: (index: number, horse: Horse) => number | undefined,
  ) {
    const trackLengthM = getTrackLengthM()
    const finishLineOffsetM = getFinishLineOffsetM?.()
    this.simHorses.forEach((horse, index) => {
      // 서버 authoritative에서 받은 컨디션 롤이 있으면 resolveConditionRoll로 고정해서 맞춘다.
      const fixedConditionRoll = resolveConditionRoll?.(index, horse)
      horse.prepareForRace(trackLengthM, finishLineOffsetM, fixedConditionRoll)
    })
  }

  getHorseAugments(): Augment[][] {
    return this.horseAugments
  }

  /** 라운드 진행에 따라 누적된 증강 (결과 창 표시용) */
  getAccumulatedAugments(): Augment[][] {
    return this.accumulatedAugments
  }

  /**
   * HorseManager 정리 (인디케이터 제거)
   */
  destroy() {
    if (this.playerIndicatorChain && this.playerIndicatorChain.isActive()) {
      this.playerIndicatorChain.stop()
    }
    this.playerIndicatorChain = undefined
    if (this.playerIndicator) {
      this.playerIndicator.destroy()
      this.playerIndicator = undefined
    }
  }
}
