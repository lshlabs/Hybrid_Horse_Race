import type Phaser from 'phaser'
import type GUIManager from '../../../managers/GUIManager'
import type ProgressBarManager from '../../../managers/ProgressBarManager'
import type HorseManager from '../../../managers/HorseManager'
import { showWaitingOverlay } from '../../../effects/showWaitingOverlay'

const HUD_MODE = {
  hidden: 'hidden',
  full: 'full',
} as const

type HideGUIConfig = {
  hud: GUIManager
  progressBarManager: ProgressBarManager
  horseManager: HorseManager
}

type ShowGUIConfig = {
  hud: GUIManager
  horseManager: HorseManager
}

type WaitingOverlayConfig = {
  messageKey: string
  durationMs?: number | null
  onComplete: () => void
}

/**
 * RaceScene UI 흐름 보조 클래스
 * 대기 오버레이 전/후에 HUD를 숨기거나 다시 보여주는 코드를 한 곳에 모아둔다.
 */
export default class RaceFlowUI {
  hideGUIForWaitingOverlay(config: HideGUIConfig) {
    config.hud.setAugmentSelectionHUD(HUD_MODE.hidden)
    config.progressBarManager.hide()
    config.horseManager.hidePlayerIndicator()
  }

  showGUIAfterWaitingOverlay(config: ShowGUIConfig) {
    config.hud.setAugmentSelectionHUD(HUD_MODE.full)
    config.horseManager.showPlayerIndicator()
  }

  showWaiting(scene: Phaser.Scene, config: WaitingOverlayConfig) {
    return showWaitingOverlay(scene, config)
  }
}
