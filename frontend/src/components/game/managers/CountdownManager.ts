import Phaser from 'phaser'

export interface CountdownManagerConfig {
  scene: Phaser.Scene
  centerX: number
  centerY: number
}

const COUNTDOWN_STEPS = ['3', '2', '1', 'GO!'] as const
const COUNTDOWN_ENTER_DURATION_MS = 300
const COUNTDOWN_HOLD_DELAY_MS = 400
const COUNTDOWN_EXIT_DURATION_MS = 300
const COUNTDOWN_FONT_FAMILY = 'NeoDunggeunmo'
const COUNTDOWN_FONT_SIZE = '120px'
const COUNTDOWN_DEPTH = 3000
const GO_LABEL = 'GO!'

/**
 * 레이스 시작 전에 3,2,1,GO 카운트다운을 보여주는 간단한 매니저.
 * 텍스트 생성/애니메이션/삭제까지 여기서 처리하고 끝나면 콜백만 호출한다.
 */
export default class CountdownManager {
  private scene: Phaser.Scene
  private readonly centerX: number
  private readonly centerY: number

  constructor(config: CountdownManagerConfig) {
    this.scene = config.scene
    this.centerX = config.centerX
    this.centerY = config.centerY
  }

  /** 카운트다운을 시작하고, 완료 콜백은 한 번만 호출한다. */
  start(onComplete: () => void): void {
    const [initialStep] = COUNTDOWN_STEPS
    const countdownText = this.scene.add
      .text(this.centerX, this.centerY, initialStep, {
        fontFamily: COUNTDOWN_FONT_FAMILY,
        fontSize: COUNTDOWN_FONT_SIZE,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(COUNTDOWN_DEPTH)
      .setAlpha(0)

    let currentIndex = 0
    let didComplete = false

    // 숫자 하나씩 "등장 -> 잠깐 유지 -> 퇴장" 순서로 반복한다.
    const showNext = () => {
      if (currentIndex >= COUNTDOWN_STEPS.length) {
        countdownText.destroy()
        if (!didComplete) {
          didComplete = true
          onComplete()
        }
        return
      }

      countdownText.setText(COUNTDOWN_STEPS[currentIndex])
      countdownText.setAlpha(0).setScale(0.5)

      this.scene.tweens.add({
        targets: countdownText,
        alpha: 1,
        scale: 1.2,
        duration: COUNTDOWN_ENTER_DURATION_MS,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (COUNTDOWN_STEPS[currentIndex] === GO_LABEL && !didComplete) {
            didComplete = true
            onComplete()
          }
          this.scene.time.delayedCall(COUNTDOWN_HOLD_DELAY_MS, () => {
            this.scene.tweens.add({
              targets: countdownText,
              alpha: 0,
              scale: 1.5,
              duration: COUNTDOWN_EXIT_DURATION_MS,
              ease: 'Power2',
              onComplete: () => {
                currentIndex++
                showNext()
              },
            })
          })
        },
      })
    }

    showNext()
  }
}
