import Phaser from 'phaser'
import type { AugmentRarity } from '../../../../../engine/race'
import { AUGMENT_RARITY_NAMES } from '../../../../../engine/race'

const FRAME_WIDTH = 400
const FRAME_HEIGHT = 120
const FRAME_RADIUS = 16
const FRAME_BORDER_COLOR = 0xffd700
const FRAME_BG_ALPHA = 0.8
const SLOT_TEXT_SPACING = 90
const SLOT_SPIN_DURATION_MS = 5000
const SLOT_REPEAT_COUNT = 20
const SLOT_TEXT_FONT_SIZE = '48px'
const SLOT_INITIAL_Y_OFFSET = 500
const SLOT_TEXT_FONT_FAMILY = 'NeoDunggeunmo'
const PARTICLE_COUNT = 30
const PARTICLE_DISTANCE = 200
const PARTICLE_RADIUS = 8
const PARTICLE_DURATION_MS = 800
const RESULT_PULSE_DURATION_MS = 300
const RESULT_FADE_DURATION_MS = 800
const SLOT_CONTAINER_DEPTH = 1000

function toHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

function buildRouletteRarityPool(rarityColors: Record<AugmentRarity, number>) {
  const rarities: AugmentRarity[] = ['common', 'rare', 'epic', 'legendary']
  return {
    rarities,
    rarityNames: rarities.map((rarity) => AUGMENT_RARITY_NAMES[rarity]),
    rarityColorValues: rarities.map((rarity) => rarityColors[rarity]),
  }
}

/**
 * 증강 등급 룰렛 연출 모듈.
 * - 슬롯 텍스트 스핀 -> 최종 등급 강조 -> 파티클 -> 페이드아웃
 * - 연출 완료 시 콜백으로 다음 UI(카드 선택)를 이어준다.
 *
 * 분리 이유:
 * - AugmentSelectionScene에서 연출 세부 구현을 제거해 흐름 코드를 단순화
 */
export default class RouletteAnimator {
  private scene: Phaser.Scene
  private uiOffsetY: number
  private rarityColors: Record<AugmentRarity, number>
  private rarity: AugmentRarity
  private visualDelayMs: number
  private onComplete: (width: number, height: number) => void
  private slotMachineContainer?: Phaser.GameObjects.Container
  private startDelayCall?: Phaser.Time.TimerEvent

  constructor(config: {
    scene: Phaser.Scene
    uiOffsetY: number
    rarityColors: Record<AugmentRarity, number>
    rarity: AugmentRarity
    visualDelayMs: number
    onComplete: (width: number, height: number) => void
  }) {
    this.scene = config.scene
    this.uiOffsetY = config.uiOffsetY
    this.rarityColors = config.rarityColors
    this.rarity = config.rarity
    this.visualDelayMs = config.visualDelayMs
    this.onComplete = config.onComplete
  }

  /** 룰렛 연출을 시작한다. */
  start(width: number, height: number) {
    const startVisual = () => {
      // 룰렛 전용 컨테이너: 씬 전환 시 한 번에 정리하기 쉽도록 묶는다.
      this.slotMachineContainer = this.scene.add.container(0, 0)
      this.slotMachineContainer.setDepth(SLOT_CONTAINER_DEPTH)

      const frameX = width / 2
      const frameY = height / 2 - this.uiOffsetY
      const { rarities, rarityNames, rarityColorValues } = buildRouletteRarityPool(
        this.rarityColors,
      )

      this.addFrameShell(frameX, frameY)

      const maskGraphics = new Phaser.GameObjects.Graphics(this.scene)
      maskGraphics.fillStyle(0xffffff)
      maskGraphics.fillRect(
        frameX - FRAME_WIDTH / 2,
        frameY - FRAME_HEIGHT / 2,
        FRAME_WIDTH,
        FRAME_HEIGHT,
      )
      maskGraphics.setVisible(false)
      const mask = maskGraphics.createGeometryMask()
      this.slotMachineContainer.add(maskGraphics)

      const slotTexts = this.createSlotTexts(
        frameX,
        frameY,
        rarityNames,
        rarityColorValues,
        mask,
        SLOT_TEXT_SPACING,
      )
      this.animateSlotTexts(
        slotTexts,
        frameY,
        SLOT_TEXT_SPACING,
        rarities,
        SLOT_SPIN_DURATION_MS,
        width,
        height,
      )

      this.addFrameBorder(frameX, frameY)
    }

    if (this.visualDelayMs > 0) {
      this.startDelayCall = this.scene.time.delayedCall(this.visualDelayMs, startVisual)
      return
    }
    startVisual()
  }

  /**
   * 슬롯 스핀을 건너뛰고 즉시 등급확정 연출(강조 + 파티클 + 페이드아웃)으로 넘긴다.
   */
  skip(width: number, height: number): void {
    this.startDelayCall?.remove()
    this.startDelayCall = undefined

    const frameX = width / 2
    const frameY = height / 2 - this.uiOffsetY
    const { rarities } = buildRouletteRarityPool(this.rarityColors)
    const targetRarityIndex = rarities.indexOf(this.rarity)
    const rarityName = AUGMENT_RARITY_NAMES[this.rarity]
    const rarityColor = this.rarityColors[this.rarity]

    if (!this.slotMachineContainer) {
      this.slotMachineContainer = this.scene.add.container(0, 0)
      this.slotMachineContainer.setDepth(SLOT_CONTAINER_DEPTH)
      this.addFrameShell(frameX, frameY)
      this.addFrameBorder(frameX, frameY)
    } else {
      const list = [...(this.slotMachineContainer.list || [])]
      list.forEach((obj) => {
        const tweens = this.scene.tweens.getTweensOf(obj)
        tweens.forEach((t) => t.stop())
      })
      this.slotMachineContainer.removeAll(true)
      this.addFrameShell(frameX, frameY)
      this.addFrameBorder(frameX, frameY)
    }

    const finalText = this.scene.make
      .text({
        x: frameX,
        y: frameY,
        text: rarityName,
        style: {
          fontFamily: SLOT_TEXT_FONT_FAMILY,
          fontSize: SLOT_TEXT_FONT_SIZE,
          color: toHexColor(rarityColor),
          fontStyle: 'bold',
        },
        add: false,
      })
      .setOrigin(0.5)
    this.slotMachineContainer?.add(finalText)

    this.highlightFinalRarity(width, height, finalText, targetRarityIndex, rarities)
  }

  /** 씬 종료/취소 시 남아있는 룰렛 오브젝트를 정리한다. */
  destroy() {
    this.startDelayCall?.remove()
    this.startDelayCall = undefined
    this.slotMachineContainer?.removeAll(true)
    this.slotMachineContainer?.destroy(true)
    this.slotMachineContainer = undefined
  }

  private createSlotTexts(
    frameX: number,
    frameY: number,
    rarityNames: string[],
    rarityColors: number[],
    mask: Phaser.Display.Masks.GeometryMask,
    textSpacing: number,
  ): Phaser.GameObjects.Text[] {
    // 텍스트를 충분히 반복 생성해 "오랫동안 스핀되는" 시각 효과를 만든다.
    const repeatCount = SLOT_REPEAT_COUNT
    const slotTexts: Phaser.GameObjects.Text[] = []

    for (let i = 0; i < repeatCount; i++) {
      for (let j = 0; j < rarityNames.length; j++) {
        const y = frameY - SLOT_INITIAL_Y_OFFSET - (i * rarityNames.length + j) * textSpacing
        const text = this.scene.make
          .text({
            x: frameX,
            y,
            text: rarityNames[j],
            style: {
              fontFamily: SLOT_TEXT_FONT_FAMILY,
              fontSize: SLOT_TEXT_FONT_SIZE,
              color: toHexColor(rarityColors[j]!),
              fontStyle: 'bold',
            },
            add: false,
          })
          .setOrigin(0.5)
          .setMask(mask)

        this.slotMachineContainer?.add(text)
        slotTexts.push(text)
      }
    }

    return slotTexts
  }

  private addFrameShell(frameX: number, frameY: number): void {
    const frameBg = new Phaser.GameObjects.Graphics(this.scene)
    frameBg.fillStyle(0x000000, FRAME_BG_ALPHA)
    frameBg.fillRoundedRect(
      frameX - FRAME_WIDTH / 2,
      frameY - FRAME_HEIGHT / 2,
      FRAME_WIDTH,
      FRAME_HEIGHT,
      FRAME_RADIUS,
    )
    this.slotMachineContainer?.add(frameBg)
  }

  private addFrameBorder(frameX: number, frameY: number): void {
    const frameGraphics = new Phaser.GameObjects.Graphics(this.scene)
    frameGraphics.lineStyle(6, FRAME_BORDER_COLOR, 1)
    frameGraphics.strokeRoundedRect(
      frameX - FRAME_WIDTH / 2,
      frameY - FRAME_HEIGHT / 2,
      FRAME_WIDTH,
      FRAME_HEIGHT,
      FRAME_RADIUS,
    )
    this.slotMachineContainer?.add(frameGraphics)
  }

  private animateSlotTexts(
    slotTexts: Phaser.GameObjects.Text[],
    frameY: number,
    textSpacing: number,
    rarities: AugmentRarity[],
    spinDuration: number,
    width: number,
    height: number,
  ): void {
    // 마지막 사이클에서 목표 등급 인덱스가 가운데에 오도록 최종 y를 계산한다.
    const targetRarityIndex = rarities.indexOf(this.rarity)
    const repeatCount = SLOT_REPEAT_COUNT
    const lastCycleStart = (repeatCount - 1) * rarities.length
    const targetTextIndex = lastCycleStart + targetRarityIndex

    slotTexts.forEach((text, index) => {
      const finalY = frameY + (targetTextIndex - index) * textSpacing

      this.scene.tweens.add({
        targets: text,
        y: finalY,
        duration: spinDuration,
        ease: 'Circ.easeOut',
        onComplete: () => {
          if (index === targetTextIndex) {
            this.highlightFinalRarity(width, height, text, targetRarityIndex, rarities)
          }
        },
      })
    })
  }

  private highlightFinalRarity(
    width: number,
    height: number,
    finalText: Phaser.GameObjects.Text,
    targetRarityIndex: number,
    rarities: AugmentRarity[],
  ) {
    // 최종 당첨 텍스트만 강조하고 나머지는 자연스럽게 뒤로 사라지게 한다.
    const finalColor = this.rarityColors[rarities[targetRarityIndex]]

    const baseSize = 48
    const pulseSize = Math.round(baseSize * 1.3)
    const sizeObj = { size: baseSize }
    this.scene.tweens.add({
      targets: sizeObj,
      size: pulseSize,
      duration: RESULT_PULSE_DURATION_MS,
      ease: 'Back.easeOut',
      yoyo: true,
      onUpdate: () => {
        finalText.setFontSize(sizeObj.size)
      },
      onComplete: () => {
        finalText.setFontSize(baseSize)
        this.moveTextToTitle(width, height, finalText)
      },
    })

    const slotCenterY = height / 2 - this.uiOffsetY
    this.createExplosionParticles(width / 2, slotCenterY, finalColor)
  }

  private createExplosionParticles(centerX: number, centerY: number, color: number) {
    const particleCount = PARTICLE_COUNT
    const distance = PARTICLE_DISTANCE

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const targetX = centerX + Math.cos(angle) * distance
      const targetY = centerY + Math.sin(angle) * distance

      const particle = new Phaser.GameObjects.Arc(
        this.scene,
        centerX,
        centerY,
        PARTICLE_RADIUS,
        0,
        360,
        false,
        color,
        1,
      )
      particle.setBlendMode(Phaser.BlendModes.ADD)
      this.slotMachineContainer?.add(particle)

      this.scene.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0,
        duration: PARTICLE_DURATION_MS,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      })
    }
  }

  private moveTextToTitle(width: number, height: number, finalText: Phaser.GameObjects.Text) {
    if (!this.slotMachineContainer) return

    // 마스크를 해제해 페이드아웃 시 텍스트가 자연스럽게 사라지게 한다.
    finalText.clearMask()
    this.scene.tweens.add({
      targets: finalText,
      alpha: 0,
      duration: RESULT_FADE_DURATION_MS,
      ease: 'Power2',
    })

    this.scene.tweens.add({
      targets: this.slotMachineContainer,
      alpha: 0,
      duration: RESULT_FADE_DURATION_MS,
      ease: 'Power2',
      onComplete: () => {
        this.slotMachineContainer?.removeAll(true)
        this.slotMachineContainer?.destroy(true)
        this.slotMachineContainer = undefined
        this.onComplete(width, height)
      },
    })
  }
}
