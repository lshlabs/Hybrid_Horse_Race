import type HorseManager from '../../../managers/HorseManager'
import type CameraScrollManager from '../../../managers/CameraScrollManager'
import type ProgressBarManager from '../../../managers/ProgressBarManager'
import type TileMapManager from '../../../managers/TileMapManager'

/**
 * RaceScene 런타임 상태 스냅샷.
 * 컨트롤러는 이 값을 입력받아 "다음 상태"를 반환한다.
 */
export type RaceRuntimeState = {
  isRaceStarted: boolean
  isCountdownActive: boolean
  augmentSelectionActive: boolean
  isRaceFinished: boolean
  isResultSceneShown: boolean
  isFinishSequenceTriggered: boolean
  finishSequenceDone: boolean
  simTimeAccumulatorSec: number
  simElapsedSec: number
  raceStartTimestampMs: number
  currentSet: number
}

export type SimulationResult = {
  allFinished: boolean
  simTimeAccumulatorSec: number
  simElapsedSec: number
}

/**
 * 레이스 진행/시뮬레이션/라운드 리셋 전담 컨트롤러.
 * - 씬 바깥에서 순수 로직 중심으로 상태 전이를 계산한다.
 * - RaceScene은 이 컨트롤러 결과를 자신의 필드에 반영만 한다.
 */
export default class RaceRuntimeController {
  /** 레이스 시작 조건을 확인하고 시작 상태를 반환한다. */
  startRace(state: RaceRuntimeState): RaceRuntimeState {
    if (state.isRaceStarted || state.augmentSelectionActive || state.isCountdownActive) {
      return state
    }

    return {
      ...state,
      isRaceStarted: true,
      simElapsedSec: 0,
      simTimeAccumulatorSec: 0,
      raceStartTimestampMs: performance.now(),
    }
  }

  /**
   * fixed-step 시뮬레이션을 진행한다.
   * - 입력 delta와 배속을 누적해 physicsDtSec 단위로 horse.step을 호출
   * - 누적값/경과시간/전체 완주 여부를 함께 반환
   */
  updateSimulation(config: {
    simHorses: ReturnType<HorseManager['getSimHorses']>
    state: Pick<RaceRuntimeState, 'simTimeAccumulatorSec' | 'simElapsedSec'>
    deltaMs: number
    physicsDtSec: number
    simPlaybackScale: number
  }): SimulationResult {
    const { simHorses, deltaMs, physicsDtSec, simPlaybackScale } = config
    let simTimeAccumulatorSec = config.state.simTimeAccumulatorSec
    let simElapsedSec = config.state.simElapsedSec

    simTimeAccumulatorSec += (deltaMs / 1000) * simPlaybackScale

    let allFinished = true
    let stepped = false
    while (simTimeAccumulatorSec >= physicsDtSec) {
      stepped = true
      simTimeAccumulatorSec -= physicsDtSec

      const currentRanking = [...simHorses]
        .filter((h) => !h.finished)
        .sort((a, b) => b.position - a.position)
      for (let j = 0; j < currentRanking.length; j++) {
        currentRanking[j].updateRank(j + 1)
      }

      for (const simHorse of simHorses) {
        if (!simHorse.finished) {
          simHorse.step(physicsDtSec, simElapsedSec)
          allFinished = false
        }
      }
      simElapsedSec += physicsDtSec
      if (allFinished) break
    }

    return {
      allFinished: stepped ? allFinished : false,
      simTimeAccumulatorSec,
      simElapsedSec,
    }
  }

  /** 다음 세트 시작용 상태/매니저를 초기화하고 새 상태를 반환한다. */
  resetForNextSet(config: {
    state: RaceRuntimeState
    horseManager: HorseManager
    cameraScrollManager: CameraScrollManager
    progressBarManager: ProgressBarManager
    mapManager: TileMapManager
  }): RaceRuntimeState {
    const { state, horseManager, cameraScrollManager, progressBarManager, mapManager } = config

    cameraScrollManager.reset()
    progressBarManager.reset()
    mapManager.setTilePositionX(0)
    mapManager.updateStripePositions(0)

    const simHorses = horseManager.getSimHorses()
    for (const simHorse of simHorses) {
      simHorse.position = 0
      simHorse.currentSpeed = 0
      simHorse.finished = false
      simHorse.finishTime = null
      simHorse.stamina = 100
      simHorse.maxStamina = 100
      simHorse.conditionRoll = 0
      simHorse.maxSpeed_ms = 0
      simHorse.effStats = { ...simHorse.baseStats }
    }

    horseManager.resetHorsesToIdle()

    return {
      ...state,
      currentSet: state.currentSet + 1,
      isRaceFinished: false,
      isRaceStarted: false,
      isCountdownActive: false,
      isResultSceneShown: false,
      isFinishSequenceTriggered: false,
      finishSequenceDone: false,
      simTimeAccumulatorSec: 0,
      simElapsedSec: 0,
      raceStartTimestampMs: 0,
    }
  }
}
