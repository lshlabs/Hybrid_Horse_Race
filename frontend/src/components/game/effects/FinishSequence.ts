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
const DEFAULT_SLOWMO_SCALE = 0.2
const DEFAULT_SLOWMO_RESTORE_MS = 800
const DEFAULT_ZOOM_FACTOR = 1.35
const DEFAULT_ZOOM_IN_MS = 900
const DEFAULT_ZOOM_OUT_MS = 450
const DEFAULT_SHAKE_MS = 140
const DEFAULT_SHAKE_INTENSITY = 0.002
const DEFAULT_CONFETTI_BURSTS = 3
const DEFAULT_CONFETTI_COUNT = 70
const CONFETTI_BURST_INTERVAL_MS = 220
const CONFETTI_CLEANUP_DELAY_MS = 1800
const FINISH_BANNER_FADE_OUT_DELAY_MS = 520
const TARGET_PAN_DURATION_MS = 200
const FINISH_EVENT_SLOWMO = 'finish-sequence-slowmo'
const FINISH_EVENT_SLOWMO_RESTORE = 'finish-sequence-slowmo-restore'
const FINISH_EVENT_SLOWMO_END = 'finish-sequence-slowmo-end'
const FINISH_EVENT_HORSE_CROSSED = 'finish-sequence-horse-crossed'
const FINISH_BANNER_TEXT = 'FINISH!'
const FINISH_BANNER_FONT_FAMILY = 'NeoDunggeunmo'
const FINISH_BANNER_FONT_SIZE = '64px'
const FINISH_BANNER_POP_DURATION_MS = 260
const FINISH_BANNER_SETTLE_DURATION_MS = 160
const FINISH_BANNER_FADE_DURATION_MS = 400

function getFinishSequenceSettings(opts: FinishSequenceOptions) {
  return {
    enableSlowmo: opts.enableSlowmo ?? true,
    enableCameraZoom: opts.enableCameraZoom ?? true,
    slowmoScale: opts.slowmoScale ?? DEFAULT_SLOWMO_SCALE,
    slowmoRestoreMs: opts.slowmoRestoreMs ?? DEFAULT_SLOWMO_RESTORE_MS,
    zoomFactor: opts.zoomFactor ?? DEFAULT_ZOOM_FACTOR,
    zoomInMs: opts.zoomInMs ?? DEFAULT_ZOOM_IN_MS,
    zoomOutMs: opts.zoomOutMs ?? DEFAULT_ZOOM_OUT_MS,
    shakeMs: opts.shakeMs ?? DEFAULT_SHAKE_MS,
    shakeIntensity: opts.shakeIntensity ?? DEFAULT_SHAKE_INTENSITY,
    confettiBursts: opts.confettiBursts ?? DEFAULT_CONFETTI_BURSTS,
    confettiCount: opts.confettiCount ?? DEFAULT_CONFETTI_COUNT,
    onComplete: opts.onComplete,
  }
}

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
  const settings = getFinishSequenceSettings(opts)

  const cam = scene.cameras.main
  const baseZoom = cam.zoom

  if (settings.enableSlowmo) {
    // 슬로모는 화면 렌더 자체가 아니라 시뮬레이션 재생 속도만 바꾸도록 이벤트로 요청한다.
    scene.events.emit(FINISH_EVENT_SLOWMO, settings.slowmoScale, settings.slowmoRestoreMs)
    scene.events.once(FINISH_EVENT_SLOWMO_RESTORE, () => {
      scene.events.emit(FINISH_EVENT_SLOWMO_END)
    })
  }

  let zoomOutDone = !settings.enableCameraZoom
  let slowmoDone = !settings.enableSlowmo
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

    for (let i = 0; i < settings.confettiBursts; i++) {
      scene.time.delayedCall(i * CONFETTI_BURST_INTERVAL_MS, () => {
        const x = burstXs[i % burstXs.length]
        particles.emitParticleAt(x, burstY, settings.confettiCount)
      })
    }

    scene.time.delayedCall(CONFETTI_CLEANUP_DELAY_MS, () => {
      particles.destroy()
    })

    // 2) FINISH 배너
    const banner = scene.add
      .text(scene.scale.width / 2, scene.scale.height * 0.32, FINISH_BANNER_TEXT, {
        fontFamily: FINISH_BANNER_FONT_FAMILY,
        fontSize: FINISH_BANNER_FONT_SIZE,
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
      duration: FINISH_BANNER_POP_DURATION_MS,
      ease: 'Back.Out',
      onComplete: () => {
        scene.tweens.add({
          targets: banner,
          scale: 1,
          duration: FINISH_BANNER_SETTLE_DURATION_MS,
          ease: 'Sine.Out',
        })
        scene.tweens.add({
          targets: banner,
          alpha: 0,
          duration: FINISH_BANNER_FADE_DURATION_MS,
          delay: FINISH_BANNER_FADE_OUT_DELAY_MS,
          ease: 'Sine.In',
          onComplete: () => {
            banner.destroy()
            settings.onComplete?.()
          },
        })
      },
    })
  }

  // 카메라 연출: 줌인 -> 결승 통과 이벤트를 받으면 줌아웃
  if (settings.enableCameraZoom) {
    if (target && (target as Phaser.GameObjects.Sprite).x !== undefined) {
      cam.pan(
        (target as Phaser.GameObjects.Sprite).x,
        (target as Phaser.GameObjects.Sprite).y,
        TARGET_PAN_DURATION_MS,
      )
    }
    cam.shake(settings.shakeMs, settings.shakeIntensity)

    let zoomOutStarted = false
    const startZoomOut = () => {
      if (zoomOutStarted) return
      zoomOutStarted = true

      scene.tweens.add({
        targets: cam,
        zoom: baseZoom,
        duration: settings.zoomOutMs,
        ease: 'Sine.InOut',
        onComplete: () => {
          zoomOutDone = true
          runPostEffects()
        },
      })
    }

    const zoomInTween = scene.tweens.add({
      targets: cam,
      zoom: baseZoom * settings.zoomFactor,
      duration: settings.zoomInMs,
      ease: 'Sine.Out',
    })

    scene.events.once(FINISH_EVENT_HORSE_CROSSED, () => {
      zoomInTween.stop()
      startZoomOut()
    })
  }

  if (settings.enableSlowmo) {
    const onSlowmoEnd = () => {
      slowmoDone = true
      runPostEffects()
    }

    scene.events.once(FINISH_EVENT_SLOWMO_END, onSlowmoEnd)
  }

  runPostEffects()
}
