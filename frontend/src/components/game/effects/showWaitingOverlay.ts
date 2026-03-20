import Phaser from 'phaser'
import i18next from 'i18next'

const DEFAULT_OVERLAY_DURATION_MS = 3000
const DEFAULT_OVERLAY_DEPTH = 10000
const OVERLAY_ALPHA = 0.4
const DOT_EVENT_INTERVAL_MS = 400
const DOT_COUNT = 3
const DEFAULT_FONT_SIZE = '28px'
const WAITING_OVERLAY_FONT_FAMILY = 'NeoDunggeunmo'
const WAITING_OVERLAY_TEXT_COLOR = '#ffffff'
const WAITING_OVERLAY_FONT_STYLE = 'bold'

function getBaseMessage(messageKey: string): string {
  return (i18next.t(messageKey) as string).replace(/\.{1,3}$/, '')
}

function buildAnimatedMessage(baseMessage: string, dotStep: number): string {
  return baseMessage + '.'.repeat(dotStep + 1)
}

export function showWaitingOverlay(
  scene: Phaser.Scene,
  options: {
    messageKey: string
    onComplete: () => void
    durationMs?: number | null
    depth?: number
  },
) {
  const {
    messageKey,
    onComplete,
    durationMs = DEFAULT_OVERLAY_DURATION_MS,
    depth = DEFAULT_OVERLAY_DEPTH,
  } = options
  const { width, height } = scene.scale
  const overlay = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0)

  const bg = new Phaser.GameObjects.Graphics(scene)
  bg.fillStyle(0x000000, OVERLAY_ALPHA)
  bg.fillRect(0, 0, width, height)
  overlay.add(bg)

  const baseText = getBaseMessage(messageKey)
  let dotStep = 0

  const hint = scene.add
    .text(width / 2, height / 2, buildAnimatedMessage(baseText, dotStep), {
      fontFamily: WAITING_OVERLAY_FONT_FAMILY,
      fontSize: DEFAULT_FONT_SIZE,
      color: WAITING_OVERLAY_TEXT_COLOR,
      fontStyle: WAITING_OVERLAY_FONT_STYLE,
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
  overlay.add(hint)

  const dotEvent = scene.time.addEvent({
    delay: DOT_EVENT_INTERVAL_MS,
    repeat: -1,
    callback: () => {
      if (!hint.active) return
      dotStep = (dotStep + 1) % DOT_COUNT
      hint.setText(buildAnimatedMessage(baseText, dotStep))
    },
  })

  let completed = false
  const close = (shouldComplete: boolean) => {
    if (completed) return
    completed = true
    dotEvent.remove()
    if (shouldComplete) onComplete()
    overlay.destroy()
  }

  if (typeof durationMs === 'number') {
    scene.time.delayedCall(durationMs, () => close(true))
  }

  return {
    close,
  }
}
