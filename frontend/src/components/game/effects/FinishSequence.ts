import Phaser from 'phaser'

type FinishSequenceOptions = {
  enableSlowmo?: boolean
  enableCameraZoom?: boolean
  slowmoScale?: number
  slowmoRestoreMs?: number
  zoomFactor?: number
  zoomInMs?: number
  zoomOutMs?: number
  shakeMs?: number
  shakeIntensity?: number
  confettiBursts?: number
  confettiCount?: number
  /** FINISH 배너/파티클 연출이 끝난 직후 호출 */
  onComplete?: () => void
}

const CONFETTI_TEXTURE_KEY = 'confetti-dot'

/** 컨페티 파티클용 점 텍스처를 한 번만 만든다. */
function ensureConfettiTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(CONFETTI_TEXTURE_KEY)) return

  const size = 6
  const gfx = scene.add.graphics()
  gfx.fillStyle(0xffffff, 1)
  gfx.fillCircle(size / 2, size / 2, size / 2)
  gfx.generateTexture(CONFETTI_TEXTURE_KEY, size, size)
  gfx.destroy()
}

/**
 * 결승 순간 연출(슬로모/카메라/배너/컨페티)을 순서대로 실행한다.
 * 실제 시뮬레이션 속도는 여기서 직접 바꾸지 않고 RaceScene 이벤트로 요청만 보낸다.
 */
export function playFinishSequence(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.GameObject | undefined,
  opts: FinishSequenceOptions = {},
) {
  const slowmoScale = opts.slowmoScale ?? 0.2
  const enableSlowmo = opts.enableSlowmo ?? true
  const enableCameraZoom = opts.enableCameraZoom ?? true
  const slowmoRestoreMs = opts.slowmoRestoreMs ?? 800
  const zoomFactor = opts.zoomFactor ?? 1.35
  const zoomInMs = opts.zoomInMs ?? 900
  const zoomOutMs = opts.zoomOutMs ?? 450
  const shakeMs = opts.shakeMs ?? 140
  const shakeIntensity = opts.shakeIntensity ?? 0.002
  const confettiBursts = opts.confettiBursts ?? 3
  const confettiCount = opts.confettiCount ?? 70
  const onComplete = opts.onComplete

  const cam = scene.cameras.main
  const baseZoom = cam.zoom

  if (enableSlowmo) {
    // 슬로모는 화면 렌더 자체가 아니라 시뮬레이션 재생 속도만 바꾸도록 이벤트로 요청한다.
    scene.events.emit('finish-sequence-slowmo', slowmoScale, slowmoRestoreMs)
    scene.events.once('finish-sequence-slowmo-restore', () => {
      scene.events.emit('finish-sequence-slowmo-end')
    })
  }

  let zoomOutDone = !enableCameraZoom
  let slowmoDone = !enableSlowmo
  let postEffectsRun = false

  const runPostEffects = () => {
    if (postEffectsRun || !zoomOutDone || !slowmoDone) return
    postEffectsRun = true

    // 1) 컨페티
    ensureConfettiTexture(scene)
    const particles = scene.add.particles(0, 0, CONFETTI_TEXTURE_KEY, {
      speed: { min: 200, max: 420 },
      angle: { min: 220, max: 320 },
      gravityY: 700,
      lifespan: { min: 900, max: 1400 },
      scale: { start: 1, end: 0 },
      quantity: 0,
      emitting: false,
    })
    particles.setDepth(2000)
    particles.setScrollFactor(0)

    const burstXs = [0, 1, -1].map((offset) => scene.scale.width / 2 + offset * 120)
    const burstY = scene.scale.height * 0.25

    for (let i = 0; i < confettiBursts; i++) {
      scene.time.delayedCall(i * 220, () => {
        const x = burstXs[i % burstXs.length]
        particles.emitParticleAt(x, burstY, confettiCount)
      })
    }

    scene.time.delayedCall(1800, () => {
      particles.destroy()
    })

    // 2) FINISH 배너
    const banner = scene.add
      .text(scene.scale.width / 2, scene.scale.height * 0.32, 'FINISH!', {
        fontFamily: 'NeoDunggeunmo',
        fontSize: '64px',
        color: '#fff7b1',
        stroke: '#1a0f00',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3000)
      .setAlpha(0)
      .setScale(0.2)

    scene.tweens.add({
      targets: banner,
      alpha: 1,
      scale: 1.2,
      duration: 260,
      ease: 'Back.Out',
      onComplete: () => {
        scene.tweens.add({
          targets: banner,
          scale: 1,
          duration: 160,
          ease: 'Sine.Out',
        })
        scene.tweens.add({
          targets: banner,
          alpha: 0,
          duration: 400,
          delay: 520,
          ease: 'Sine.In',
          onComplete: () => {
            banner.destroy()
            onComplete?.()
          },
        })
      },
    })
  }

  // 카메라 연출: 줌인 -> 결승 통과 이벤트를 받으면 줌아웃
  if (enableCameraZoom) {
    if (target && (target as Phaser.GameObjects.Sprite).x !== undefined) {
      cam.pan((target as Phaser.GameObjects.Sprite).x, (target as Phaser.GameObjects.Sprite).y, 200)
    }
    cam.shake(shakeMs, shakeIntensity)

    let zoomOutStarted = false
    const startZoomOut = () => {
      if (zoomOutStarted) return
      zoomOutStarted = true

      scene.tweens.add({
        targets: cam,
        zoom: baseZoom,
        duration: zoomOutMs,
        ease: 'Sine.InOut',
        onComplete: () => {
          zoomOutDone = true
          runPostEffects()
        },
      })
    }

    const zoomInTween = scene.tweens.add({
      targets: cam,
      zoom: baseZoom * zoomFactor,
      duration: zoomInMs,
      ease: 'Sine.Out',
    })

    scene.events.once('finish-sequence-horse-crossed', () => {
      zoomInTween.stop()
      startZoomOut()
    })
  }

  if (enableSlowmo) {
    const onSlowmoEnd = () => {
      slowmoDone = true
      runPostEffects()
    }

    scene.events.once('finish-sequence-slowmo-end', onSlowmoEnd)
  }

  runPostEffects()
}
