import { HttpsError } from 'firebase-functions/v2/https'
import { throwInvalidSetIndex } from './set-index'

function assertRoomStatus(
  roomStatus: string,
  expectedStatus: string,
  statusMessage: string,
): void {
  if (roomStatus !== expectedStatus) {
    throw new HttpsError('failed-precondition', statusMessage)
  }
}

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
  assertRoomStatus(params.roomStatus, params.expectedStatus, params.statusMessage)

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
