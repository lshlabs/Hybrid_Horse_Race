import { HttpsError } from 'firebase-functions/v2/https'
import { throwInvalidSetIndex } from './set-index'

// "특정 room phase + 현재 세트"가 정확히 맞아야 하는 액션에서 쓰는 공통 검증 helper
export function assertExactRoomPhaseAndSetIndex(params: {
  roomId: string
  playerId: string
  action: string
  roomStatus: string
  expectedStatus: string
  statusMessage: string
  requestedSetIndex: number
  currentSetIndex: number
}): void {
  // 먼저 room phase를 확인하고
  if (params.roomStatus !== params.expectedStatus) {
    throw new HttpsError('failed-precondition', params.statusMessage)
  }

  // 그 다음 setIndex가 현재 세트와 같은지 확인한다.
  if (params.requestedSetIndex !== params.currentSetIndex) {
    throwInvalidSetIndex({
      roomId: params.roomId,
      playerId: params.playerId,
      action: params.action,
      requestedSetIndex: params.requestedSetIndex,
      currentSetIndex: params.currentSetIndex,
    })
  }
}
