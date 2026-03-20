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
  private static readonly BAR_HEIGHT = 12
  private static readonly BAR_Y_RATIO = 0.1
  private static readonly BAR_WIDTH_MARGIN = 150
  private static readonly BAR_BORDER_RADIUS = 6
  private static readonly BAR_INNER_PADDING = 2
  private static readonly BAR_INNER_RADIUS = 4
  private static readonly SHOW_DURATION_MS = 600
  private static readonly HIDE_DURATION_MS = 400
  private static readonly DEFAULT_FADE_IN_DURATION_MS = 320
  private static readonly DEFAULT_FADE_OUT_DURATION_MS = 280
  private static readonly INDICATOR_GLOW_RADIUS = 12
  private static readonly INDICATOR_RADIUS = 6
  private static readonly GLOW_PULSE_DURATION_MS = 1000
  private static readonly TRACK_COLOR_START = 0x6366f1
  private static readonly TRACK_COLOR_END = 0xffd700
  private static readonly CONTAINER_DEPTH = 25
  private static readonly FINISH_ICON_FONT_FAMILY = 'NeoDunggeunmo'
  private static readonly FINISH_ICON_FONT_SIZE = '20px'

  private scene: Phaser.Scene
  private gameAreaHeight: number // px
  private getTrackLengthM: () => number // m
  private playerHorseIndex: number

  private container?: Phaser.GameObjects.Container
  private fill?: Phaser.GameObjects.Graphics
  private indicator?: Phaser.GameObjects.Container
  private isVisible = false

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

  private getBarLayout() {
    const gameWidth = this.scene.scale.width
    const barY = this.gameAreaHeight * ProgressBarManager.BAR_Y_RATIO
    const barWidth = (gameWidth - ProgressBarManager.BAR_WIDTH_MARGIN) / 2
    const barX = gameWidth / 2
    return { gameWidth, barX, barY, barWidth, startX: barX - barWidth / 2 }
  }

  private getProgressFillColor(progress: number): number {
    const fillColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(ProgressBarManager.TRACK_COLOR_START),
      Phaser.Display.Color.ValueToColor(ProgressBarManager.TRACK_COLOR_END),
      100,
      progress * 100,
    )
    return Phaser.Display.Color.GetColor(fillColor.r, fillColor.g, fillColor.b)
  }

  create() {
    const { barX, barY, barWidth, startX } = this.getBarLayout()

    this.container = this.scene.add
      .container(0, 0)
      .setDepth(ProgressBarManager.CONTAINER_DEPTH)
      .setAlpha(0)
      .setScrollFactor(0)

    // 배경
    const bg = this.scene.add.graphics()
    bg.fillStyle(0x1a1a2e, 0.8)
    bg.fillRoundedRect(
      barX - barWidth / 2,
      barY - ProgressBarManager.BAR_HEIGHT / 2,
      barWidth,
      ProgressBarManager.BAR_HEIGHT,
      ProgressBarManager.BAR_BORDER_RADIUS,
    )
    bg.lineStyle(2, 0x6366f1, 0.5)
    bg.strokeRoundedRect(
      barX - barWidth / 2,
      barY - ProgressBarManager.BAR_HEIGHT / 2,
      barWidth,
      ProgressBarManager.BAR_HEIGHT,
      ProgressBarManager.BAR_BORDER_RADIUS,
    )
    this.container.add(bg)

    // 채우기
    this.fill = this.scene.add.graphics()
    this.container.add(this.fill)

    // 도착 아이콘
    const finishIcon = this.createFinishIcon(barX + barWidth / 2, barY)
    this.container.add(finishIcon)

    // 플레이어 인디케이터
    this.indicator = this.createPlayerIcon(startX, barY)
    this.container.add(this.indicator)
  }

  private createFinishIcon(x: number, y: number) {
    const container = this.scene.add.container(x, y)
    const flag = this.scene.add
      .text(0, 0, '🏁', {
        fontFamily: ProgressBarManager.FINISH_ICON_FONT_FAMILY,
        fontSize: ProgressBarManager.FINISH_ICON_FONT_SIZE,
      })
      .setOrigin(0.5)
    container.add(flag)
    return container
  }

  private createPlayerIcon(x: number, y: number) {
    const container = this.scene.add.container(x, y)
    const glow = this.scene.add.circle(
      0,
      0,
      ProgressBarManager.INDICATOR_GLOW_RADIUS,
      0xffd700,
      0.3,
    )
    container.add(glow)

    const indicator = this.scene.add.graphics()
    indicator.fillStyle(0xffd700, 1)
    indicator.fillCircle(0, 0, ProgressBarManager.INDICATOR_RADIUS)
    indicator.lineStyle(2, 0xffffff, 1)
    indicator.strokeCircle(0, 0, ProgressBarManager.INDICATOR_RADIUS)
    container.add(indicator)

    this.scene.tweens.add({
      targets: glow,
      scale: 1.3,
      alpha: 0.1,
      duration: ProgressBarManager.GLOW_PULSE_DURATION_MS,
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
      duration: ProgressBarManager.SHOW_DURATION_MS,
      ease: 'Power2',
    })
  }

  hide() {
    if (!this.container) return
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: ProgressBarManager.HIDE_DURATION_MS,
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
  setVisibleWithFadeIn(durationMs = ProgressBarManager.DEFAULT_FADE_IN_DURATION_MS) {
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
  setVisibleWithFadeOut(durationMs = ProgressBarManager.DEFAULT_FADE_OUT_DURATION_MS) {
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

    const { barX, barY, barWidth, startX } = this.getBarLayout()
    const indicatorX = startX + progress * barWidth

    this.fill.clear()
    if (progress > 0) {
      const fillWidth = Math.min(
        progress * barWidth,
        barWidth - ProgressBarManager.BAR_INNER_PADDING * 2,
      )
      this.fill.fillStyle(this.getProgressFillColor(progress), 0.8)
      this.fill.fillRoundedRect(
        barX - barWidth / 2 + ProgressBarManager.BAR_INNER_PADDING,
        barY - ProgressBarManager.BAR_HEIGHT / 2 + ProgressBarManager.BAR_INNER_PADDING,
        fillWidth,
        ProgressBarManager.BAR_HEIGHT - ProgressBarManager.BAR_INNER_PADDING * 2,
        ProgressBarManager.BAR_INNER_RADIUS,
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
