import Phaser from 'phaser'
import type { AugmentRarity } from '../../../../../engine/race'
import { AUGMENT_RARITY_NAMES } from '../../../../../engine/race'

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
      this.slotMachineContainer.setDepth(1000)

      const frameX = width / 2
      const frameY = height / 2 - this.uiOffsetY
      const frameWidth = 400
      const frameHeight = 120
      const textSpacing = 90
      const spinDuration = 5000

      const frameBg = new Phaser.GameObjects.Graphics(this.scene)
      frameBg.fillStyle(0x000000, 0.8)
      frameBg.fillRoundedRect(
        frameX - frameWidth / 2,
        frameY - frameHeight / 2,
        frameWidth,
        frameHeight,
        16,
      )
      this.slotMachineContainer.add(frameBg)

      // 실제 뽑기 대상(히든 제외) 등급 목록
      const rarities: AugmentRarity[] = ['common', 'rare', 'epic', 'legendary']
      const rarityNames = rarities.map((r) => AUGMENT_RARITY_NAMES[r])
      const rarityColors = rarities.map((r) => this.rarityColors[r])

      const maskGraphics = new Phaser.GameObjects.Graphics(this.scene)
      maskGraphics.fillStyle(0xffffff)
      maskGraphics.fillRect(
        frameX - frameWidth / 2,
        frameY - frameHeight / 2,
        frameWidth,
        frameHeight,
      )
      maskGraphics.setVisible(false)
      const mask = maskGraphics.createGeometryMask()
      this.slotMachineContainer.add(maskGraphics)

      const slotTexts = this.createSlotTexts(
        frameX,
        frameY,
        rarityNames,
        rarityColors,
        mask,
        textSpacing,
      )
      this.animateSlotTexts(slotTexts, frameY, textSpacing, rarities, spinDuration, width, height)

      const frameGraphics = new Phaser.GameObjects.Graphics(this.scene)
      frameGraphics.lineStyle(6, 0xffd700, 1)
      frameGraphics.strokeRoundedRect(
        frameX - frameWidth / 2,
        frameY - frameHeight / 2,
        frameWidth,
        frameHeight,
        16,
      )
      this.slotMachineContainer.add(frameGraphics)
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
    const frameWidth = 400
    const frameHeight = 120
    const rarities: AugmentRarity[] = ['common', 'rare', 'epic', 'legendary']
    const targetRarityIndex = rarities.indexOf(this.rarity)
    const rarityName = AUGMENT_RARITY_NAMES[this.rarity]
    const rarityColor = this.rarityColors[this.rarity]

    if (!this.slotMachineContainer) {
      this.slotMachineContainer = this.scene.add.container(0, 0)
      this.slotMachineContainer.setDepth(1000)
      const frameBg = new Phaser.GameObjects.Graphics(this.scene)
      frameBg.fillStyle(0x000000, 0.8)
      frameBg.fillRoundedRect(
        frameX - frameWidth / 2,
        frameY - frameHeight / 2,
        frameWidth,
        frameHeight,
        16,
      )
      this.slotMachineContainer.add(frameBg)
      const frameGraphics = new Phaser.GameObjects.Graphics(this.scene)
      frameGraphics.lineStyle(6, 0xffd700, 1)
      frameGraphics.strokeRoundedRect(
        frameX - frameWidth / 2,
        frameY - frameHeight / 2,
        frameWidth,
        frameHeight,
        16,
      )
      this.slotMachineContainer.add(frameGraphics)
    } else {
      const list = [...(this.slotMachineContainer.list || [])]
      list.forEach((obj) => {
        const tweens = this.scene.tweens.getTweensOf(obj)
        tweens.forEach((t) => t.stop())
      })
      this.slotMachineContainer.removeAll(true)
      const frameBg = new Phaser.GameObjects.Graphics(this.scene)
      frameBg.fillStyle(0x000000, 0.8)
      frameBg.fillRoundedRect(
        frameX - frameWidth / 2,
        frameY - frameHeight / 2,
        frameWidth,
        frameHeight,
        16,
      )
      this.slotMachineContainer.add(frameBg)
      const frameGraphics = new Phaser.GameObjects.Graphics(this.scene)
      frameGraphics.lineStyle(6, 0xffd700, 1)
      frameGraphics.strokeRoundedRect(
        frameX - frameWidth / 2,
        frameY - frameHeight / 2,
        frameWidth,
        frameHeight,
        16,
      )
      this.slotMachineContainer.add(frameGraphics)
    }

    const finalText = this.scene.make
      .text({
        x: frameX,
        y: frameY,
        text: rarityName,
        style: {
          fontFamily: 'NeoDunggeunmo',
          fontSize: '48px',
          color: `#${rarityColor.toString(16).padStart(6, '0')}`,
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
    const repeatCount = 20
    const slotTexts: Phaser.GameObjects.Text[] = []

    for (let i = 0; i < repeatCount; i++) {
      for (let j = 0; j < rarityNames.length; j++) {
        const y = frameY - 500 - (i * rarityNames.length + j) * textSpacing
        const text = this.scene.make
          .text({
            x: frameX,
            y,
            text: rarityNames[j],
            style: {
              fontFamily: 'NeoDunggeunmo',
              fontSize: '48px',
              color: `#${rarityColors[j].toString(16).padStart(6, '0')}`,
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
    const repeatCount = 20
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
      duration: 300,
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
    const particleCount = 30
    const distance = 200

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount
      const targetX = centerX + Math.cos(angle) * distance
      const targetY = centerY + Math.sin(angle) * distance

      const particle = new Phaser.GameObjects.Arc(
        this.scene,
        centerX,
        centerY,
        8,
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
        duration: 800,
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
      duration: 800,
      ease: 'Power2',
    })

    this.scene.tweens.add({
      targets: this.slotMachineContainer,
      alpha: 0,
      duration: 800,
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
