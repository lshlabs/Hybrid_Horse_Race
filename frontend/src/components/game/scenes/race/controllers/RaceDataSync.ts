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

const SCENE_DATA_KEYS = {
  roomId: 'roomId',
  playerId: 'playerId',
  sessionToken: 'sessionToken',
  roomJoinToken: 'roomJoinToken',
  room: 'room',
  players: 'players',
  selectedHorse: 'selectedHorse',
} as const

const ROOM_DATA_UPDATED_EVENT = 'room-data-updated'
const MISSING_ROOM_ID_WARNING = '[RaceScene] No roomId found in scene.data'

function readRaceGameDataFromSceneData(scene: Phaser.Scene): RaceGameData {
  return {
    roomId: scene.data.get(SCENE_DATA_KEYS.roomId),
    playerId: scene.data.get(SCENE_DATA_KEYS.playerId),
    sessionToken: scene.data.get(SCENE_DATA_KEYS.sessionToken),
    roomJoinToken: scene.data.get(SCENE_DATA_KEYS.roomJoinToken),
    room: scene.data.get(SCENE_DATA_KEYS.room),
    players: scene.data.get(SCENE_DATA_KEYS.players),
    selectedHorse: scene.data.get(SCENE_DATA_KEYS.selectedHorse),
  }
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
    this.applyData(data)
  }

  loadFromSceneData() {
    const nextData = readRaceGameDataFromSceneData(this.scene)
    this.applyData(nextData)

    if (!nextData.roomId && import.meta.env.DEV) {
      console.warn(MISSING_ROOM_ID_WARNING)
    }
  }

  subscribe() {
    this.scene.events.on(ROOM_DATA_UPDATED_EVENT, this.handleRoomDataUpdated)
  }

  unsubscribe() {
    this.scene.events.off(ROOM_DATA_UPDATED_EVENT, this.handleRoomDataUpdated)
  }

  private readonly handleRoomDataUpdated = (data: RaceGameData) => {
    this.applyData(data)
    this.onDataUpdated()
  }

  private applyData(data: RaceGameData) {
    this.onDataApplied(data)
  }
}
