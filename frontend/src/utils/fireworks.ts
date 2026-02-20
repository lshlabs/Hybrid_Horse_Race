import Phaser from 'phaser'

/**
 * 레이스 결과 등에서 사용하는 단순 폭죽 파티클 효과
 */
export function createFireworks(scene: Phaser.Scene): void {
  const width = scene.scale.width
  const height = scene.scale.height

  const positions = [
    { x: width * 0.2, y: height * 0.3 },
    { x: width * 0.5, y: height * 0.2 },
    { x: width * 0.8, y: height * 0.3 },
  ]

  const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]

  positions.forEach((pos, index) => {
    scene.time.delayedCall(index * 300, () => {
      for (let i = 0; i < 20; i++) {
        const angle = (Math.PI * 2 * i) / 20
        const speed = 150 + Math.random() * 100
        const vx = Math.cos(angle) * speed
        const vy = Math.sin(angle) * speed

        const particle = scene.add.circle(pos.x, pos.y, 4, 0xffffff, 1)
        particle.setDepth(1999)
        particle.setFillStyle(colors[Math.floor(Math.random() * colors.length)]!)

        scene.tweens.add({
          targets: particle,
          x: pos.x + vx * 0.5,
          y: pos.y + vy * 0.5,
          alpha: 0,
          scale: 0,
          duration: 1000 + Math.random() * 500,
          ease: 'Power2',
          onComplete: () => particle.destroy(),
        })
      }
    })
  })
}
