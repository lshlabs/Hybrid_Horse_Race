import type Phaser from 'phaser'
import type GUIManager from '../../../managers/GUIManager'
import type ProgressBarManager from '../../../managers/ProgressBarManager'
import type HorseManager from '../../../managers/HorseManager'
import { showWaitingOverlay } from '../../../effects/showWaitingOverlay'

/**
 * RaceScene UI 흐름 보조 클래스
 * 대기 오버레이 전/후에 HUD를 숨기거나 다시 보여주는 코드를 한 곳에 모아둔다.
 */
export default class RaceFlowUI {
  /** 대기 연출 시작 전에 HUD를 잠깐 숨겨서 화면이 덜 복잡하게 보이게 한다. */
  hideGUIForWaitingOverlay(config: {
    hud: GUIManager
    progressBarManager: ProgressBarManager
    horseManager: HorseManager
  }) {
    config.hud.setAugmentSelectionHUD('hidden')
    config.progressBarManager.hide()
    config.horseManager.hidePlayerIndicator()
  }

  /** 대기 연출이 끝나면 숨겼던 HUD를 다시 원래대로 보여준다. */
  showGUIAfterWaitingOverlay(config: { hud: GUIManager; horseManager: HorseManager }) {
    config.hud.setAugmentSelectionHUD('full')
    config.horseManager.showPlayerIndicator()
  }

  /** 공통 대기 오버레이 표시 (메시지만 바꿔서 재사용) */
  showWaiting(
    scene: Phaser.Scene,
    config: { messageKey: string; durationMs?: number | null; onComplete: () => void },
  ) {
    return showWaitingOverlay(scene, {
      messageKey: config.messageKey,
      durationMs: config.durationMs,
      onComplete: config.onComplete,
    })
  }
}
