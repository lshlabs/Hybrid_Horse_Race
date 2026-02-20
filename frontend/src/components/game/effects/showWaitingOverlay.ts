import Phaser from 'phaser'
import i18next from 'i18next'

/**
 * 공통 대기 오버레이를 생성한다.
 * - 반투명 배경 + 문구 + 점 애니메이션(. .. ...)
 * - 지정 시간 후 자동 제거하고 콜백을 호출한다.
 *
 * 사용 목적:
 * - 씬 전환 직전의 "잠시 대기" UX를 씬별 중복 구현 없이 재사용
 */
export function showWaitingOverlay(
  scene: Phaser.Scene,
  options: {
    messageKey: string
    onComplete: () => void
    durationMs?: number
    depth?: number
  },
) {
  // 옵션 기본값: 대부분의 대기 연출에서 3초/상단 우선 뎁스를 사용한다.
  const { messageKey, onComplete, durationMs = 3000, depth = 10000 } = options
  const { width, height } = scene.scale
  const overlay = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0)

  const bg = new Phaser.GameObjects.Graphics(scene)
  bg.fillStyle(0x000000, 0.4)
  bg.fillRect(0, 0, width, height)
  overlay.add(bg)

  const baseText = (i18next.t(messageKey) as string).replace(/\.{1,3}$/, '')
  let dotStep = 0

  const hint = scene.add
    .text(width / 2, height / 2, `${baseText}.`, {
      fontFamily: 'NeoDunggeunmo',
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
  overlay.add(hint)

  // 문구 끝 점을 주기적으로 갱신해 "진행 중" 상태를 표현한다.
  const dotEvent = scene.time.addEvent({
    delay: 400,
    repeat: -1,
    callback: () => {
      if (!hint.active) return
      dotStep = (dotStep + 1) % 3
      hint.setText(baseText + '.'.repeat(dotStep + 1))
    },
  })

  scene.time.delayedCall(durationMs, () => {
    dotEvent.remove()
    // 콜백을 먼저 호출해 다음 화면(예: 결과창)이 그려진 뒤 오버레이를 제거한다.
    // 제거를 먼저 하면 한 프레임 동안 아래 씬(맵)이 비쳐 깜빡인다.
    onComplete()
    overlay.destroy()
  })
}
