import Phaser from 'phaser'

export interface CountdownManagerConfig {
  scene: Phaser.Scene
  centerX: number
  centerY: number
}

/**
 * 레이스 시작 전 카운트다운(3,2,1,GO)을 그려주는 경량 매니저.
 * 생성/애니메이션/정리까지 내부에서 처리하고, 완료 시 콜백만 호출한다.
 */
export default class CountdownManager {
  private scene: Phaser.Scene
  private centerX: number
  private centerY: number

  constructor(config: CountdownManagerConfig) {
    this.scene = config.scene
    this.centerX = config.centerX
    this.centerY = config.centerY
  }

  /**
   * 카운트다운을 시작하고 끝나면 `onComplete`를 한 번 호출한다.
   */
  start(onComplete: () => void): void {
    const countdownText = this.scene.add
      .text(this.centerX, this.centerY, '3', {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '120px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(3000)
      .setAlpha(0)

    const counts = [3, 2, 1, 'GO!']
    let currentIndex = 0

    // 숫자 1개씩 "등장 -> 잠깐 유지 -> 퇴장" 시퀀스를 재귀적으로 반복한다.
    const showNext = () => {
      if (currentIndex >= counts.length) {
        countdownText.destroy()
        onComplete()
        return
      }

      countdownText.setText(counts[currentIndex].toString())
      countdownText.setAlpha(0).setScale(0.5)

      this.scene.tweens.add({
        targets: countdownText,
        alpha: 1,
        scale: 1.2,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.scene.time.delayedCall(400, () => {
            this.scene.tweens.add({
              targets: countdownText,
              alpha: 0,
              scale: 1.5,
              duration: 300,
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
