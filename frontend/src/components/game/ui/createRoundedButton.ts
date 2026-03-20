import Phaser from 'phaser'

const DEFAULT_TEXT_COLOR = '#ffffff'
const DEFAULT_FONT_SIZE = '18px'
const HOVER_SCALE = 1.05
const DEFAULT_SCALE = 1
const SCALE_TWEEN_DURATION_MS = 100
const DISABLED_ALPHA = 0.5
const BUTTON_FONT_FAMILY = 'NeoDunggeunmo'
const BUTTON_EVENT_POINTER_OVER = 'pointerover'
const BUTTON_EVENT_POINTER_OUT = 'pointerout'
const BUTTON_EVENT_POINTER_DOWN = 'pointerdown'

/**
 * 라운드 버튼 생성 후 외부에서 제어할 수 있는 핸들.
 * - `setEnabled`: 클릭 가능 여부/투명도 동시 제어
 * - `setLabel`: 텍스트만 교체
 * - `redraw`: 배경색 재렌더
 */
export type RoundedButtonController = {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Graphics
  text: Phaser.GameObjects.Text
  hitArea: Phaser.GameObjects.Rectangle
  setEnabled: (enabled: boolean) => void
  setLabel: (label: string) => void
  redraw: (color: number) => void
}

/**
 * 공통 라운드 버튼 팩토리.
 * 씬별로 반복되던 버튼 생성/hover/활성화 로직을 한 곳에 모아 재사용한다.
 */
export function createRoundedButton(
  scene: Phaser.Scene,
  options: {
    x: number
    y: number
    width: number
    height: number
    radius: number
    color: number
    hoverColor?: number
    label: string
    textColor?: string
    onClick: () => void
    fontSize?: string
    scaleOnHover?: boolean
  },
): RoundedButtonController {
  const {
    x,
    y,
    width,
    height,
    radius,
    color,
    hoverColor = color,
    label,
    textColor = DEFAULT_TEXT_COLOR,
    onClick,
    fontSize = DEFAULT_FONT_SIZE,
    scaleOnHover = false,
  } = options

  const container = scene.add.container(x, y)
  const background = scene.add.graphics()
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: BUTTON_FONT_FAMILY,
      fontSize,
      color: textColor,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
  const hitArea = scene.add
    .rectangle(0, 0, width, height, 0x000000, 0)
    .setInteractive({ useHandCursor: true })

  const redraw = (fillColor: number, alpha = 1) => {
    background.clear()
    background.fillStyle(fillColor, alpha)
    background.fillRoundedRect(-width / 2, -height / 2, width, height, radius)
  }

  const tweenScale = (scale: number) => {
    scene.tweens.add({
      targets: container,
      scaleX: scale,
      scaleY: scale,
      duration: SCALE_TWEEN_DURATION_MS,
    })
  }

  redraw(color)
  hitArea.on(BUTTON_EVENT_POINTER_OVER, () => {
    redraw(hoverColor)
    if (scaleOnHover) {
      tweenScale(HOVER_SCALE)
    }
  })
  hitArea.on(BUTTON_EVENT_POINTER_OUT, () => {
    redraw(color)
    if (scaleOnHover) {
      tweenScale(DEFAULT_SCALE)
    }
  })
  hitArea.on(BUTTON_EVENT_POINTER_DOWN, onClick)

  container.add(background)
  container.add(text)
  container.add(hitArea)

  const setEnabled = (enabled: boolean) => {
    if (enabled) {
      hitArea.setInteractive({ useHandCursor: true })
      container.setAlpha(1)
    } else {
      hitArea.disableInteractive()
      container.setAlpha(DISABLED_ALPHA)
    }
  }

  const setLabel = (nextLabel: string) => {
    text.setText(nextLabel)
  }

  return {
    container,
    background,
    text,
    hitArea,
    setEnabled,
    setLabel,
    redraw: (fillColor: number) => redraw(fillColor),
  }
}
