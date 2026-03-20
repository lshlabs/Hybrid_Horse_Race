import Phaser from 'phaser'

const FIREWORK_COLORS = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff] as const
const FIREWORK_POSITIONS = [
  { xRatio: 0.2, yRatio: 0.3 },
  { xRatio: 0.5, yRatio: 0.2 },
  { xRatio: 0.8, yRatio: 0.3 },
] as const
const PARTICLE_COUNT = 20
const FIRE_DELAY_STEP_MS = 300
const BASE_SPEED = 150
const SPEED_RANGE = 100
const PARTICLE_RADIUS = 4
const TWEEN_BASE_DURATION_MS = 1000
const TWEEN_DURATION_VARIANCE_MS = 500
const PARTICLE_DISTANCE_FACTOR = 0.5
const PARTICLE_DEPTH = 1999

function randomInRange(base: number, range: number): number {
  return base + Math.random() * range
}

function randomColor(): number {
  return FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)]!
}

export function createFireworks(scene: Phaser.Scene): void {
  const width = scene.scale.width
  const height = scene.scale.height

  FIREWORK_POSITIONS.forEach(({ xRatio, yRatio }, index) => {
    const x = width * xRatio
    const y = height * yRatio

    scene.time.delayedCall(index * FIRE_DELAY_STEP_MS, () => {
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = (Math.PI * 2 * i) / PARTICLE_COUNT
        const speed = randomInRange(BASE_SPEED, SPEED_RANGE)
        const vx = Math.cos(angle) * speed
        const vy = Math.sin(angle) * speed

        const particle = scene.add.circle(x, y, PARTICLE_RADIUS, 0xffffff, 1)
        particle.setDepth(PARTICLE_DEPTH)
        particle.setFillStyle(randomColor())

        scene.tweens.add({
          targets: particle,
          x: x + vx * PARTICLE_DISTANCE_FACTOR,
          y: y + vy * PARTICLE_DISTANCE_FACTOR,
          alpha: 0,
          scale: 0,
          duration: randomInRange(TWEEN_BASE_DURATION_MS, TWEEN_DURATION_VARIANCE_MS),
          ease: 'Power2',
          onComplete: () => particle.destroy(),
        })
      }
    })
  })
}
