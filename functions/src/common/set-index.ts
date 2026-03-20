import { HttpsError } from 'firebase-functions/v2/https'
import { logWarn } from './logging'

const INVALID_SET_INDEX_CODE = 'invalid-set-index'
const FAILED_PRECONDITION = 'failed-precondition'

export function throwInvalidSetIndex(params: {
  roomId: string
  playerId: string
  action: string
  requestedSetIndex: number
  currentSetIndex: number
}): never {
  const { roomId, playerId, action, requestedSetIndex, currentSetIndex } = params
  logWarn('room.set-index-mismatch', {
    roomId,
    playerId,
    action,
    requestedSetIndex,
    currentSetIndex,
    errorCode: INVALID_SET_INDEX_CODE,
  })
  throw new HttpsError(FAILED_PRECONDITION, INVALID_SET_INDEX_CODE)
}
