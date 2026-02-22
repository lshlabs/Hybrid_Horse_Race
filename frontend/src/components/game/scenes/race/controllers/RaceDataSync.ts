import Phaser from 'phaser'
import type { Room, Player } from '../../../../../hooks/useRoom'
import type { Stats } from '../../../../../engine/race/types'

/** 선택한 말 데이터 (개발/테스트용 local fallback 구조도 포함) */
export type SelectedHorseData = {
  name: string
  stats: Stats
  totalStats: number
  selectedAt: string
}

export type RaceGameData = {
  roomId?: string
  playerId?: string
  sessionToken?: string
  roomJoinToken?: string | null
  room?: Room
  players?: Player[]
  selectedHorse?: SelectedHorseData
}

/**
 * RaceScene 데이터 동기화 전담 클래스
 * Scene.init(data), scene.data, room-data-updated 이벤트를 여기서 묶어서 처리한다.
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
    // PhaserGame에서 scene.data에 넣어준 값을 RaceScene에서 쓰는 구조로 읽어온다.
    const nextData: RaceGameData = {
      roomId: this.scene.data.get('roomId'),
      playerId: this.scene.data.get('playerId'),
      sessionToken: this.scene.data.get('sessionToken'),
      roomJoinToken: this.scene.data.get('roomJoinToken'),
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
    // PhaserGame -> RaceScene 데이터 업데이트 이벤트 등록
    this.scene.events.on('room-data-updated', this.handleRoomDataUpdated)
  }

  unsubscribe() {
    // 씬 재진입 때 중복 핸들러가 생기지 않게 종료 시 해제한다.
    this.scene.events.off('room-data-updated', this.handleRoomDataUpdated)
  }

  private readonly handleRoomDataUpdated = (data: RaceGameData) => {
    this.onDataApplied(data)
    this.onDataUpdated()
  }
}
