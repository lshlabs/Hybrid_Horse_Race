import Phaser from 'phaser'
import type { Horse } from '../../../engine/race'
import { positionToProgress } from '../../../engine/race/positionUtils'
import type TileMapManager from '../managers/TileMapManager'

/**
 * 카메라 스크롤 관리
 * 말이 화면 중앙에 오기 전에는 고정하고, 중앙 도달 뒤부터 따라가게 만든다.
 * 말 position(m)을 월드 X(px)로 바꾸는 계산도 여기서 같이 담당한다.
 */
/**
 * 트랙 좌표/길이 기준은 TileMapManager를 단일 소스로 사용한다.
 * 여기서는 값 계산을 직접 만들지 않고 getter만 사용한다.
 */
export default class CameraScrollManager {
  private scene: Phaser.Scene
  private mapManager: TileMapManager

  private cameraScrollPx = 0 // px (현재 카메라 스크롤)
  private isScrolling = false // 중앙 도달 여부
  private cameraScrollPxAtStart = 0 // px (스크롤 시작 시점 기준값)
  private leadingHorsePositionMAtScrollStart = 0 // m (스크롤 시작 시점 1등 위치)

  constructor(config: { scene: Phaser.Scene; mapManager: TileMapManager }) {
    this.scene = config.scene
    this.mapManager = config.mapManager
  }

  /**
   * 말의 월드 X 좌표 (position[m] → px 변환).
   * 완주 후에는 runPastM만큼 더 달리는 연출 적용.
   */
  /** position = 말 코(m). 반환값 = 말 코 월드 X(px). 스프라이트는 호출측에서 그대로 배치(오프셋 없음) */
  getHorseWorldX(simHorse: Horse, simElapsedSec: number): number {
    const trackLengthM = this.mapManager.getTrackLengthM()
    const trackLengthPx = this.mapManager.getTrackLengthPx()
    const trackStartWorldXPx = this.mapManager.getTrackStartWorldXPx()
    let progress: number

    if (simHorse.finished) {
      const timeSinceFinish = simElapsedSec - (simHorse.finishTime ?? simElapsedSec)
      const runPastM = timeSinceFinish * 15
      progress = positionToProgress(simHorse.position + runPastM, trackLengthM, {
        capAtOne: false,
      })
    } else {
      progress = positionToProgress(simHorse.position, trackLengthM, {
        capAtOne: true,
      })
    }

    const horseScreenDistance = progress * trackLengthPx
    return trackStartWorldXPx + horseScreenDistance
  }

  /** 카메라 스크롤 업데이트 (RaceScene update에서 매 프레임 호출) */
  update(simHorses: Horse[], isRaceFinished: boolean) {
    const gameWidth = this.scene.scale.width
    const centerX = gameWidth / 2
    const trackLengthM = this.mapManager.getTrackLengthM()
    const trackLengthPx = this.mapManager.getTrackLengthPx()
    const trackStartWorldXPx = this.mapManager.getTrackStartWorldXPx()

    if (!this.isScrolling) {
      for (const simHorse of simHorses) {
        // 여기서부터는 말이 앞으로 가는 느낌보다 카메라가 따라가는 느낌으로 전환된다.
        const progress = positionToProgress(simHorse.position, trackLengthM, {
          capAtOne: true,
        })
        const horseScreenDistance = progress * trackLengthPx
        const horseWorldX = trackStartWorldXPx + horseScreenDistance
        const horseScreenX = horseWorldX - this.cameraScrollPx

        if (horseScreenX >= centerX) {
          this.isScrolling = true
          this.cameraScrollPxAtStart = horseWorldX - centerX
          this.cameraScrollPx = this.cameraScrollPxAtStart
          this.leadingHorsePositionMAtScrollStart = Math.max(...simHorses.map((h) => h.position))
          this.syncToMap()
          return
        }
      }
    }

    if (this.isScrolling) {
      const maxPosition = Math.max(...simHorses.map((h) => h.position))
      this.cameraScrollPx =
        this.cameraScrollPxAtStart +
        ((maxPosition - this.leadingHorsePositionMAtScrollStart) / trackLengthM) * trackLengthPx

      if (!isRaceFinished) {
        this.syncToMap()
      }
    }
  }

  private syncToMap() {
    const scaleFactor = this.mapManager.getScaleFactor()
    const logicalX = this.cameraScrollPx / scaleFactor
    this.mapManager.setTilePositionX(logicalX)
  }

  getCameraScrollPx() {
    return this.cameraScrollPx
  }

  reset() {
    this.cameraScrollPx = 0
    this.isScrolling = false
    this.cameraScrollPxAtStart = 0
    this.leadingHorsePositionMAtScrollStart = 0
  }
}
