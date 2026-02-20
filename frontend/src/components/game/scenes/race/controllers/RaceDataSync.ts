import Phaser from 'phaser'
import type { Room, Player } from '../../../../../hooks/useRoom'
import type { Stats } from '../../../../../engine/race/types'

/** 선택한 말 데이터(개발/테스트 페이지 포함) */
export type SelectedHorseData = {
  name: string
  stats: Stats
  totalStats: number
  selectedAt: string
}

export type RaceGameData = {
  roomId?: string
  playerId?: string
  room?: Room
  players?: Player[]
  selectedHorse?: SelectedHorseData
}

/**
 * RaceScene의 데이터 동기화 전담 클래스.
 * - Scene.init(data) 초기 데이터 반영
 * - scene.data 저장소에서 현재 값 로드
 * - Phaser 커스텀 이벤트(room-data-updated) 구독/해제
 *
 * 이 클래스를 분리한 이유:
 * - RaceScene에서 "게임 흐름"과 "외부 데이터 동기화" 책임을 분리하기 위함
 */
export default class RaceDataSync {
  private scene: Phaser.Scene
  private onDataApplied: (data: RaceGameData) => void
  private onDataUpdated: () => void

  constructor(config: {
    scene: Phaser.Scene
    onDataApplied: (data: RaceGameData) => void
    onDataUpdated: () => void
  }) {
    this.scene = config.scene
    this.onDataApplied = config.onDataApplied
    this.onDataUpdated = config.onDataUpdated
  }

  applyInitData(data?: RaceGameData) {
    if (!data) return
    this.onDataApplied(data)
  }

  loadFromSceneData() {
    // PhaserGame에서 data.set(...)으로 주입한 값을 읽는다.
    const nextData: RaceGameData = {
      roomId: this.scene.data.get('roomId'),
      playerId: this.scene.data.get('playerId'),
      room: this.scene.data.get('room'),
      players: this.scene.data.get('players'),
      selectedHorse: this.scene.data.get('selectedHorse'),
    }
    this.onDataApplied(nextData)

    if (!nextData.roomId && import.meta.env.DEV) {
      console.warn('[RaceScene] No roomId found in scene.data')
    }
  }

  subscribe() {
    // PhaserGame -> RaceScene 데이터 업데이트 이벤트
    this.scene.events.on('room-data-updated', this.handleRoomDataUpdated)
  }

  unsubscribe() {
    // 씬 종료 시 반드시 해제해 중복 핸들러를 방지한다.
    this.scene.events.off('room-data-updated', this.handleRoomDataUpdated)
  }

  private readonly handleRoomDataUpdated = (data: RaceGameData) => {
    this.onDataApplied(data)
    this.onDataUpdated()
  }
}
