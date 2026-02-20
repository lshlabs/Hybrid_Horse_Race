import type Phaser from 'phaser'
import type GUIManager from '../../../managers/GUIManager'
import type ProgressBarManager from '../../../managers/ProgressBarManager'
import type HorseManager from '../../../managers/HorseManager'
import { showWaitingOverlay } from '../../../effects/showWaitingOverlay'

/**
 * RaceScene UI 흐름 전담 클래스.
 * - 대기 연출 전/후 HUD 표시 상태 전환
 * - 공통 대기 오버레이 호출 래핑
 *
 * 목적:
 * - RaceScene에서 렌더/연출 제어 코드를 분리해 읽기 쉽게 유지
 */
export default class RaceFlowUI {
  /** 대기 연출 시작 전, 시야를 분산시키는 HUD 요소를 숨긴다. */
  hideGUIForWaitingOverlay(config: {
    hud: GUIManager
    progressBarManager: ProgressBarManager
    horseManager: HorseManager
  }) {
    config.hud.setAugmentSelectionHUD('hidden')
    config.progressBarManager.hide()
    config.horseManager.hidePlayerIndicator()
  }

  /** 대기 연출 종료 후, 레이스 HUD를 원래 상태로 복구한다. */
  showGUIAfterWaitingOverlay(config: { hud: GUIManager; horseManager: HorseManager }) {
    config.hud.setAugmentSelectionHUD('full')
    config.horseManager.showPlayerIndicator()
  }

  /** 공통 대기 오버레이를 표시한다. */
  showWaiting(
    scene: Phaser.Scene,
    config: { messageKey: string; durationMs: number; onComplete: () => void },
  ) {
    showWaitingOverlay(scene, {
      messageKey: config.messageKey,
      durationMs: config.durationMs,
      onComplete: config.onComplete,
    })
  }
}
