import { HttpsError } from 'firebase-functions/v2/https'
import { logWarn } from './logging'

// room.currentSet과 요청 setIndex가 다를 때 공통 에러/로그 처리
export function throwInvalidSetIndex(params: {
  roomId: string
  playerId: string
  action: string
  requestedSetIndex: number
  currentSetIndex: number
}): never {
  // 디버깅할 때 어떤 액션에서 set index가 어긋났는지 보려고 로그를 남긴다.
  logWarn('room.set-index-mismatch', {
    roomId: params.roomId,
    playerId: params.playerId,
    action: params.action,
    requestedSetIndex: params.requestedSetIndex,
    currentSetIndex: params.currentSetIndex,
    errorCode: 'invalid-set-index',
  })
  throw new HttpsError('failed-precondition', 'invalid-set-index')
}
