import Phaser from 'phaser'
import type { Horse } from '../../../engine/race'
import { positionToProgress } from '../../../engine/race/positionUtils'

/**
 * 미니맵 진행바 관리
 * - 플레이어 말의 진행률 표시
 * - 말 출발 시 fade in
 * - 트랙 길이(m)는 getTrackLengthM getter로만 조회 (TileMapManager 단일 소스)
 */
export default class ProgressBarManager {
  private scene: Phaser.Scene
  private gameAreaHeight: number // px
  private getTrackLengthM: () => number // m
  private playerHorseIndex: number

  private container?: Phaser.GameObjects.Container
  private fill?: Phaser.GameObjects.Graphics
  private indicator?: Phaser.GameObjects.Container
  private isVisible = false

  private static readonly BAR_HEIGHT = 12
  private static readonly BAR_Y_RATIO = 0.1
  private static readonly BAR_WIDTH_MARGIN = 150

  constructor(config: {
    scene: Phaser.Scene
    gameAreaHeight: number
    getTrackLengthM: () => number
    playerHorseIndex: number
  }) {
    this.scene = config.scene
    this.gameAreaHeight = config.gameAreaHeight
    this.getTrackLengthM = config.getTrackLengthM
    this.playerHorseIndex = config.playerHorseIndex
  }

  create() {
    const gameWidth = this.scene.scale.width // px
    const barY = this.gameAreaHeight * ProgressBarManager.BAR_Y_RATIO // px
    const barWidth = (gameWidth - ProgressBarManager.BAR_WIDTH_MARGIN) / 2 // px
    const barX = gameWidth / 2 // px

    this.container = this.scene.add.container(0, 0).setDepth(25).setAlpha(0).setScrollFactor(0)

    // 배경
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x1a1a2e, 0.8)
    bg.fillRoundedRect(
      barX - barWidth / 2,
      barY - ProgressBarManager.BAR_HEIGHT / 2,
      barWidth,
      ProgressBarManager.BAR_HEIGHT,
      6,
    )
    bg.lineStyle(2, 0x6366f1, 0.5)
    bg.strokeRoundedRect(
      barX - barWidth / 2,
      barY - ProgressBarManager.BAR_HEIGHT / 2,
      barWidth,
      ProgressBarManager.BAR_HEIGHT,
      6,
    )
    this.container.add(bg)

    // 채우기
    this.fill = this.scene.add.graphics()
    this.container.add(this.fill)

    // 도착 아이콘
    const finishIcon = this.createFinishIcon(barX + barWidth / 2, barY)
    this.container.add(finishIcon)

    // 플레이어 인디케이터
    this.indicator = this.createPlayerIcon(barX - barWidth / 2, barY)
    this.container.add(this.indicator)
  }

  private createFinishIcon(x: number, y: number) {
    const container = this.scene.add.container(x, y)
    const flag = this.scene.add
      .text(0, 0, '🏁', { fontFamily: 'NeoDunggeunmo', fontSize: '20px' })
      .setOrigin(0.5)
    container.add(flag)
    return container
  }

  private createPlayerIcon(x: number, y: number) {
    const container = this.scene.add.container(x, y)
    const glow = this.scene.add.circle(0, 0, 12, 0xffd700, 0.3)
    container.add(glow)

    const indicator = this.scene.add.graphics()
    indicator.fillStyle(0xffd700, 1)
    indicator.fillCircle(0, 0, 6)
    indicator.lineStyle(2, 0xffffff, 1)
    indicator.strokeCircle(0, 0, 6)
    container.add(indicator)

    this.scene.tweens.add({
      targets: glow,
      scale: 1.3,
      alpha: 0.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    return container
  }

  show() {
    if (this.isVisible || !this.container) return
    this.isVisible = true
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 600,
      ease: 'Power2',
    })
  }

  hide() {
    if (!this.container) return
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
    })
  }

  /**
   * 슬로모/줌인 등 연출 구간에서 진행바 즉시 표시/숨김.
   * (show/hide는 페이드 트윈, setVisible은 즉시 on/off)
   */
  setVisible(visible: boolean) {
    this.container?.setVisible(visible)
  }

  /**
   * 진행바를 페이드인으로 다시 표시 (슬로모 복귀 후 등).
   */
  setVisibleWithFadeIn(durationMs = 320) {
    if (!this.container) return
    this.container.setVisible(true).setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: durationMs,
      ease: 'Power2.Out',
    })
  }

  /**
   * 진행바를 페이드아웃 후 숨김 (슬로모 시작 시 등).
   */
  setVisibleWithFadeOut(durationMs = 280) {
    if (!this.container || !this.container.visible) return
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: durationMs,
      ease: 'Power2.In',
      onComplete: () => {
        this.container?.setVisible(false).setAlpha(1)
      },
    })
  }

  setPlayerHorseIndex(playerHorseIndex: number) {
    this.playerHorseIndex = playerHorseIndex
  }

  update(simHorses: Horse[]) {
    if (!this.indicator || !this.fill) return

    const playerHorse = simHorses[this.playerHorseIndex]
    if (!playerHorse) return

    const trackLengthM = this.getTrackLengthM() // m
    const progress = positionToProgress(playerHorse.position, trackLengthM, {
      capAtOne: true,
    })

    const gameWidth = this.scene.scale.width
    const barWidth = (gameWidth - ProgressBarManager.BAR_WIDTH_MARGIN) / 2
    const barX = gameWidth / 2
    const barY = this.gameAreaHeight * ProgressBarManager.BAR_Y_RATIO
    const startX = barX - barWidth / 2
    const indicatorX = startX + progress * barWidth

    this.fill.clear()
    if (progress > 0) {
      const fillWidth = Math.min(progress * barWidth, barWidth - 4)
      const fillColor = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x6366f1),
        Phaser.Display.Color.ValueToColor(0xffd700),
        100,
        progress * 100,
      )
      const colorValue = Phaser.Display.Color.GetColor(fillColor.r, fillColor.g, fillColor.b)
      this.fill.fillStyle(colorValue, 0.8)
      this.fill.fillRoundedRect(
        barX - barWidth / 2 + 2,
        barY - ProgressBarManager.BAR_HEIGHT / 2 + 2,
        fillWidth,
        ProgressBarManager.BAR_HEIGHT - 4,
        4,
      )
    }

    this.indicator.setX(indicatorX)
  }

  reset() {
    this.isVisible = false
    if (this.container) {
      this.container.setAlpha(0)
    }
  }
}
