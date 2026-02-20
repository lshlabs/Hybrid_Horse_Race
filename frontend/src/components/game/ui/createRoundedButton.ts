import Phaser from 'phaser'

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
    textColor = '#ffffff',
    onClick,
    fontSize = '18px',
    scaleOnHover = false,
  } = options

  const container = scene.add.container(x, y)
  const background = scene.add.graphics()
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: 'NeoDunggeunmo',
      fontSize,
      color: textColor,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
  const hitArea = scene.add
    .rectangle(0, 0, width, height, 0x000000, 0)
    .setInteractive({ useHandCursor: true })

  // 상태(hover/disabled)에 따라 버튼 배경색만 바꿀 때 사용한다.
  const redraw = (fillColor: number, alpha = 1) => {
    background.clear()
    background.fillStyle(fillColor, alpha)
    background.fillRoundedRect(-width / 2, -height / 2, width, height, radius)
  }

  redraw(color)
  hitArea.on('pointerover', () => {
    redraw(hoverColor)
    if (scaleOnHover) {
      scene.tweens.add({
        targets: container,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
      })
    }
  })
  hitArea.on('pointerout', () => {
    redraw(color)
    if (scaleOnHover) {
      scene.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      })
    }
  })
  hitArea.on('pointerdown', onClick)

  container.add(background)
  container.add(text)
  container.add(hitArea)

  // 입력 가능 상태와 시각적 상태(alpha)를 함께 전환한다.
  const setEnabled = (enabled: boolean) => {
    if (enabled) {
      hitArea.setInteractive({ useHandCursor: true })
      container.setAlpha(1)
    } else {
      hitArea.disableInteractive()
      container.setAlpha(0.5)
    }
  }

  // 라벨만 갱신해 버튼 재생성 비용을 피한다.
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
